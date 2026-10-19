// The Stack page's checks between its members: keep-up at each crossover between boxes (lib/speaker/keepUp), as the
// PA page's "Mid limits first" check, one list per crossing; and each member speaker's own crossovers (the Speaker page's
// dispersion check on its bands). Crossings between members get no dispersion check.
import type { Chip, ChipId, StackLimits, StackResponse, StackSpec } from "../../types";
import type { SpeakerSpec } from "../../types";
import { keepUpChip, stackKeepUps } from "../../lib/speaker/keepUp";
import { dispersionChecks } from "../../lib/speaker/dispersionCheck";
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

/**
 * Each crossing between two bands of a member's speaker (not between members): its heading (the member, then the two
 * bands by name) and its dispersion check.
 */
export function stackDispersionChips(
  stack: Pick<StackSpec, "members">,
  speakers: readonly Pick<SpeakerSpec, "id" | "bands" | "cabinet">[],
  names: readonly string[],
): { heading: string; chips: Chip<ChipId<"stack">>[] }[] {
  return stack.members.flatMap((member, k) => {
    const speaker = speakers.find((s) => s.id === member.speakerId);
    if (!speaker) return [];
    const nameOf = (id: string) => speaker.bands.find((b) => b.id === id)?.name ?? id;
    return dispersionChecks(speaker).map((c) => ({
      heading: STACK_TEXT.memberCrossing(names[k] ?? "", nameOf(c.lower), nameOf(c.upper)),
      chips: [[...c.chip, "stackDispersion"]],
    }));
  });
}
