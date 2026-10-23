// A horn's flare sections as the Speaker page's Horn settings show and edit them: areas in in² and lengths in in, the
// spec's own cm² and cm (the horn engine's, Hornresp's) converted here only. Pure.
import { clamp } from "../../lib/clamp";
import type { HornSegment, SpeakerHorn } from "../../types";
import { CM_PER_IN, CM2_PER_IN2 } from "../../constants/units";
import { shownIn, shownTenth } from "./speakerFields";
import { throatAreaCm2 } from "../../lib/speaker/hornThroat";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { HORN_DRIVE } from "../../constants/speakerSpec";

/** A new section's end area over its start area: it doubles, as a flare step. */
const NEW_SECTION_AREA_RATIO = 2;

/**
 * Two areas this close, in², are one joint: half the area fields' last digit (they show the tenth, `shownIn2`), so a
 * shown value typed back in meets the area it came from.
 */
const SAME_AREA_IN2 = 0.05;

/** A section's size the settings edit, by the spec's field: start area, end area, length. */
export type HornSectionSize = keyof Pick<HornSegment, "s1" | "s2" | "length">;

/** An area in cm² (the spec's) as a field shows it, in², to the tenth. */
export const shownIn2 = (cm2: number) => shownTenth(cm2 / CM2_PER_IN2);

/** A length in cm (the spec's) as a field shows it, in, to the hundredth. */
export const shownInOfCm = (cm: number) => shownIn(cm / CM_PER_IN);

/** A size typed in a field (in² for an area, in for a length) in the spec's cm² or cm. */
export const specSize = (size: HornSectionSize, typed: number) =>
  size === "length" ? typed * CM_PER_IN : typed * CM2_PER_IN2;

/** Whether two areas, cm², meet as one joint: they show the same to the fields' precision. */
const sameArea = (a: number, b: number) =>
  Math.abs(a - b) <= SAME_AREA_IN2 * CM2_PER_IN2 * (1 + 1e-9); // the factor: float noise at the edge

/** Whether section `i + 1` starts where section `i` ends (false for the last section). */
export const joinsNext = (segments: readonly HornSegment[], i: number) => {
  const s = segments[i];
  const next = segments[i + 1];
  return !!s && !!next && sameArea(next.s1, s.s2);
};

/**
 * The sections with section `i`'s `size` set to `typed` (in² or in, as the field shows it). The sections chain: a new
 * end area moves the next section's start with it when the two were `joined` (the caller passes whether they were
 * when the edit began, so a value typed on the way, such as the "50" in "500", doesn't join a stepped pair; absent:
 * as the sections are now). An area typed within the fields' precision of the area it meets snaps to it. A start area
 * that differs from the previous end is a step, as Hornresp takes it.
 */
