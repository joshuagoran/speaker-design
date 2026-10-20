// Each driver's beam in the map's band, for the Space page's 3D view: from each driver that plays that band, where it
// sits, where it points, the angles where it falls 6 dB, wide and high, by the coverage model's driver pattern
// (spaceCoverage), and how far it stays as loud as the map's target. Pure.
import type { CoverageBand } from "../../types";
import {
  bandCenterHz,
  bandRangeHz,
  coverageFrequencies,
  type CoveragePattern,
} from "../acoustics/coverage";
import { pistonPattern, waveguideHalfAngles } from "../acoustics/directivity";
import { abs } from "../acoustics/complex";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import { driverPattern, spaceOutputs, voiceId, type SpaceModel } from "./spaceCoverage";
import { bandPassband, playsInBand } from "./spaceBalance";
import type { RoomPoint } from "./spaceLayout";

/** Where a piston's pattern, 2·J1(x)/x, falls 6 dB (to one half): x ≈ 2.215, by bisection on its first lobe. */
const PISTON_X6 = (() => {
  let lo = 0,
    hi = 3.8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pistonPattern(mid) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/**
 * A pattern's half angles at `f`, radians, wide and high: where it falls 6 dB off its axis. A horn's are its own (wider
 * below its mouth's control); a piston's are where ka·sin θ reaches the −6 dB point, and a quarter turn where it
 * never falls that far in front.
 */
export function beamHalfAngles(pattern: CoveragePattern, f: number): [h: number, v: number] {
  if (pattern.horn) {
    const { covH, covV, wIn, hIn } = pattern.horn;
    const [h, v] = waveguideHalfAngles(f, covH, covV, wIn, hIn);
    return [Math.min(h, Math.PI / 2), Math.min(v, Math.PI / 2)];
  }
  const ka = ((2 * Math.PI * f) / SPEED_OF_SOUND) * pattern.a;
  const half = ka > PISTON_X6 ? Math.asin(PISTON_X6 / ka) : Math.PI / 2;
  return [half, half];
}

/**
 * One driver's beam: where it starts (the driver, ft), its axis (radians), its half angles (radians), and how far along
 * its axis it stays as loud as the map's target, ft.
 */
export interface SpaceBeam {
  at: RoomPoint;
  yaw: number;
  pitch: number;
  half: [h: number, v: number];
  reachFt: number;
}

/**
 * Each driver's beam in the band on show (or at the one frequency): one from each driver whose band plays there (in a
 * band, its passband overlaps the band's range; at one frequency, any driver), as loud on its axis as the map radiates
 * it (its voice's output at the map's frequencies, the mean square by their shares). It reaches where that level,
 * falling 6 dB each time the distance doubles, meets `targetDb` (the map's target, on the grid's scale); a driver that
 * never reaches the target has none. Its angles are at the band's center (or the one frequency), a quarter turn at
 * most.
 */
export function spaceBeams(
  model: Pick<SpaceModel, "placements" | "feeds" | "headroomDb" | "scene">,
  band: CoverageBand,
  freqHz: number,
  targetDb: number,
): SpaceBeam[] {
  const { freqs, shares } = coverageFrequencies(
    band,
    freqHz,
    model.scene.modal?.crossoverHz ?? null,
  );
  /** each voice's mean square at 1 m on its axis, each frequency by its share, as the map sums it */
  const power = new Map<string, number>();
  freqs.forEach((f, i) => {
    for (const [id, p] of Object.entries(spaceOutputs(model, f)))
      if (p) power.set(id, (power.get(id) ?? 0) + shares[i] * abs(p) ** 2);
  });
  const totalShare = Math.max(
    1,
    shares.reduce((sum, share) => sum + share, 0),
  );
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
      const p = (power.get(voiceId(box, d)) ?? 0) / totalShare;
      if (p <= 0) return [];
      /** where the level on the axis falls to the target, m: 1 m at the target, twice as far each 6 dB louder */
      const reachM = Math.pow(10, (10 * Math.log10(p) - targetDb) / 20);
      if (reachM < 1) return [];
      return [
        {
          at: d.at,
          yaw: d.yaw,
          pitch: d.pitch,
          half: beamHalfAngles(driverPattern(d), f),
          reachFt: reachM / METERS_PER_FOOT,
        },
      ];
    }),
  );
}
