// Each driver's beam in the map's band, for the Space page's 3D view: from each driver that plays that band, where it
// sits, where it points, the angles where it falls 6 dB and 3 dB, wide and high, by the coverage model's driver pattern
// (spaceCoverage), and how far its direct level falls `BEAM_FALL_DB` below its level at 1 m. Pure.
import type { CoverageBand } from "../../types";
import {
  bandCenterHz,
  bandRangeHz,
  coverageFrequencies,
  type CoveragePattern,
} from "../acoustics/coverage";
import { pistonPattern, waveguideHalfAngles } from "../acoustics/directivity";
import { abs } from "../acoustics/complex";
import { airDbPerM } from "../acoustics/roomAcoustics";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { BEAM_EDGE_DB, BEAM_FALL_DB, BEAM_INNER_EDGE_DB } from "../../constants/space";
import { METERS_PER_FOOT } from "../../constants/units";
import { driverPattern, spaceOutputs, voiceId, type SpaceModel } from "./spaceCoverage";
import { bandPassband, playsInBand } from "./spaceBalance";
import type { RoomPoint } from "./spaceLayout";

/** Where a piston's pattern, 2·J1(x)/x, falls `fallDb`, by bisection on its first lobe (6 dB: x ≈ 2.215). */
function pistonX(fallDb: number): number {
  const floor = 10 ** (-fallDb / 20);
  let lo = 0,
    hi = 3.8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pistonPattern(mid) > floor) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** x where a piston falls each edge's fall, worked out once */
const PISTON_X: Record<number, number> = {
  [BEAM_EDGE_DB]: pistonX(BEAM_EDGE_DB),
  [BEAM_INNER_EDGE_DB]: pistonX(BEAM_INNER_EDGE_DB),
};

/**
 * A pattern's half angles at `f`, radians, wide and high: where it falls `fallDb` off its axis. A horn's are its own
 * −6 dB angles (wider below its mouth's control), scaled by its −6·(θ/half)² dB fall; a piston's are where ka·sin θ
 * reaches that fall. Each is a quarter turn at most: where it never falls that far in front.
 */
export function beamHalfAngles(
  pattern: CoveragePattern,
  f: number,
  fallDb: number,
): [h: number, v: number] {
  if (pattern.horn) {
    const { covH, covV, wIn, hIn } = pattern.horn;
    const scale = Math.sqrt(fallDb / BEAM_EDGE_DB);
    const [h, v] = waveguideHalfAngles(f, covH, covV, wIn, hIn);
    return [Math.min(h * scale, Math.PI / 2), Math.min(v * scale, Math.PI / 2)];
  }
  const x = PISTON_X[fallDb] ?? pistonX(fallDb);
  const ka = ((2 * Math.PI * f) / SPEED_OF_SOUND) * pattern.a;
  const half = ka > x ? Math.asin(x / ka) : Math.PI / 2;
  return [half, half];
}

/** A beam's edges at one fall, wide and high, radians: null where it never falls that far inside a quarter turn. */
type BeamEdges = [h: number | null, v: number | null];

/** A pattern's edges at `f` where it falls `fallDb`, each inside a quarter turn or null. */
const beamEdges = (pattern: CoveragePattern, f: number, fallDb: number): BeamEdges => {
  const [h, v] = beamHalfAngles(pattern, f, fallDb);
  return [h < Math.PI / 2 ? h : null, v < Math.PI / 2 ? v : null];
};

/**
 * One driver's beam: where it starts (the driver, ft), its axis (radians), its edges where it falls `BEAM_EDGE_DB`
 * (`edges6`) and `BEAM_INNER_EDGE_DB` (`edges3`), and how far along its axis its direct level falls `BEAM_FALL_DB`
 * below its level at 1 m, ft.
 */
export interface SpaceBeam {
  at: RoomPoint;
  yaw: number;
  pitch: number;
  edges6: BeamEdges;
  edges3: BeamEdges;
  reachFt: number;
}

/** The bisection steps for a beam's reach: 1 to 10 m in 60 halvings is far finer than a draw needs. */
const REACH_STEPS = 60;

/**
 * Where a direct level on the axis falls `BEAM_FALL_DB` below its level at 1 m, m: the mean square at 1 m of each
 * frequency (by its share), each falling as 1/r² and by the air's absorption there, as the map has it. Without the air
 * that is 10^(BEAM_FALL_DB/20) m; the air only brings it nearer.
 */
function reachM(meanSquares: readonly { ms: number; airDb: number }[]): number {
  /** the level at `r` m over the level at 1 m, as a power ratio */
  const fall = (r: number) =>
    meanSquares.reduce((sum, { ms, airDb }) => sum + ms * 10 ** ((-airDb * r) / 10), 0) /
    (r * r * meanSquares.reduce((sum, { ms, airDb }) => sum + ms * 10 ** (-airDb / 10), 0));
  const floor = 10 ** (-BEAM_FALL_DB / 10);
  let near = 1,
    far = 10 ** (BEAM_FALL_DB / 20);
  for (let i = 0; i < REACH_STEPS; i++) {
    const mid = (near + far) / 2;
    if (fall(mid) > floor) near = mid;
    else far = mid;
  }
  return (near + far) / 2;
}

/**
 * Each driver's beam in the band on show (or at the one frequency): one from each driver whose band plays there (in a
 * band, its passband overlaps the band's range; at one frequency, any driver) and radiates there. It reaches where its
 * direct level on its axis, as the map radiates it (its voice's output at the map's frequencies, the mean square by
 * their shares, less the air's absorption), falls `BEAM_FALL_DB` below its level at 1 m. Its angles are at the band's
 * center (or the one frequency), each inside a quarter turn or none: a driver that falls neither 6 nor 3 dB there has its
 * axis alone.
 */
export function spaceBeams(
  model: Pick<SpaceModel, "placements" | "feeds" | "scene">,
  band: CoverageBand,
  freqHz: number,
): SpaceBeam[] {
  const { freqs, shares } = coverageFrequencies(
    band,
    freqHz,
    model.scene.modal?.crossoverHz ?? null,
  );
  /** each voice's mean square at 1 m on its axis at each frequency, by its share, with the air's absorption there */
  const power = new Map<string, { ms: number; airDb: number }[]>();
  freqs.forEach((f, i) => {
    const airDb = airDbPerM(f);
    for (const [id, p] of Object.entries(spaceOutputs(model, f)))
      if (p && abs(p) > 0)
        power.set(id, [...(power.get(id) ?? []), { ms: shares[i] * abs(p) ** 2, airDb }]);
  });
  const range = bandRangeHz(band, freqHz);
  const f = bandCenterHz(band, freqHz);
  return model.placements.flatMap(({ item }, box) =>
    item.drivers.flatMap((d): SpaceBeam[] => {
      const speakerBand = d.speaker.bands.find((b) => b.id === d.band);
      const member = item.stack?.stack.members[d.member];
      if (!speakerBand || !member) return [];
      // in a band, a driver beams when its passband overlaps it; at one frequency, its level there decides
      if (band !== "one" && !playsInBand([bandPassband(speakerBand, member.crossover)], range))
        return [];
      const meanSquares = power.get(voiceId(box, d));
      if (!meanSquares) return [];
      const pattern = driverPattern(d);
      return [
        {
          at: d.at,
          yaw: d.yaw,
          pitch: d.pitch,
          edges6: beamEdges(pattern, f, BEAM_EDGE_DB),
          edges3: beamEdges(pattern, f, BEAM_INNER_EDGE_DB),
          reachFt: reachM(meanSquares) / METERS_PER_FOOT,
        },
      ];
    }),
  );
}
