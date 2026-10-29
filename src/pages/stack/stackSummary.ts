// The Stack page's phone summary strip: the lowest tuning of its members'
// chambers, the stack's maximum output at SUMMARY_LOW_HZ, the members' weight, and what limits the stack for music.
import type { StackLimits, StackResponse } from "../../types";
import type { Units } from "../../lib/units";
import type { SummaryItem } from "../../components/ui/SummaryStrip";
import { curveLevelAt } from "../../lib/acoustics/coverage";
import { LIMIT_NAMES } from "../../constants/limits";
import { SUMMARY_LOW_HZ, SUMMARY_STRIP_TEXT } from "../../constants/summaryStrip";

/** The strip's four figures; null with no modeled member. */
export function stackSummary(
  response: Pick<StackResponse, "members">,
  limits: Pick<StackLimits, "sum" | "members" | "member" | "band">,
  lb: number,
  units: Units,
): SummaryItem[] | null {
  const live = response.members.filter((m) => m !== null);
  if (!live.length) return null;
  const tunings = live.flatMap((m) =>
    m.response.chambers.flatMap((c) => (c.fb !== null ? [c.fb] : [])),
  );
  const low = curveLevelAt(limits.sum, SUMMARY_LOW_HZ);
  const who =
    limits.member !== null
      ? limits.members[limits.member]?.limits.bands.find((b) => b.id === limits.band)?.who
      : undefined;
  return [
    [
      SUMMARY_STRIP_TEXT.fb,
      tunings.length ? Math.min(...tunings).toFixed(1) : SUMMARY_STRIP_TEXT.none,
      tunings.length ? "Hz" : "",
    ],
    [
      SUMMARY_STRIP_TEXT.low,
      low !== null ? low.toFixed(0) : SUMMARY_STRIP_TEXT.none,
      low !== null ? "dB" : "",
    ],
    [SUMMARY_STRIP_TEXT.weight, units.amount("mass", lb, 0), units.unit("mass")],
    [SUMMARY_STRIP_TEXT.limit, who ? LIMIT_NAMES[who] : SUMMARY_STRIP_TEXT.none, ""],
  ];
}
