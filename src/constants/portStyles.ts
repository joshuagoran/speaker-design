import type { PortStyle } from "../types";

/** The sub's port styles, by what each is: the ids the Speaker page's views read a spec's PA port as. */
export const PORT_STYLE = {
  slot: "slots",
  twoDucts: "vslots",
  oneDuct: "vslot1",
  oneTube: "round1",
  tubeRow: "round2",
  cornerTubes: "round4",
} as const satisfies Record<string, PortStyle>;

/** How a vent description words a tube's elbows, by count (none for a straight tube). */
export const ELBOW_WORDS = { 1: "one elbow", 2: "two elbows" } as const;
