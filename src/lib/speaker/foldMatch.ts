// How a folded horn's traced passage compares with the straight horn it should follow: the straight horn's area along
// its length, and how far the traced areas stray from it. Pure; the path chart, the editor and the fold layout search
// read it.
import type { FoldPathSection, HornSegment } from "../../types";
import { CM2_PER_IN2, CM_PER_IN } from "../../constants/units";
import { isSizedSegment, segmentAreaAt } from "../acoustics/hornSegments";

/** A point along a path: the distance from the closed end (or the throat), in, and the area there, in². */
type PathPoint = Pick<FoldPathSection, "sIn" | "areaIn2">;

/** The target line is sampled about this often along each segment, in. */
const TARGET_STEP_IN = 0.5;

/**
 * The straight horn's area along its length, sampled about every `TARGET_STEP_IN` and at each segment's ends, with the
 * distance from the throat in inches and the area in in². Each segment follows its own flare (`segmentAreaAt`). A
 * segment without sizes (a gap) is left out, so the line never carries NaN.
 */
export function targetPathPoints(target: readonly HornSegment[]): PathPoint[] {
  const points: PathPoint[] = [];
  let startCm = 0;
  for (const segment of target.filter(isSizedSegment)) {
    const steps = Math.max(1, Math.ceil(segment.length / CM_PER_IN / TARGET_STEP_IN));
    for (let k = 0; k <= steps; k++) {
      const alongCm = (k / steps) * segment.length;
      points.push({
        sIn: (startCm + alongCm) / CM_PER_IN,
        areaIn2: segmentAreaAt(segment, alongCm) / CM2_PER_IN2,
      });
    }
    startCm += segment.length;
  }
  return points;
}

/**
 * How far the traced passage strays from the straight horn, dB: the rms of 20·log10 of their areas' ratio at each traced
 * section along both; null when they share no length.
 */
export function offTargetDb(
  sections: readonly PathPoint[],
  target: readonly HornSegment[],
): number | null {
  const points = targetPathPoints(target);
  const end = points.length ? points[points.length - 1].sIn : 0;
  const ratios = sections.flatMap((q) => {
    if (q.sIn > end || q.areaIn2 <= 0) return [];
    const after = points.findIndex((p) => p.sIn >= q.sIn);
    if (after < 0) return [];
    const p0 = points[Math.max(0, after - 1)];
    const p1 = points[after];
    const k = p1.sIn > p0.sIn ? (q.sIn - p0.sIn) / (p1.sIn - p0.sIn) : 0;
    const area = p0.areaIn2 + (p1.areaIn2 - p0.areaIn2) * k;
    return area > 0 ? [20 * Math.log10(q.areaIn2 / area)] : [];
  });
  if (!ratios.length) return null;
  return Math.sqrt(ratios.reduce((sum, r) => sum + r * r, 0) / ratios.length);
}
