// The Space page's figures and words (src/pages/space; the model in lib/speaker/spaceLayout and spaceCoverage).
import type { CoverageRoom } from "../types";

/**
 * A living room for a design that names no room (the Hi-fi pair, a fill): 16 × 22 ft, a 9 ft ceiling, drywall all
 * round, an empty floor. A wider or longer layout grows it (lib/speaker/spaceLayout `homeVenue`).
 */
export const SPACE_HOME_ROOM: CoverageRoom = {
  widthFt: 16,
  lengthFt: 22,
  ceilingFt: 9,
  materials: {
    front: "drywall",
    back: "drywall",
    left: "drywall",
    right: "drywall",
    ceiling: "drywall",
  },
  crowd: "empty",
  outdoors: false,
};

/** The room is at least this much wider than a pair of speakers, and longer than its seat is from the front wall, ft. */
export const SPACE_HOME_MARGIN_FT = 4;

/** The level a living room's listening area should get, dB SPL: loud music at home. */
export const SPACE_HOME_TARGET_DB = 90;

/** Which part of a driver entry radiates, by id: its cone (in its chamber's air) or its HF section. */
export const DRIVER_PART = {
  cone: "cone",
  hf: "hf",
} as const;

/** A seat's listening area, ft: a sofa's width, a little deep. */
export const SPACE_SEAT_AREA = { widthFt: 6, lengthFt: 4 } as const;

/** How far the audience's listening area starts past the boxes' fronts, ft (the map's stats leave that floor out too). */
export const SPACE_AUDIENCE_GAP_FT = 4;

/** The ear's height of a seated listener, ft. */
export const SEATED_EAR_FT = 3.5;

/** How far a placement may turn either way on the floor, and tilt up or down, degrees. */
export const SPACE_YAW_DEG = 90;
export const SPACE_PITCH_DEG = 30;

/** The highest lift under a placement, in (a tall stand, a fly bar). */
export const SPACE_LIFT_MAX_IN = 240;

export const SPACE_TEXT = {
  /** the name a new space starts with */
  newName: "New space",
  /** the name a space read from the PA design takes */
  paName: "PA design",
  coverage: "Coverage",
  side: "Side view",
  sideNote:
    "The placements seen from the side, to scale: each box at its lift and tilt, a line along each one's highest band. The cyan dot is the listener's ear; the band under the floor is the listening area.",
  response: "Response at the listener",
  levels: "Levels at the listening area",
  hardware: "Hardware",
  noPlacements: "Place a saved stack or speaker, or start from the current PA design.",
  missing:
    "A placement names a stack or speaker this space doesn't hold, so the model leaves it out.",
  fromPa: "From the current PA design",
  fromPaHint:
    "Replaces this space with the PA design on the Coverage page's floor. Open a saved space from the library above.",
  clear: "Start empty",
  savedStack: "Saved stack",
  savedSpeaker: "Saved speaker",
  addStack: "Place stack",
  addSpeaker: "Place speaker",
  noLibrary:
    "Save stacks on the Stack page, or speakers in the Designer, to place them here (sign in first).",
  remove: "Remove",
  addPair: "Add the mirror pair",
  follows: "Mirror of",
  followsNone: "None (placed on its own)",
  followsTip:
    "A left and right pair: this placement follows the one you pick, turned over the room's center line.",
  across: "Across, ft",
  acrossTip:
    "Its front center from the room's center line. + is to the right, seen from the audience.",
  down: "From the front wall, ft",
  lift: "Lift, in",
  liftTip: "The gap under it: a plinth, a stand, a fly bar.",
  yaw: "Yaw, °",
  yawTip: "Its turn on the floor from straight down the room. + turns toward the right side.",
  pitch: "Pitch, °",
  pitchTip:
    "Its tilt, + up. A stack member's tilt and a box's kick-back add to it (set those on the Stack page and in the Designer).",
  mirror: "Mirror image",
  level: "Level, dB",
  delay: "Delay, ms",
  feedTip:
    "The front end's level and delay on this placement's feed (a fill under, and after, the mains).",
  amps: "Amps",
  addAmp: "Add amp",
  ampModel: "Model",
  customAmp: "Other amp",
  watts: "Watts per channel",
  frontEnd: "Front end",
  dsp: "DSP unit",
  noDsp: "Other DSP",
  channel: (amp: number, ch: number) => `Amp ${amp} ch ${ch}`,
  unassigned: "No channel",
  channelsOver: (amp: number, used: number, has: number) =>
    `Amp ${amp} has ${has} channels; this space uses ${used}.`,
  noChannel:
    "A band has no amp channel: the model drives it at its own amp power (set in the Designer).",
  analogDelay:
    "An analog front end has fixed cards with no delay: a stack's alignment or a placement's delay needs a DSP.",
  noFrontEnd:
    "No front end: only passive speakers straight off the amps. The model still uses each stack's filters.",
  room: "Room",
  width: "Width, ft",
  length: "Length, ft",
  ceiling: "Ceiling, ft",
  outdoors: "Outdoors",
  crowd: "Full dance floor",
  areaWidth: "Area width, ft",
  areaLength: "Area length, ft",
  areaCenter: "Area center from the front wall, ft",
  listenerAcross: "Listener across, ft",
  listenerDown: "Listener from the front wall, ft",
  ear: "Ear height, ft",
  target: "Target at the listening area, dB",
  band: "Band",
  oneFrequency: "One frequency",
  modelNote:
    "Each placement plays its stack's response (each member's speaker through its crossover, level and delay), with each driver's coverage at its own place and aim, and the room as on the PA Coverage page: the floor bounce, the walls and ceiling by their materials, and the room's modes in the low end. Each cone band has its baffle step. The whole space plays from one input: at its music limit, the placement with the least headroom sets the level, then the space is turned down until the listening area's average gets the target.",
} as const;
