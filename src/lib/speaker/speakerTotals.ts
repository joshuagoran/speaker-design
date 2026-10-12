// What a speaker and a stack cost, weigh and stand: the Speaker page's price and the Stack page's totals. Pure.
//
// The price is the purchased parts' total, as the Cutlist tab's table sums it (`speakerPurchasedParts`): the drivers,
// their horns, the passive radiators, the port tubes and elbows, and the hardware. The plywood is not in it, as the PA
// page's totals leave it out. The weight is the speaker's build (`cabinetBuild`). A stack's height is its highest
// point over the stack's base: each member's box and the horns on its lid (`speakerBounds`), tilted as the aim model
// tilts them (lib/speaker/stackLayout `memberPoint`: its kick-back and its tilt in the stack, about its bottom front
// edge).
import type { SpeakerCabinet, SpeakerSpec, StackSpec } from "../../types";
import { cabinetBuild, speakerPurchasedParts } from "./speakerBuild";
import { boxCorners, memberPitch, memberPoint, ORIGIN, stackLayout } from "./stackLayout";
import { speakerBounds } from "./speakerLayout";
import { purchasedTotal } from "../cutlistCsv";
import { formatDollars } from "../format";
import { UI_TEXT } from "../../constants/uiText";

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
 * and the height of its highest point over the stack's base, in (a member's box and the horns on its lid, tilted). A
 * member whose speaker is missing adds nothing.
 */
export function stackTotals(
  stack: Pick<StackSpec, "members">,
  speakers: readonly SpeakerSpec[],
): PriceTotal & { lb: number; heightIn: number } {
  let dollars = 0,
    partial = false,
    lb = 0,
    heightIn = 0;
  stackLayout(stack, speakers).forEach((placed, k) => {
    const { speaker } = placed;
    if (!speaker) return;
    const member = stack.members[k];
    const price = speakerPrice(speaker.cabinet);
    dollars += price.dollars;
    partial ||= price.partial;
    lb += cabinetBuild(speaker.cabinet).lb;
    const { layout, topHorns } = speakerBounds(speaker.cabinet);
    const inStack = memberPoint(placed, member.mirror, memberPitch(speaker, member));
    for (const corner of [
      ...boxCorners(ORIGIN, layout.size),
      ...topHorns.flatMap((horn) => boxCorners(horn, horn)),
    ])
      heightIn = Math.max(heightIn, inStack(corner).y);
  });
  return { dollars, partial, lb, heightIn };
}
