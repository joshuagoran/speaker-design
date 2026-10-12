// What a speaker and a stack cost, weigh and stand: the Speaker page's price and the Stack page's totals. Pure.
//
// The price is the purchased parts' total, as the Cutlist tab's table sums it (`speakerPurchasedParts`): the drivers,
// their horns, the passive radiators, the port tubes and elbows, and the hardware. The plywood is not in it, as the PA
// page's totals leave it out. The weight is the speaker's build (`cabinetBuild`). A stack's height is its highest
// member's top over the stack's base, a horn on a lid included, as the front drawing spans it (`speakerFrontFrame`).
import type { SpeakerCabinet, SpeakerSpec, StackSpec } from "../../types";
import { cabinetBuild, speakerPurchasedParts } from "./speakerBuild";
import { stackLayout } from "./stackLayout";
import { purchasedTotal } from "../cutlistCsv";
import { formatDollars } from "../format";
import { UI_TEXT } from "../../constants/uiText";
import { speakerFrontFrame } from "../../components/drawings/SpeakerFront";

/** A speaker's purchased parts total, US dollars (the parts with a price), and whether some part has no price. */
export const speakerPrice = (cabinet: SpeakerCabinet) =>
  purchasedTotal(speakerPurchasedParts(cabinet), 1);

/** A price total: the dollars of the parts with a price, and whether some part has no price. */
export type PriceTotal = ReturnType<typeof speakerPrice>;

/** A price total as a stat tile shows it: whole dollars, with the mark when some part has no price. */
export const priceText = ({ dollars, partial }: PriceTotal) =>
  `${formatDollars(dollars)}${partial ? UI_TEXT.partialPriceMark : ""}`;

/**
 * A stack's totals: the members' purchased parts (`dollars`, `partial` when some part has no price), their weight, lb,
 * and the height of the highest member's top over the stack's base, in. A member whose speaker is missing adds
 * nothing.
 */
export function stackTotals(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
): PriceTotal & { lb: number; heightIn: number } {
  let dollars = 0,
    partial = false,
    lb = 0,
    heightIn = 0;
  for (const { speaker, at } of stackLayout(stack, speakers)) {
    if (!speaker) continue;
    const price = speakerPrice(speaker.cabinet);
    dollars += price.dollars;
    partial ||= price.partial;
    lb += cabinetBuild(speaker.cabinet).lb;
    heightIn = Math.max(heightIn, at.y + speakerFrontFrame(speaker.cabinet).maxY);
  }
  return { dollars, partial, lb, heightIn };
}
