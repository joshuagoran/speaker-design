import type { SubPlacement } from "../types";

/** Where the subs stand, by id: in the stacks, a center pair, or one center sub (the PA Coverage page). */
export const SUB_PLACEMENT = {
  stacks: "stacks",
  center: "center",
  single: "single",
} as const satisfies Record<SubPlacement, SubPlacement>;

/** The sub placement choices, with their names, in display order. */
export const SUB_PLACEMENT_OPTIONS = [
  [SUB_PLACEMENT.stacks, "Subs in the stacks"],
  [SUB_PLACEMENT.center, "Center pair"],
  [SUB_PLACEMENT.single, "One center sub"],
] as const satisfies readonly (readonly [SubPlacement, string])[];
