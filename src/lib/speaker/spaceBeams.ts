// Each box's beam in a band, for the Space page's 3D view: where the box's drivers in the band sit, where they point,
// and the angles where they fall 6 dB, wide and high, by the coverage model's driver pattern (spaceCoverage). Pure.
import type { CoverageBand } from "../../types";
import { bandCenterHz, type CoveragePattern } from "../acoustics/coverage";
import { pistonPattern, waveguideHalfAngles } from "../acoustics/directivity";
import { abs } from "../acoustics/complex";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { driverPattern, pressureAt, type SpaceModel } from "./spaceCoverage";
import type { PlacedDriver, RoomPoint } from "./spaceLayout";

/** A box quieter than this under the loudest box in the band draws no beam, dB. */
const BEAM_QUIET_DB = 20;

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

/** One box's beam: where it starts (its drivers' middle, ft), its axis (radians), and its half angles (radians). */
export interface SpaceBeam {
  at: RoomPoint;
  yaw: number;
  pitch: number;
  half: [h: number, v: number];
}

/**
 * Each box's beam in the band on show (at its center, or at the one frequency): each member of each placement beams
 * with its band loudest there, from that band's drivers. A box more than `BEAM_QUIET_DB` under the loudest has none.
 */
export function spaceBeams(
  model: Pick<SpaceModel, "placements" | "solved">,
  band: CoverageBand,
  freqHz: number,
): SpaceBeam[] {
  const f = bandCenterHz(band, freqHz);
  const found = model.placements.flatMap(({ item, response }) => {
    if (!response || !item.stack) return [];
    const placementDb = model.solved[item.placement.source]?.levelDb ?? 0;
    return response.members.flatMap((member, m) => {
      if (!member) return [];
      const levelDb = (item.stack?.stack.members[m]?.levelDb ?? 0) + placementDb;
      const loudest = member.response.bands
        .map((b) => ({
          drivers: item.drivers.filter((d) => d.member === m && d.band === b.id),
          level: abs(pressureAt(b.pressure, f)) * Math.pow(10, levelDb / 20),
        }))
        .filter((b) => b.drivers.length > 0)
        .reduce<{ drivers: PlacedDriver[]; level: number } | null>(
          (a, b) => (a && a.level >= b.level ? a : b),
          null,
        );
      return loudest ? [loudest] : [];
    });
  });
  const top = Math.max(0, ...found.map((b) => b.level));
  return found
    .filter((b) => b.level > 0 && b.level >= top * Math.pow(10, -BEAM_QUIET_DB / 20))
    .map(({ drivers }) => {
      const [first] = drivers;
      const mean = (pick: (p: RoomPoint) => number) =>
        drivers.reduce((s, d) => s + pick(d.at), 0) / drivers.length;
      return {
        at: { x: mean((p) => p.x), y: mean((p) => p.y), z: mean((p) => p.z) },
        yaw: first.yaw,
        pitch: first.pitch,
        half: beamHalfAngles(driverPattern(first), f),
      };
    });
}
