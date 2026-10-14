// The goals as the Speaker and Stack optimizers score them (docs/speaker-designer-plan.md, "Design: the Speaker
// optimizer" and "Design: the Stack optimizer"): a design's numbers, each goal's objective and the margin that makes one
// design beat another, the alternatives' order, the first card's heading, and the last check on the cards. Pure.
import type { SpeakerGoal } from "../../../types";
import type { CardRole, SelectedCard } from "../../optimizer/selectCards";
import { keysOf } from "../../records";
import {
  SPEAKER_GOAL,
  SPEAKER_GOAL_ALSO,
  SPEAKER_GOAL_MISSING,
  SPEAKER_GOAL_THAN,
} from "../../../constants/speakerOptimizer";

/** A target within this of your design's level is your level, dB: the first card's heading says "Same level". */
export const SAME_LEVEL_DB = 0.05;
/** Alternatives stay within this of the target level, dB (as the PA optimizer's). */
export const ALT_LEVEL_DB = 1.5;
/** Two designs whose volumes differ less than this share are the same box, unless a part differs. */
export const SAME_VOLUME = 0.15;
/** The share a smaller design must save, and the weight a lighter one must: 5% of yours, 1 to 3 lb. */
const SMALLER_SHARE = 0.05;
const LIGHTER_LB = { share: 0.05, min: 1, max: 3 };

/** A design's numbers as the goals compare them: no level is −∞, no F3 +∞. */
export interface Metric {
  price: number;
  /** the parts with no price (`SpeakerEval.unpriced`): two prices compare only when these are the same */
  unpriced: string;
  lb: number;
  volumeL: number;
  musicDb: number;
  f3: number;
  /** what it changes (parts, box size, vents), its warnings, its amps' total power */
  ch: number;
  w: number;
  ampW: number;
}

/** Each goal's objective: lower is better; warnings and changes nudge, as on the PA page. */
export const OBJECTIVE: Record<SpeakerGoal, (x: Metric) => number> = {
  cheaper: (x) => 1e6 * x.w + x.price + 1e-6 * x.lb + 1e-8 * x.ch,
  lighter: (x) => x.lb + 0.5 * x.ch + 2 * x.w,
  smaller: (x) => x.volumeL * (1 + 0.005 * x.ch + 0.02 * x.w),
  lower: (x) => x.f3 + 0.1 * x.ch + 0.7 * x.w,
  louder: (x) => -x.musicDb + 0.05 * x.ch + 0.5 * x.w,
};

/** Design `a` beats `b` on a goal by a margin that matters (a price with a missing part can't be compared). */
export const BEATS: Record<SpeakerGoal, (a: Metric, b: Metric) => boolean> = {
  cheaper: (a, b) => a.price < b.price && unpricedWithin(a.unpriced, b.unpriced),
  lighter: (a, b) =>
    a.lb <= b.lb - Math.min(LIGHTER_LB.max, Math.max(LIGHTER_LB.min, LIGHTER_LB.share * b.lb)),
  smaller: (a, b) => a.volumeL <= b.volumeL * (1 - SMALLER_SHARE),
  lower: (a, b) => a.f3 <= b.f3 - 2,
  louder: (a, b) => a.musicDb >= b.musicDb + 1,
};

/**
 * Whether design `a`'s unpriced parts are all `b`'s too: then `a`'s known total under `b`'s means it is cheaper (each
 * total leaves out only its unpriced parts, and `b` leaves out at least as much).
 */
function unpricedWithin(a: string, b: string): boolean {
  if (!a) return true;
  const of = new Set(b.split("|"));
  return a.split("|").every((m) => of.has(m));
}

/** The alternatives' order after the first goal (then every goal), as the PA optimizer's. */
const ALT_ORDER: Record<SpeakerGoal, SpeakerGoal[]> = {
  cheaper: ["lighter", "smaller", "louder"],
  lighter: ["cheaper", "smaller", "louder"],
  smaller: ["lighter", "cheaper", "louder"],
  lower: ["louder", "cheaper"],
  louder: ["cheaper", "lighter"],
};

/** The axes the alternatives come from: the stacked goals, then the first goal's order, then every goal. */
export const altAxesOf = (goals: readonly SpeakerGoal[]): SpeakerGoal[] => {
  const [goal, ...also] = goals;
  return [...(also.length ? goals : []), ...ALT_ORDER[goal], ...keysOf(SPEAKER_GOAL)].filter(
    (a, i, arr) => arr.indexOf(a) === i && (also.length > 0 || a !== goal),
  );
};

/** A goal's words for the first card: its button word, its heading at your level and at a typed target, its sentence. */
export type GoalWords = Record<
  SpeakerGoal,
  { short: string; name: string; atTarget: string; why: string }
>;

/** The first card's heading and sentence: "Same level, …" only when the target is your level; stacked goals joined. */
export function firstCardRole(
  goals: readonly SpeakerGoal[],
  sameLevel: boolean,
  words: GoalWords,
): CardRole {
  const [goal, ...also] = goals;
  const label = also.length
    ? goals.map((g, i) => (i ? SPEAKER_GOAL_THAN[g] : words[g].short)).join(" + ")
    : sameLevel
      ? words[goal].name
      : words[goal].atTarget;
  const why = also.length
    ? `${words[goal].why.replace(/\.$/, "")}, and ${also.map((g) => SPEAKER_GOAL_ALSO[g]).join(" and ")} than your design.`
    : words[goal].why;
  return { label, why };
}

/** The notice when nothing beats your design on the goals and yours keeps them. */
export const nothingBeatsText = (goals: readonly SpeakerGoal[]): string =>
  goals.length > 1
    ? `Nothing ${goals.map((g) => SPEAKER_GOAL_THAN[g]).join(" and ")} than your design passes the checks.`
    : SPEAKER_GOAL_MISSING[goals[0]];

/** What the last check reads. */
interface CardChecks<P> {
  meets: (p: P) => boolean;
  beatsCurrent: (g: SpeakerGoal, p: P) => boolean;
  beats: (g: SpeakerGoal, a: P, b: P) => boolean;
  passes: (p: P) => boolean;
  goals: readonly SpeakerGoal[];
}

/**
 * The cards that keep their slot's promises on their own design: every card passes the checks and the limits; the
 * first keeps the goals and beats your design on each; the smallest change does too; an alternative beats your design
 * and the first card on its goal. The ones that don't are dropped and counted.
 */
export function checkCards<P>(
  cards: readonly SelectedCard<P, SpeakerGoal>[],
  c: CardChecks<P>,
): { kept: SelectedCard<P, SpeakerGoal>[]; dropped: number } {
  const first = cards.find((k) => k.slot.kind === "first");
  const kept = cards.filter((k) => {
    if (!c.passes(k.p)) return false;
    const beatsAll = c.goals.every((g) => c.beatsCurrent(g, k.p));
    switch (k.slot.kind) {
      case "first":
      case "smallest":
        return c.meets(k.p) && beatsAll;
      case "fix":
        return c.meets(k.p);
      case "closest":
        return true;
      case "alt":
        return c.beatsCurrent(k.slot.axis, k.p) && (!first || c.beats(k.slot.axis, k.p, first.p));
    }
  });
  return { kept, dropped: cards.length - kept.length };
}
