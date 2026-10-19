// The Stack optimizer's full evaluation: a stack design through the page's own code (stackResponse, stackLimits, the
// stack's height, each member's speaker on its crossover through the Speaker optimizer's evaluation), its numbers, its
// warnings and what it fails against your stack and the limits. Every card and the near miss read these, on the design
// as the card loads it. Pure.
import type {
  SpeakerSpec,
  StackDesign,
  StackLimits,
  StackMember,
  StackOptimizerLimits,
  StackOptimizerMetrics,
  StackResponse,
} from "../../../types";
import { memberSpeaker, stackLimits, stackResponse } from "../stackResponse";
import { passbandDb } from "../speakerResponse";
import { stackHeightIn } from "../speakerTotals";
import { keepUpChip, stackKeepUps } from "../keepUp";
import { KEEP_UP_SLACK_DB } from "../chips";
import { keysOf } from "../../records";
import { STACK_PROBLEM } from "../../../constants/stackOptimizer";
import {
  SIZE_SLACK_IN,
  evaluateSpeaker,
  problemsOf,
  speakerF3,
  type SizeCaps,
  type SpeakerEval,
} from "./evaluate";

/** What a stack fails, by id (`STACK_PROBLEM`). */
export type StackProblem = (typeof STACK_PROBLEM)[keyof typeof STACK_PROBLEM];

/** A stack design through the page's code: the runs, each member's speaker, the numbers and the warnings. */
export interface StackEval {
  design: StackDesign;
  response: StackResponse;
  limits: StackLimits;
  /** each member's speaker on its crossover (`memberSpeaker`), as the Speaker optimizer runs it; null: no speaker */
  members: (SpeakerEval | null)[];
  metrics: StackOptimizerMetrics;
  /** each band that limits first, in a box or between boxes (keep-up), in words */
  warnings: string[];
  /** the purchased parts with no price, by model, of every member: two prices compare only when these are the same */
  unpriced: string;
}

/** A member's speaker in the design; null when the design has none under its id. */
export const speakerOf = (
  design: Pick<StackDesign, "speakers">,
  member: Pick<StackMember, "speakerId">,
): SpeakerSpec | null => design.speakers.find((s) => s.id === member.speakerId) ?? null;

/** Each member's speaker name, as the warnings name a box. */
const memberName = (design: StackDesign, k: number) => {
  const m = design.stack.members[k];
  return (m && speakerOf(design, m)?.name) ?? `${k + 1}`;
};

/**
 * The full evaluation of a stack design, as the Stack page shows it. `known` gives a member's speaker run where the
 * search has it already (the same speaker on the same crossover); the others run here.
 */
export function evaluateStack(
  design: StackDesign,
  known: readonly (SpeakerEval | null | undefined)[] = [],
): StackEval {
  const members = design.stack.members.map((m, k) => {
    const speaker = speakerOf(design, m);
    return speaker ? (known[k] ?? evaluateSpeaker(memberSpeaker(m, speaker))) : null;
  });
  const response = stackResponse(design.stack, design.speakers);
  const limits = stackLimits(design.stack, response);
  let price = 0,
    pricePartial = false,
    lb = 0,
    volumeL = 0;
  for (const ev of members) {
    if (!ev) continue;
    price += ev.metrics.price;
    pricePartial ||= ev.metrics.pricePartial;
    lb += ev.metrics.lb;
    volumeL += ev.metrics.volumeL;
  }
  // a box's warnings name its speaker; a speaker two members share on one crossover says it once
  const inBoxes = members.flatMap((ev, k) =>
    ev ? ev.warnings.map((w) => `${memberName(design, k)}: ${w}`) : [],
  );
  const between = stackKeepUps(design.stack, response, limits)
    .filter((c) => c.gapDb < -KEEP_UP_SLACK_DB)
    .map((c) => keepUpChip(c, memberName(design, c.lower), memberName(design, c.upper))[1]);
  return {
    design,
    response,
    limits,
    members,
    metrics: {
      price,
      pricePartial,
      lb,
      volumeL,
      heightIn: stackHeightIn(design.stack, design.speakers),
      musicDb: limits.musicDb,
      member: limits.member,
      band: limits.band,
      f3: speakerF3({ bands: response.members.flatMap((m) => (m ? m.response.bands : [])) }),
      boxes: members.map((ev) =>
        ev ? { lb: ev.metrics.lb, sizeIn: ev.metrics.sizeIn, volumeL: ev.metrics.volumeL } : null,
      ),
    },
    warnings: [...new Set([...inBoxes, ...between])],
    unpriced: [...new Set(members.flatMap((ev) => (ev?.unpriced ? ev.unpriced.split("|") : [])))]
      .sort()
      .join("|"),
  };
}

/** Each member's headroom for music over the stack's input, dB: its speaker's weakest band less its level. */
export const memberRoomDb = (ev: SpeakerEval, levelDb: number): number | null =>
  ev.metrics.musicDb === null ? null : ev.metrics.musicDb - passbandDb(ev.response.sum) - levelDb;

/**
 * What the design fails: each member against yours (`problemsOf`: the model, the fits, the vents, the fit chips, the
 * weight of its box, its speaker's size locks, by speaker id in `caps`), a member the model no longer runs, the budget
 * on every member's parts and the stack's height. Your stack against itself fails only the limits.
 */
export function stackProblemsOf(
  ev: StackEval,
  start: StackEval,
  limits: Pick<StackOptimizerLimits, "budget" | "maxLb" | "maxHeightIn">,
  caps: ReadonlyMap<SpeakerSpec["id"], SizeCaps>,
): StackProblem[] {
  const out = new Set<StackProblem>();
  start.members.forEach((was, k) => {
    const now = ev.members[k];
    if (!was || !start.response.members[k]) return;
    if (!now || !ev.response.members[k]) {
      out.add(STACK_PROBLEM.unmodeled);
      return;
    }
    const id = ev.design.stack.members[k]?.speakerId ?? "";
    for (const p of problemsOf(now, was, { budget: null, maxLb: limits.maxLb }, caps.get(id) ?? {}))
      out.add(p);
  });
  if (limits.budget !== null && ev.metrics.price > limits.budget + 1e-9)
    out.add(STACK_PROBLEM.budget);
  if (limits.maxHeightIn !== null && ev.metrics.heightIn > limits.maxHeightIn + SIZE_SLACK_IN)
    out.add(STACK_PROBLEM.height);
  // in the ids' order, so the words come out the same every time
  return keysOf(STACK_PROBLEM)
    .map((key) => STACK_PROBLEM[key])
    .filter((p) => out.has(p));
}
