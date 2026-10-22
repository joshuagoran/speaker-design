// Each driver's beam in the map's band, for the Space page's 3D view: from each driver that plays that band, where it
// sits, where it points, the angles where it falls 6 dB and 3 dB, wide and high, by the coverage model's directivity
// (lib/acoustics/coverage `directivityGain`), and how far its direct level falls `BEAM_FALL_DB` below its level at 1 m. Pure.
import type { CoverageBand } from "../../types";
import {
  airNepers,
  airNepersPerM,
  bandCenterHz,
  bandRangeHz,
  coverageFrequencies,
  directivityAt,
  directivityGain,
  pathAmplitude,
  type SourceDirectivity,
} from "../acoustics/coverage";
import { abs } from "../acoustics/complex";
import { BEAM_EDGE_DB, BEAM_FALL_DB, BEAM_INNER_EDGE_DB } from "../../constants/space";
import { METERS_PER_FOOT } from "../../constants/units";
import { spaceOutputs, voiceId, type SpaceModel } from "./spaceCoverage";
import { bandPassband, playsInBand } from "./spaceBalance";
import type { RoomPoint } from "./spaceLayout";

/** The bisection steps for an edge: a quarter turn in 50 halvings is far finer than a draw needs. */
const EDGE_STEPS = 50;

/**
 * A source's half angles, radians, wide and high: where its directivity (lib/acoustics/coverage `directivityGain`, as
 * the coverage map radiates it) first falls `fallDb` off its axis in each plane. Each is a quarter turn at most: where
 * it never falls that far in front. Every pattern's side lobes are quieter than the falls drawn, so the angles where
 * it is louder than the fall are one span from the axis, and a bisection finds its edge.
 */
export function beamHalfAngles(
  directivity: SourceDirectivity,
  fallDb: number,
): [h: number, v: number] {
  const floor = 10 ** (-fallDb / 20);
  const edge = (gain: (angle: number) => number) => {
    if (gain(Math.PI / 2) > floor) return Math.PI / 2;
    let lo = 0,
      hi = Math.PI / 2;
    for (let i = 0; i < EDGE_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (gain(mid) > floor) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return [
    edge((angle) => directivityGain(directivity, angle, 0)),
    edge((angle) => directivityGain(directivity, 0, angle)),
  ];
}

/** A beam's edges at one fall, wide and high, radians: null where it never falls that far inside a quarter turn. */
type BeamEdges = [h: number | null, v: number | null];

/** A pattern's edges at `f` where it falls `fallDb`, each inside a quarter turn or null. */
const beamEdges = (directivity: SourceDirectivity, fallDb: number): BeamEdges => {
  const [h, v] = beamHalfAngles(directivity, fallDb);
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

/** One frequency's share of a beam's direct level: its mean square at 1 m, by its share, and the air there, Np/m. */
interface AxisPower {
  ms: number;
  air: number;
}

/**
 * Where a direct level on the axis falls `BEAM_FALL_DB` below its level at 1 m, m: the mean square at 1 m of each
 * frequency (by its share), each along the map's path (`pathAmplitude`, less the air's absorption, `airNepers`). Without
 * the air that is 10^(BEAM_FALL_DB/20) m; the air only brings it nearer.
 */
function reachM(axisPowers: readonly AxisPower[]): number {
  /** the mean square at `r` m */
  const level = (r: number) =>
    axisPowers.reduce(
      (sum, { ms, air }) => sum + ms * pathAmplitude(r, 1, airNepers(air, r)) ** 2,
      0,
    );
  const atOneM = level(1);
  /** the level at `r` m over the level at 1 m, as a power ratio */
  const fall = (r: number) => level(r) / atOneM;
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
  const power = new Map<string, AxisPower[]>();
  freqs.forEach((f, i) => {
    const air = airNepersPerM(f);
    for (const [id, p] of Object.entries(spaceOutputs(model, f)))
      if (p && abs(p) > 0)
        power.set(id, [...(power.get(id) ?? []), { ms: shares[i] * abs(p) ** 2, air }]);
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
      const id = voiceId(box, d);
      const axisPowers = power.get(id);
      const voice = model.scene.voices.find((v) => v.id === id);
      if (!axisPowers || !voice) return [];
      const directivity = directivityAt(voice.pattern, f, voice.boxWIn);
      return [
        {
          at: d.at,
          yaw: d.yaw,
          pitch: d.pitch,
          edges6: beamEdges(directivity, BEAM_EDGE_DB),
          edges3: beamEdges(directivity, BEAM_INNER_EDGE_DB),
          reachFt: reachM(axisPowers) / METERS_PER_FOOT,
        },
      ];
    }),
  );
}