export function withSectionSize(
  segments: readonly HornSegment[],
  i: number,
  size: HornSectionSize,
  typed: number,
  joined = joinsNext(segments, i),
): HornSegment[] {
  const typedValue = specSize(size, typed);
  /** the area it meets across the joint: the previous end for a start, the next start for an end */
  const meets =
    size === "s1" ? segments[i - 1]?.s2 : size === "s2" ? segments[i + 1]?.s1 : undefined;
  const value = meets !== undefined && sameArea(typedValue, meets) ? meets : typedValue;
  return segments.map((s, k) => {
    if (k === i) return { ...s, [size]: value };
    // the next section started where this one ended: it follows the new end
    if (size === "s2" && joined && k === i + 1) return { ...s, s1: value };
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

/** How many sections start with a step (`stepsIn`). */
export const stepCount = (segments: readonly HornSegment[]) =>
  segments.filter((_, i) => stepsIn(segments, i)).length;

/**
 * Whether Steps is on, given whether it was on and the sections now: once on it stays on (a step typed back to the
 * previous end keeps its start area field), and a step turns it on. Only the user turns it off.
 */
export const stepsLatched = (on: boolean, segments: readonly HornSegment[]) =>
  on || stepCount(segments) > 0;

/** The sections smooth: each start area after the first set to the previous section's end area, so no step is left. */
export const withStepsSmoothed = (segments: readonly HornSegment[]): HornSegment[] =>
  segments.map((s, i) => {
    const before = segments[i - 1];
    return before && s.s1 !== before.s2 ? { ...s, s1: before.s2 } : s;
  });

/** The horn's path length, in, as the summary shows it: every section's length together. */
export const pathIn = (horn: Pick<SpeakerHorn, "segments">) =>
  shownInOfCm(horn.segments.reduce((sum, s) => sum + s.length, 0));

/**
 * The sections with the throat (the first section's start area) set from the compression ratio: the cones' area
 * `conesCm2` over `ratio` (lib/speaker/hornThroat). The throat area field and the ratio edit this one figure.
 */
export const withCompressionRatio = (
  segments: readonly HornSegment[],
  conesCm2: number,
  ratio: number,
): HornSegment[] =>
  segments.map((s, k) => (k === 0 ? { ...s, s1: throatAreaCm2(conesCm2, ratio) } : s));

/** A section's area at `share` of its length from its start, cm², by its flare law (Hornresp's CON, EXP and PAR). */
export function areaAtShare(s: HornSegment, share: number): number {
  switch (s.profile) {
    case HORN_PROFILE.parabolic:
      return s.s1 + (s.s2 - s.s1) * share;
    case HORN_PROFILE.exponential:
      return s.s1 * Math.pow(s.s2 / s.s1, share);
    case HORN_PROFILE.conical: {
      const r1 = Math.sqrt(s.s1);
      return Math.pow(r1 + (Math.sqrt(s.s2) - r1) * share, 2);
    }
  }
}

/** The sections with the longest one split in two at its middle, along its own flare law: the same horn. */
function withLongestSplit(segments: readonly HornSegment[]): HornSegment[] {
  const longest = segments.reduce((at, s, i) => (s.length > segments[at].length ? i : at), 0);
  return segments.flatMap((s, i) => {
    if (i !== longest) return [s];
    const middle = areaAtShare(s, 0.5);
    return [
      { ...s, s2: middle, length: s.length / 2 },
      { ...s, s1: middle, length: s.length / 2 },
    ];
  });
}

/** How many sections each drive needs: a closed stub before an offset tap, a section between a tapped horn's taps. */
export const SECTIONS_NEEDED: Record<SpeakerHorn["drive"]["kind"], number> = {
  [HORN_DRIVE.front]: 1,
  [HORN_DRIVE.offset]: 2,
  [HORN_DRIVE.tapped]: 3,
  [HORN_DRIVE.back]: 1,
};

/**
 * The horn driven as `kind`: with too few sections for its taps, the longest splits in two until there are enough (the
 * horn stays the same); an offset horn's cones then open after the first section, a tapped horn's fronts after the
 * first and its backs before the last.
 */
export function withDriveKind(horn: SpeakerHorn, kind: SpeakerHorn["drive"]["kind"]): SpeakerHorn {
  let segments = [...horn.segments];
  if (segments.length === 0) return horn;
  while (segments.length < SECTIONS_NEEDED[kind]) segments = withLongestSplit(segments);
  const drive: SpeakerHorn["drive"] =
    kind === HORN_DRIVE.offset
      ? { kind, tap: 1 }
      : kind === HORN_DRIVE.tapped
        ? { kind, frontTap: 1, rearTap: segments.length - 1 }
        : { kind };
  return { ...horn, segments, drive };
}

/**
 * The drive with its taps moved back one where they came after removed section `i`, so they stay on their sections,
 * then kept between two of the `n` sections left (1 to n − 1), a tapped horn's front before its back.
 */
export function driveAfterRemoval(
  drive: SpeakerHorn["drive"],
  i: number,
  n: number,
): SpeakerHorn["drive"] {
  const moved = (tap: number) => (tap > i ? tap - 1 : tap);
  switch (drive.kind) {
    case HORN_DRIVE.offset:
      return { ...drive, tap: clamp(moved(drive.tap), 1, n - 1) };
    case HORN_DRIVE.tapped: {
      const frontTap = clamp(moved(drive.frontTap), 1, n - 2);
      return { ...drive, frontTap, rearTap: clamp(moved(drive.rearTap), frontTap + 1, n - 1) };
    }
    default:
      return drive;
  }
}
