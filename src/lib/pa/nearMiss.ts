// The PA near miss's words: the banner's line on the closest design when no design fits.
import { formatDollars } from "../format";
import { PA_OUTPUT_NAME } from "./optimize";
import { CARD_LABELS, NEAR_MISS_YOURS } from "../../constants/optimizerText";
import type { PaNearMiss } from "../../types";

/**
 * The closest design in a sentence: its sub, weight, price and the output the target compares; your own design is
 * named as such ("Closest: your design (…)."). Empty when there is no closest design.
 */
export function nearMissClosestText({
  closest,
  closestIsYours,
}: Pick<PaNearMiss, "closest" | "closestIsYours">): string {
  if (!closest) return "";
  const m = closest.metrics;
  const facts = `${closest.names.sub}, ${m.heaviest.toFixed(0)} lb, ${formatDollars(m.price)} per stack, ${m.out.toFixed(1)} dB ${PA_OUTPUT_NAME}`;
  return `${CARD_LABELS.nearMiss}: ${closestIsYours ? `${NEAR_MISS_YOURS} (${facts})` : facts}. `;
}
