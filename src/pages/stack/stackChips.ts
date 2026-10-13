// The Stack page's checks between its members: keep-up at each crossover between boxes (lib/speaker/keepUp), as the
// PA page's "Mid limits first" check, one list per crossing.
import type { Chip, ChipId, StackLimits, StackResponse, StackSpec } from "../../types";
import { keepUpChip, stackKeepUps } from "../../lib/speaker/keepUp";
import { STACK_TEXT } from "../../constants/stack";

/** Each crossing between members: its heading (the two members by name) and its check. */
export function stackKeepUpChips(
  stack: Pick<StackSpec, "members">,
  response: Pick<StackResponse, "members">,
  limits: Pick<StackLimits, "members">,
  names: readonly string[],
): { heading: string; chips: Chip<ChipId<"stack">>[] }[] {
  return stackKeepUps(stack, response, limits).map((k) => ({
    heading: STACK_TEXT.crossing(names[k.lower] ?? "", names[k.upper] ?? ""),
    chips: [[...keepUpChip(k, names[k.lower] ?? "", names[k.upper] ?? ""), "stackKeepsUp"]],
  }));
}
