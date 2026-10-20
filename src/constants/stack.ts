// The Stack page's words (src/pages/stack).
import { STACK_LISTEN_DISTANCE_M } from "./speakerSpec";
import type { SaveRowWords } from "./saveRow";

export const STACK_TEXT = {
  /** the name a new stack starts with */
  newName: "New stack",
  views: "Views",
  front:
    "The boxes as the stack places them, to scale. A mirrored box is drawn flipped. The dashed line is the listening axis.",
  response: "Response at the listening point",
  yLabel: "dB SPL @ 2.83 V, 1 m",
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL @ 1 m",
  sum: "Stack",
  stackMax: "Stack max",
  /** under the stack's price, weight and height */
  totalsNote:
    "The price is the total of the boxes' purchased parts on the Cutlist tab, without the plywood. The weight is the total of the boxes' weights, each as the Speaker page shows it. The height is from the stack's base to its highest point, with each box's tilt. The weight and the height do not include the plinth or a stand. These go under the stack on the Space page.",
  listenHeight: "Listening axis",
  modelNote: `Each box plays as its speaker does on the Speaker page, fed through its crossover, then its level and delay. The sum is ${STACK_LISTEN_DISTANCE_M} m in front of the stack, level with the highest band, moved back to 1 m. Each band's path to that point sets its time and level. An auto delay puts a box in phase with the box it crosses, at their crossover. If that box would have to play early, the others wait instead, so no delay is less than 0. Not modeled: the room, the baffle step, and coverage off axis.`,
  maxNote:
    "One input drives the whole stack. At each frequency, the box with the least headroom sets the level, and every box plays at that input. The crossovers are in the front end, ahead of the amps.",
  noMembers: "Add a saved speaker, or start from a preset.",
  /** a crossover between two boxes: the lower and the upper box by name */
  crossing: (lower: string, upper: string) => `${lower} to ${upper}`,
  /** a crossing between two bands inside one box: the box's name, then the lower and the upper band by name */
  memberCrossing: (box: string, lower: string, upper: string) => `${box}: ${lower} to ${upper}`,
  missing: "A box's speaker is missing from this stack, so the response leaves it out.",
  gaps: "The response leaves out part of a box's speaker. Open that speaker on the Speaker page to see which part.",
  fullRange: "full range",
  /** the empty start in "New from…" */
  empty: "Empty Stack",
  notes: "Notes",
  librarySpeaker: "Saved speaker",
  addMember: "Add box",
  noLibrary: "Save speakers on the Speaker page to add them here (sign in first).",
  remove: "Remove",
  standsOn: "Stands on",
  base: "The base",
  across: "Across, in",
  acrossTip:
    "Its center line from the stack's, or from the box under it. + is to the right, seen from the front.",
  up: "Up, in",
  upTip:
    "Its bottom above the base, or above the top of the box under it (a gap, a spacer, a stand).",
  back: "Back, in",
  backTip: "Its front behind the stack's front, or behind the front of the box under it.",
  tilt: "Tilt, °",
  tiltTip:
    "Its tilt in the stack, + up, about its bottom front edge: a top angled down on its sub. The Space page's coverage uses it; the response here is on axis.",
  mirror: "Mirror image",
  level: "Level",
  delay: "Delay",
  crossoverHint:
    "The filters ahead of this box, between boxes. In the stack they are the speaker's input range.",
  noFilter: "None",
  /** a library speaker's newer copy beside the one the stack's boxes already name */
  copyName: (name: string, n: number) => `${name} (copy ${n})`,
} as const;

/** The saving row's nouns on the Stack page (`SaveRowWords`, constants/saveRow). */
export const STACK_SAVE_WORDS = {
  namePlaceholder: "Stack name",
  savedList: "Saved Stacks",
  pick: (n: number) => `Saved Stacks (${n})`,
  noSaved: "No saved Stacks yet",
  newFromTip:
    "Starts a new Stack, empty or from a preset. It replaces the current design. A PA start sets each band's level to the More bass band balance.",
} as const satisfies SaveRowWords;
