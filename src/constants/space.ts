// The Space page's figures and words (src/pages/space; the model in lib/speaker/spaceLayout and spaceCoverage).
import type { CoverageBand, CoverageLevelRef, CoverageRoom } from "../types";
import type { ToggleOption } from "../components/ui/ToggleGroup";
import { COVERAGE_LEVEL_REF, COVERAGE_LEVEL_REF_PLACE, COVERAGE_LEVEL_REFS } from "./coverageLevel";

/**
 * A living room for a design that names no room (the Hi-fi pair, a fill): 20 × 30 ft, a 12 ft ceiling, drywall all
 * round, an empty floor. A wider or longer layout grows it (lib/speaker/spaceLayout `homeVenue`).
 */
export const SPACE_HOME_ROOM: CoverageRoom = {
  widthFt: 20,
  lengthFt: 30,
  ceilingFt: 12,
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

/** The level a living room should get, dB SPL: loud music at home. */
export const SPACE_HOME_TARGET_DB = 90;

/** Which part of a driver entry radiates, by id: its cone (in its chamber's air) or its HF section. */
export const DRIVER_PART = {
  cone: "cone",
  hf: "hf",
} as const;

/** The ear's height of a seated listener, ft. */
export const SEATED_EAR_FT = 3.5;

/** A placement turns freely on the floor: its yaw wraps within this half turn either way (never clamps), degrees. */
export const SPACE_YAW_DEG = 180;
/** How far a placement may tilt up or down, degrees. */
export const SPACE_PITCH_DEG = 30;

/** The highest lift under a placement, in (a tall stand, a fly bar). */
export const SPACE_LIFT_MAX_IN = 240;

/** The band a fill's level is matched to the mains in (lib/speaker/fillAlign): the voice range a fill is there for. */
export const FILL_ALIGN_BAND = "mid" satisfies CoverageBand;

/**
 * How much later than the mains a fill arrives at the listener, ms, so the sound still seems to come from the mains (the
 * precedence effect): what the Align action adds to the path difference. 5 to 15 ms are usual: `FILL_PRECEDENCE_MS` is the
 * first, `FILL_PRECEDENCE_MAX_MS` the last.
 */
export const FILL_PRECEDENCE_MS = 5;
export const FILL_PRECEDENCE_MAX_MS = 15;

/** The Space page's 1 m reference: it averages each placement with a modeled stack or speaker, not two stacks. */
const SPACE_ONE_METER = "1 m from the speakers";
const SPACE_ONE_METER_TIP =
  "The mean level at ear height, 1 m in front of each placed stack or speaker that has a model, on its aim.";

/** The Space page's "Measured at" choices: the PA's, with its own 1 m reference. */
export const SPACE_LEVEL_REFS: readonly ToggleOption<CoverageLevelRef>[] = COVERAGE_LEVEL_REFS.map(
  ([id, label]) =>
    id === COVERAGE_LEVEL_REF.stacks ? [id, SPACE_ONE_METER, SPACE_ONE_METER_TIP] : [id, label],
);

/** Each Space reference as a sentence names it ("the target at …"). */
export const SPACE_LEVEL_REF_PLACE: Record<CoverageLevelRef, string> = {
  ...COVERAGE_LEVEL_REF_PLACE,
  stacks: SPACE_ONE_METER,
};

/** A delay under this is no delay, ms. */
export const NO_DELAY_MS = 0.05;

export const SPACE_TEXT = {
  /** the name a new space starts with */
  newName: "New space",
  coverage: "Coverage",
  side: "Side view",
  sideNote:
    "The speakers seen from the side, to scale, at their height and tilt. Each dashed line shows where a speaker points (the axis of its highest band). The cyan dot is the listener's ear.",
  response: "Response at the listener",
  levels: "Levels",
  noPlacements: "Nothing is placed yet. Pick a stack or speaker and press Place.",
  missing:
    "A placement names a stack or speaker that is not in this space. The model leaves it out.",
  startHint:
    "Both replace this space. A start from a design or a preset stands in a room made for it. A PA start also sets the music balance to PA music tilt. Open a saved space from the library above.",
  clear: "Start empty",
  place: "Place",
  /** the Place list's groups */
  placeGroups: {
    stackPresets: "Stack presets",
    speakerTemplates: "Speaker templates",
    open: "Open now",
    savedStacks: "Saved stacks",
    savedSpeakers: "Saved speakers",
  },
  /** the open stack or speaker in the Place list */
  openStack: (name: string) => `Stack: ${name}`,
  openSpeaker: (name: string) => `Speaker: ${name}`,
  /** under the Place list: signed out, and signed in with nothing saved */
  noLibrary: "Sign in to place your saved stacks and speakers here too.",
  noLibrarySaved: "Save a stack or speaker to place it here.",
  remove: "Remove",
  addPair: "Add a mirrored copy",
  addPairTip:
    "Adds a copy on the other side of the room's center line. The copy follows this placement: its position, aim, level, delay and amp power.",
  follows: "Mirror of",
  followsNone: "None (placed on its own)",
  followsTip:
    "A left and right pair: this placement follows the one you pick. It takes that placement's position, aim, level and delay, mirrored across the room's center line.",
  fromCenter: "From the center line, ft",
  fromCenterTip:
    "Its front center from the room's center line. + is to the right, seen from the listener.",
  down: "From the front wall, ft",
  height: "Height above the floor, ft",
  heightTip: "The gap under it: a plinth, a stand, a fly bar.",
  yaw: "Rotation, °",
  yawTip: "Its turn on the floor from straight down the room. + turns toward the right side.",
  pitch: "Tilt, °",
  pitchTip: "+ tilts it up. A box's tilt in the stack and its cabinet's kick-back add to it.",
  mirror: "Flip left and right",
  mirrorTip:
    "Turns the box over, so its left and right sides swap. Use it for a speaker made as a left or right model.",
  level: "Level, dB",
  delay: "Delay, ms",
  alignTo: "Align to",
  alignToTip:
    "The placement to line this one up with, for a fill that plays after it. Move the listener to the area this placement covers first. The Align button sets this placement's Delay and Level.",
  align: "Align",
  delayTip: `The Align button lines this placement up with the one you pick, plus ${FILL_PRECEDENCE_MS} ms. Adding ${FILL_PRECEDENCE_MS} to ${FILL_PRECEDENCE_MAX_MS} ms more than the path difference makes people hear the sound from the main speakers.`,
  /** a mirror pair in the "Align to" list: its placements' names */
  pairName: (names: readonly string[]) => names.join(" + "),
  alignFillNone:
    "Cannot align: this placement and the one you pick must each hold a modeled stack or speaker.",
  feedTip: "A level and a delay on this placement's feed (a fill under, and after, the mains).",
  ampPower: "Amp power",
  ampPowerHint:
    "The power of the amp for each band, in watts into 8 Ω. The model finds each speaker's limit from it. A mirrored copy, and a speaker placed twice, share one figure.",
  /** a band's amp power field: the band (or a passive network's bands) it is for */
  ampPowerFor: (bands: string) => `${bands}: amp power, W`,
  alignment: "Alignment",
  alignmentHint: "The settings for each box and band, at the level and delay the space asks of it.",
  /** a band's filters, as a row's value: its corner and slope */
  highpass: (filter: string) => `High-pass ${filter}`,
  lowpass: (filter: string) => `Low-pass ${filter}`,
  fullRange: "Full range",
  /** a band's level, dB (already formatted) */
  levelIs: (db: string) => `Level ${db} dB`,
  noDelay: "No delay",
  /** a delay as a time (ms) and as the distance it equals: how far back the box would stand (in) */
  delayIs: (ms: string, inches: string) => `Delay ${ms} ms, or move the box ${inches} in back`,
  offsetNote:
    "Some boxes need a time offset to line up at their crossovers (listed above). A delay, an all-pass filter or moving the box can give it.",
  placementNote: "Some placements play later, to line up with other speakers in the room.",
  outdoors: "Outdoors",
  ear: "Ear height, ft",
  target: "Target level, lowest band",
  measuredAt: "Measured at",
  /** the map's caption: the band, its target, dB (already formatted), and where it is measured */
  mapCaption: (band: string, target: string, place: string) =>
    `${band}, ${target} dB target at ${place}.`,
  balance: "Music balance",
  balanceTip:
    "Flat: each band plays at the same level. PA music tilt: each higher band plays a little lower, so the bass is stronger, as many PA systems are set.",
  /** the band levels' heading: each band at the listener */
  bandLevels: "Each band at the listener, at this level:",
  /** one band's level and target there, dB (already formatted) */
  bandLevel: (band: string, db: string, target: string) => `${band} ${db} dB (target ${target})`,
  targetCurve: "Target, music balance",
  listenerHint: "Tap the map, or drag the cyan dot, to move the listener.",
  mapHint:
    "Drag a placement to move it, its dot to turn it, or the listener (tap the floor to put them there).",
  oneNote: (hz: number) =>
    `One frequency adds everything with phase, so the interference between the placements is easy to see. The limit is ${hz} Hz. Above it, the pattern is finer than the map.`,
  audienceAverage: "Audience average",
  audienceMax: "Audience at the limit",
  listener: "Listener",
  /** the share of the floor at or above a level against the target (as the coverage page counts it) */
  floorAtLeast: (db: string) => `Floor ≥ ${db} dB`,
  spread: "Spread, 10–90 %",
  responseY: "dB SPL at the listener",
  /** the reference can't get the band's target: where it is measured (`COVERAGE_LEVEL_REF_PLACE`), dB */
  cannotReach: (place: string, target: number, atLimit: number) =>
    `It cannot reach ${target.toFixed(0)} dB at ${place} in this band: ${atLimit.toFixed(1)} dB at its limit.`,
  turnedDown: (db: number, place: string, target: number) =>
    `Turned down ${db.toFixed(1)} dB so ${place} gets ${target.toFixed(0)} dB in this band.`,
  listenerVs: "The listener against the target:",
  modelNote:
    "Each placement plays its stack's response (each box's speaker through its crossover, level and delay), with each driver's coverage at its own place and aim, and the room: the floor bounce, the walls and ceiling by their materials, and the room's modes in the low end. Each cone band has its baffle step. The whole space plays from one input: at its music limit, the placement with the least headroom sets the level, then the space is turned down until the reference (the audience average, the listener, or 1 m in front of the speakers) gets the target in the band on show. The target is the lowest band's; with the PA music tilt, each band above a crossover is lower.",
} as const;
