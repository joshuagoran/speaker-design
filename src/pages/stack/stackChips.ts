// The Stack page's checks, as compact rows: keep-up at each crossover between boxes (lib/speaker/keepUp), "Mid limits
// first", one row per crossing; then each member speaker's own checks, as the Speaker page shows them
// (lib/speaker/speakerChips), on the member's crossover. Crossings between members get no dispersion check.
import type { Chip, StackLimits, StackResponse, StackSpec } from "../../types";
import { keepUpChip, stackKeepUps } from "../../lib/speaker/keepUp";
import { speakerCheckRows } from "../../lib/speaker/speakerChips";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { STACK_TEXT } from "../../constants/stack";

/**
 * The stack's check rows: each crossing between members (labeled with the two members by name), then each member's band
 * and chamber rows (labeled with the member's name first). A row with no check is left out.
 */
export function stackCheckRows(
  stack: Pick<StackSpec, "members">,
  response: Pick<StackResponse, "members">,
  limits: Pick<StackLimits, "members">,
  names: readonly string[],
): { key: string; row: string; chips: Chip[] }[] {
  return [
    ...stackKeepUps(stack, response, limits).map((k) => {
      const lower = names[k.lower] ?? "";
      const upper = names[k.upper] ?? "";
      return {
        key: `crossing:${k.lower}:${k.upper}`,
        row: STACK_TEXT.crossing(lower, upper),
        chips: [[...keepUpChip(k, lower, upper), "stackKeepsUp"] satisfies Chip],
      };
    }),
    ...response.members.flatMap((m, k) => {
      const own = limits.members[k];
      if (!m || !own) return [];
      return speakerCheckRows(
        m.speaker,
        own.limits,
        m.response,
        cabinetBuild(m.speaker.cabinet),
      ).map((r) => ({
        ...r,
        key: `m${k}:${r.key}`,
        row: STACK_TEXT.memberRow(names[k] ?? "", r.row),
      }));
    }),
  ];
}
