// Each box's beams in the map's band, for the Space page's 3D view: from the drivers that play that band as the map
// sums it, where they sit, where they point, the angles where they fall 6 dB, wide and high, by the coverage model's
// driver pattern (spaceCoverage), and how far they stay as loud as the map's target. Pure.
import type { CoverageBand } from "../../types";
import { bandCenterHz, coverageFrequencies, type CoveragePattern } from "../acoustics/coverage";
import { pistonPattern, waveguideHalfAngles } from "../acoustics/directivity";
import { abs } from "../acoustics/complex";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { METERS_PER_FOOT } from "../../constants/units";
import { driverPattern, spaceOutputs, type SpaceModel } from "./spaceCoverage";
import type { PlacedDriver, RoomPoint } from "./spaceLayout";

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
 * One box's beam: where it starts (its drivers' middle, ft), its axis (radians), its half angles (radians), and how far
 * along its axis it stays as loud as the map's target, ft.
 */
export interface SpaceBeam {
  at: RoomPoint;
  yaw: number;
  pitch: number;
  half: [h: number, v: number];
  reachFt: number;
}

/**
 * Each box's beams in the band on show: one from each band of each member that plays it, as loud on its axis as the
 * map sums it (`spaceOutputs` at the map's frequencies, each with its share of the band's weight). Each reaches where
 * that level, falling 6 dB each time the distance doubles, meets `targetDb` (the map's target, on the grid's scale). A
 * band that never reaches the target has none, and so does one that spreads every way (it never falls 6 dB in front).
 * Its angles are at the band's center (or the one frequency).
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
  /** each box's member's band (by `box/member/band`): its power at 1 m on its axis, summed by each frequency's share */
  const power = new Map<string, number>();
  freqs.forEach((f, i) => {
    const out = spaceOutputs(model, f);
    /** each band's level at `f`: a spot's output over its share of the band */
    const level = new Map<string, number>();
    for (const v of model.feeds) {
      const p = out[v.id];
      if (!p) continue;
      const key = `${v.box}/${v.member}/${v.band}`;
      level.set(key, Math.max(level.get(key) ?? 0, abs(p) / v.share));
    }
    for (const [key, a] of level) power.set(key, (power.get(key) ?? 0) + shares[i] * a * a);
  });
  // the band average, as the map takes it: the mean square by the shares
  const totalShare = Math.max(
    1,
    shares.reduce((sum, share) => sum + share, 0),
  );
  const f = bandCenterHz(band, freqHz);
  return model.placements.flatMap(({ item }, box) => {
    /** the drivers of each band, in the order the box lists them */
    const groups = new Map<string, PlacedDriver[]>();
    for (const d of item.drivers) {
      const key = `${box}/${d.member}/${d.band}`;
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    return [...groups].flatMap(([key, drivers]): SpaceBeam[] => {
      const p = (power.get(key) ?? 0) / totalShare;
      if (p <= 0) return [];
      /** where the level on the axis falls to the target, m: 1 m at the target, twice as far each 6 dB louder */
      const reachM = Math.pow(10, (10 * Math.log10(p) - targetDb) / 20);
      const [first] = drivers;
      const half = beamHalfAngles(driverPattern(first), f);
      if (reachM < 1 || half.every((a) => a >= Math.PI / 2)) return [];
      const mean = (pick: (p: RoomPoint) => number) =>
        drivers.reduce((s, d) => s + pick(d.at), 0) / drivers.length;
      return [
        {
          at: { x: mean((p) => p.x), y: mean((p) => p.y), z: mean((p) => p.z) },
          yaw: first.yaw,
          pitch: first.pitch,
          half,
          reachFt: reachM / METERS_PER_FOOT,
        },
      ];
    });
  });
}
