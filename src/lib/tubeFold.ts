// How a round port tube fits a box: straight off the baffle while it fits, then one elbow up the back wall, then a
// second that turns it forward again. One rule for the PA sub's tubes and the Hi-fi port (each passes its own room).
// Lengths are the tube's centerline in inches, measured from the baffle front to the mouth, with each elbow taken as a
// sharp corner (the bend correction, SHARP_BEND_CORRECTION, is against that same centerline).
import type { ElbowCount } from "../types";

export type { ElbowCount };

/**
 * The room a tube's centerline has in a box, inches: `run` from the baffle front to the back wall, `rise` from the
 * tube's axis to the wall the riser heads for (a PA sub's lid), and `stop`, how far behind the baffle front anything
 * stands that the riser must stay behind and the return leg's mouth must keep clear of (a PA sub's driver; 0 for none).
 */
export interface TubeRoom {
  run: number;
  rise: number;
  stop: number;
}

/** The most elbows a tube takes. */
export const MAX_ELBOWS = 2;
/** Every elbow count a tube can take, fewest first. */
export const ELBOW_COUNTS = [0, 1, 2] as const satisfies readonly ElbowCount[];

/**
 * The legs a tube's centerline takes, inches: `run` straight back from the baffle front, `rise` up past the first
 * elbow, `back` forward again past the second; and `gap`, what the mouth faces: the wall, lid or stop it opens toward.
 */
export interface TubeLegs {
  run: number;
  rise: number;
  back: number;
  gap: number;
}

// Every mouth keeps a diameter of open air in front of it (to the wall, the lid or the stop), and every leg past an
// elbow is at least a diameter long (about a fitting's center-to-end), so a fitting always has pipe to grip.
const mouthGap = (dia: number) => dia;
const legMin = (dia: number) => dia;

/**
 * The lengths a tube of diameter `dia` fits with `e` elbows, [shortest, longest], or null when it can't take that many.
 * Straight: up to a diameter short of the back wall. One elbow: the riser stands against the back wall (or further
 * forward for a shorter tube, never in front of the stop) and rises to a diameter under the lid. Two: the riser runs
 * all the way up and the return leg runs forward under the lid, its mouth a diameter behind the stop.
 */
export function tubeSpan(room: TubeRoom, dia: number, e: ElbowCount): [number, number] | null {
  const g = mouthGap(dia),
    m = legMin(dia),
    r = dia / 2;
  const back = room.run - r; // the riser's axis against the back wall
  const span = (a: number, b: number): [number, number] | null => (b >= a ? [a, b] : null);
  if (e === 0) return span(0, room.run - g);
  // one elbow: a riser at least a leg long under the lid's gap, standing behind the stop and in front of the back wall
  if (e === 1)
    return room.rise - g < m || room.stop + r > back
      ? null
      : span(room.stop + r + m, back + room.rise - g);
  // two elbows: the riser's whole height, the return leg forward from the riser's axis to its mouth
  const rise = room.rise - r;
  if (rise < m) return null;
  return span(room.stop + g + 2 * m + rise, back + rise + (back - room.stop - g));
}

/** The fewest elbows whose span holds `len`, or null when no count does (too long, or in a gap between them). */
export function tubeElbows(room: TubeRoom, dia: number, len: number): ElbowCount | null {
  for (const e of ELBOW_COUNTS) {
    const s = tubeSpan(room, dia, e);
    if (s && len >= s[0] - 1e-9 && len <= s[1] + 1e-9) return e;
  }
  return null;
}

/** The spans a tube fits, shortest first, overlapping ones merged: the lengths it can take with some elbow count. */
export const tubeSpans = (room: TubeRoom, dia: number) =>
  mergeSpans(
    ELBOW_COUNTS.map((e) => tubeSpan(room, dia, e)).filter(
      (s): s is [number, number] => s !== null,
    ),
  );

/** The longest tube the room holds with up to `e` elbows (0 when none fits). */
export const tubeMaxLength = (room: TubeRoom, dia: number, e: ElbowCount = MAX_ELBOWS) =>
  Math.max(0, ...ELBOW_COUNTS.filter((k) => k <= e).map((k) => tubeSpan(room, dia, k)?.[1] ?? 0));

/**
 * How a tube `len` long is built with `e` elbows: the riser against the back wall and the return leg as short as the
 * length allows, each pulled forward only as far as a shorter tube needs. Outside the span the legs are clamped.
 */
export function tubeLegs(room: TubeRoom, dia: number, len: number, e: ElbowCount): TubeLegs {
  const r = dia / 2,
    m = legMin(dia);
  const back = room.run - r;
  if (e === 0) return { run: len, rise: 0, back: 0, gap: room.run - len };
  if (e === 1) {
    const run = Math.max(room.stop + r, Math.min(back, len - m));
    const rise = len - run;
    return { run, rise, back: 0, gap: room.rise - rise };
  }
  const rise = room.rise - r;
  const run = Math.max(room.stop + mouthGap(dia) + m, Math.min(back, len - rise - m));
  const ret = len - run - rise;
  return { run, rise, back: ret, gap: run - ret - room.stop };
}

/**
 * Each count's span cut to the lengths where it is the fewest that fit (tubeElbows' count, which the model takes),
 * starting `step` past the longest of the fewer counts: shortest first, never overlapping, so a solver tunes each count
 * on its own (each elbow's bend correction is a step in the tuning). `spans` is indexed by elbow count.
 */
export function ownSpans(
  spans: readonly (readonly [number, number] | null)[],
  step = 1e-9,
): { e: ElbowCount; span: [number, number] }[] {
  const out: { e: ElbowCount; span: [number, number] }[] = [];
  let end = -Infinity;
  for (const e of ELBOW_COUNTS) {
    const s = spans[e];
    if (!s) continue;
    const a = Math.max(s[0], end + step);
    if (s[1] >= a) out.push({ e, span: [a, s[1]] });
    end = Math.max(end, s[1]);
  }
  return out;
}

/** Spans sorted shortest first, with overlapping ones merged. */
export function mergeSpans(spans: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-9) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
