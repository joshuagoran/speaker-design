// The Stack page's words (src/pages/stack).
import { STACK_LISTEN_DISTANCE_M } from "./speakerSpec";
import { SAVE_ROW_TEXT, type SaveRowWords } from "./saveRow";
import { CUTLIST_TAB_NAME, PROJECT_NAMES } from "./pages";
import { SET_BY_NAMES, SPEAKER_TEXT } from "./speakerPage";
import { SETTINGS_TEXT } from "./speakerSettings";
import { UI_TEXT } from "./uiText";

/** The listening height's tile, which the front view's note names. */
const LISTEN_AXIS_NAME = "Listening axis";

export const STACK_TEXT = {
  /** the name a new stack starts with */
  newName: "New Stack",
  views: "Views",
  front: `The boxes as the Stack places them, to scale. A mirrored box is drawn flipped. The dashed line is the **${LISTEN_AXIS_NAME}**.`,
  response: "Response at the listener",
  yLabel: "dB SPL @ 2.83 V, 1 m",
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL @ 1 m",
  sum: "Stack",
  stackMax: "Stack max",
  /** under the stack's price, weight and height */
  totalsNote: `The **${UI_TEXT.price}** is the total of the boxes' purchased parts on the **${CUTLIST_TAB_NAME}** tab, without the plywood. The **${SPEAKER_TEXT.weight}** is the total of the boxes' weights, each as the **${PROJECT_NAMES.speaker}** page shows it. The **${UI_TEXT.height}** is from the stack's base to its highest point, with each box's tilt. The **${SPEAKER_TEXT.weight}** and the **${UI_TEXT.height}** do not include the plinth or a stand. These go under the stack on the **${PROJECT_NAMES.space}** page.`,
  listenHeight: LISTEN_AXIS_NAME,
  modelNote: `Each box plays as its speaker does on the **${PROJECT_NAMES.speaker}** page. The sum is ${STACK_LISTEN_DISTANCE_M} m in front of the stack, moved back to 1 m. An **${SET_BY_NAMES.auto}** delay puts a box in phase with the box it crosses. Not modeled: the room, the baffle step, and coverage off axis.`,
  maxNote:
    "One input drives the whole stack. At each frequency, the box with the least headroom sets the level, and every box plays at that input. The crossovers are in the front end, ahead of the amps.",
  noMembers: "Add a saved Speaker or a preset.",
  /** a crossover between two boxes: the lower and the upper box by name */
  crossing: (lower: string, upper: string) => `${lower} to ${upper}`,
  /** a crossing between two bands inside one box: the box's name, then the lower and the upper band by name */
  memberCrossing: (box: string, lower: string, upper: string) => `${box}: ${lower} to ${upper}`,
  missing: "This box's Speaker is deleted. The response leaves it out.",
  gaps: `The response leaves out part of a box's Speaker. The **${PROJECT_NAMES.speaker}** page shows which part.`,
  fullRange: "full range",
  /** the empty start in "New from…" */
  empty: "Empty Stack",
  notes: "Notes",
  librarySpeaker: "Saved Speaker",
  addMember: "Add box",
  noLibrary: "Sign in to add saved Speakers here.",
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
  tiltTip: "Tilts the box up (+) or down (−) on the box below it.",
  mirror: "Mirror image",
  gain: "Gain",
  delay: "Delay",
  crossoverHint: `The filters ahead of this box, between boxes. In the Stack they are the Speaker's **${SETTINGS_TEXT.externalCrossover}**.`,
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
  newFromTip: SAVE_ROW_TEXT.newFromTip(PROJECT_NAMES.stack),
} as const satisfies SaveRowWords;
