// A horn's flare sections as the Designer's Horn settings show and edit them: areas in in² and lengths in in, the
// spec's own cm² and cm (the horn engine's, Hornresp's) converted here only. Pure.
import type { HornSegment, SpeakerHorn } from "../../types";
import { CM_PER_IN } from "../../constants/units";

/** Square centimeters in one square inch. */
const CM2_PER_IN2 = CM_PER_IN * CM_PER_IN;

/** A new section's end area over its start area: it doubles, as a flare step. */
const NEW_SECTION_AREA_RATIO = 2;

/** Two areas this close (as a share of the larger) are one joint: the sections chain there. */
const SAME_AREA = 1e-9;

/** A section's size the settings edit, by the spec's field: start area, end area, length. */
export type HornSectionSize = keyof Pick<HornSegment, "s1" | "s2" | "length">;

/** An area in cm² (the spec's) as a field shows it, in², to the hundredth. */
export const shownIn2 = (cm2: number) => Math.round((cm2 / CM2_PER_IN2) * 100) / 100;

/** A length in cm (the spec's) as a field shows it, in, to the hundredth. */
export const shownInOfCm = (cm: number) => Math.round((cm / CM_PER_IN) * 100) / 100;

/** A size typed in a field (in² for an area, in for a length) in the spec's cm² or cm. */
export const specSize = (size: HornSectionSize, typed: number) =>
  size === "length" ? typed * CM_PER_IN : typed * CM2_PER_IN2;

/** Whether two areas meet as one joint (the later section starts where the earlier ends). */
const sameArea = (a: number, b: number) =>
  Math.abs(a - b) <= SAME_AREA * Math.max(Math.abs(a), Math.abs(b));

/**
 * The sections with section `i`'s `size` set to `typed` (in² or in, as the field shows it). The sections chain: a new
 * end area moves the next section's start with it where the two met. A start area that differs from the previous end
 * is a step, as Hornresp takes it.
 */
export function withSectionSize(
  segments: readonly HornSegment[],
  i: number,
  size: HornSectionSize,
  typed: number,
): HornSegment[] {
  const value = specSize(size, typed);
  const old = segments[i];
  return segments.map((s, k) => {
    if (k === i) return { ...s, [size]: value };
    // the next section starts where this one ended: it follows the new end
    if (old && size === "s2" && k === i + 1 && sameArea(s.s1, old.s2)) return { ...s, s1: value };
    return s;
  });
}

/** The sections with section `i`'s flare law set. */
export const withSectionProfile = (
  segments: readonly HornSegment[],
  i: number,
  profile: HornSegment["profile"],
): HornSegment[] => segments.map((s, k) => (k === i ? { ...s, profile } : s));

/**
 * The sections with one more at the mouth: it starts at the last section's end area, has its flare law and length, and
 * ends at twice the area. Null when there is no section to follow.
 */
export function withSectionAdded(segments: readonly HornSegment[]): HornSegment[] | null {
  const last = segments.at(-1);
  if (!last) return null;
  return [
    ...segments,
    {
      profile: last.profile,
      s1: last.s2,
      s2: last.s2 * NEW_SECTION_AREA_RATIO,
      length: last.length,
    },
  ];
}

/**
 * The sections without section `i`. Where the next section started at the removed one's end, it now starts at the
 * removed one's start, so the path stays joined (and the throat stays the throat when the first goes).
 */
export function withSectionRemoved(segments: readonly HornSegment[], i: number): HornSegment[] {
  const gone = segments[i];
  return segments.flatMap((s, k) => {
    if (k === i) return [];
    if (gone && k === i + 1 && sameArea(s.s1, gone.s2)) return [{ ...s, s1: gone.s1 }];
    return [s];
  });
}

/** Whether section `i` starts with a step: its start area is not the previous section's end area. */
export const stepsIn = (segments: readonly HornSegment[], i: number) => {
  const before = segments[i - 1];
  const s = segments[i];
  return !!before && !!s && !sameArea(s.s1, before.s2);
};

/** The horn's path length, in, as the summary shows it: every section's length together. */
export const pathIn = (horn: Pick<SpeakerHorn, "segments">) =>
  shownInOfCm(horn.segments.reduce((sum, s) => sum + s.length, 0));
