// The Stack page's words (src/pages/stack).
import { STACK_LISTEN_DISTANCE_M } from "./speakerSpec";

export const STACK_TEXT = {
  /** the name a new stack starts with */
  newName: "New stack",
  /** the name a stack read from the PA design takes */
  paName: "PA design",
  views: "Front view",
  front:
    "The members as the stack places them, to scale. A mirrored member is drawn flipped. The dashed line is the listening axis.",
  response: "Response at the listening point",
  yLabel: "dB SPL @ 2.83 V, 1 m",
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL @ 1 m",
  sum: "Stack",
  stackMax: "Stack max",
  listenHeight: "Listening axis",
  modelNote: `Each member is its speaker in the Speaker page's model, fed through its crossover, then its level and delay. The sum is ${STACK_LISTEN_DISTANCE_M} m in front of the stack, level with the highest band, moved back to 1 m. Each band's path to that point sets its time and level. An auto delay puts a member in phase with the member it crosses, at their crossover. If that member would have to play early, the others wait instead, so no delay is less than 0. Not modeled: the room, the baffle step, and coverage off axis.`,
  maxNote:
    "One input drives the whole stack. At each frequency, the member with the least headroom sets the level, and every member plays at that input. The crossovers are in the front end, ahead of the amps.",
  noMembers: "Add a saved speaker, or start from the current PA design.",
  missing: "A member's speaker is missing from this stack, so the model leaves it out.",
  gaps: "The model leaves out part of a member's speaker. Open that speaker on the Speaker page to see which part.",
  fullRange: "full range",
  fromPa: "From the current PA design",
  fromPaHint: "Both replace this stack; open a saved stack from the library above.",
  clear: "Start empty",
  notes: "Notes",
  librarySpeaker: "Saved speaker",
  addMember: "Add member",
  noLibrary: "Save speakers on the Speaker page to add them here (sign in first).",
  remove: "Remove",
  standsOn: "Stands on",
  base: "The base",
  across: "Across, in",
  acrossTip:
    "Its center line from the stack's, or from the member under it. + is to the right, seen from the front.",
  up: "Up, in",
  upTip:
    "Its bottom above the base, or above the top of the member under it (a gap, a spacer, a stand).",
  back: "Back, in",
  backTip: "Its front behind the stack's front, or behind the front of the member under it.",
  tilt: "Tilt, °",
  tiltTip:
    "Its tilt in the stack, + up, about its bottom front edge: a top angled down on its sub. The Space page's coverage uses it; the response here is on axis.",
  mirror: "Mirror image",
  level: "Level",
  delay: "Delay",
  crossoverHint:
    "The filters ahead of this member, between boxes. In the stack they are the speaker's input range.",
  noFilter: "None",
  /** a library speaker's newer copy beside the one the stack's members already name */
  copyName: (name: string, n: number) => `${name} (copy ${n})`,
} as const;
