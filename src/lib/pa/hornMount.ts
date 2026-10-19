import { HORN_PLACEMENT } from "../../constants/speakerSpec";
import type { Horn, HornPlacement, PaLayout } from "../../types";

/**
 * Whether a horn mount applies to a horn where it sits: the driver bolts straight to the horn (no throat adapter, whose
 * own flange the bracket bolts to) and stands on a lid (a horn in the baffle has none under the driver).
 */
export const takesHornMountAt = (horn: Pick<Horn, "adapter">, placement: HornPlacement) =>
  !horn.adapter && placement === HORN_PLACEMENT.top;

/** Whether the PA design's horn mount setting applies: the tower has its horn in the baffle, the other layouts on a lid. */
export const takesHornMount = (horn: Pick<Horn, "adapter">, layout: PaLayout) =>
  takesHornMountAt(horn, layout === "tower" ? HORN_PLACEMENT.baffle : HORN_PLACEMENT.top);
