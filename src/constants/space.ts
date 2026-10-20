// The Space page's figures and words (src/pages/space; the model in lib/speaker/spaceLayout and spaceCoverage).
import type {
  CoupledSurface,
  CoverageBand,
  CoverageLevelRef,
  CoverageRoom,
  FloorPoint,
  RoomMaterial,
} from "../types";
import type { ToggleOption } from "../components/ui/ToggleGroup";
import type { SurfaceName } from "../components/ui/RoomFields";
import { COVERAGE_LEVEL_REF, COVERAGE_LEVEL_REF_PLACE, COVERAGE_LEVEL_REFS } from "./coverageLevel";
import { AMP_POWER_TIP } from "./ampPower";
import type { SaveRowWords } from "./saveRow";

/** The coverage map's bands, by id: the ones a shared Space link may name. */
export const COVERAGE_BAND_IDS = [
  "sub",
  "kick",
  "mid",
  "high",
  "one",
] as const satisfies readonly CoverageBand[];

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

/**
 * Where the listener sits in the empty space, ft: on the center line, two thirds down the living room (a seat back from
 * the speakers a new placement stands by, and clear of the middle where the map's quiet line is).
 */
export const SPACE_HOME_SEAT: FloorPoint = { x: 0, y: (SPACE_HOME_ROOM.lengthFt * 2) / 3 };

/** The room's surfaces, as the Space page's fields name them (the same words as the position fields' "front wall"). */
export const SPACE_SURFACE_NAMES: readonly SurfaceName[] = [
  ["front", "Front wall"],
  ["back", "Back wall"],
  ["left", "Left wall"],
  ["right", "Right wall"],
  ["ceiling", "Ceiling"],
];

/** The tooltip on the left wall's field. */
export const SPACE_LEFT_WALL_TIP =
  "Left and right as seen from the listener, facing the front wall.";

/** The room is at least this much wider than a pair of speakers, and longer than its seat is from the front wall, ft. */
export const SPACE_HOME_MARGIN_FT = 4;

/**
 * The side of the center line each box of a mirrored pair stands on, seen from the listener (+x is right): the map
 * labels the box with it after the placement's number ("1L", "1R").
 */
export const PAIR_SIDE = { left: "L", right: "R" } as const;

/**
 * How near a dragged box must come to a wall, or to another box's face, to snap flush against it, in. The map's drag
 * passes it to the snap (lib/speaker/spaceCoupling `snapFlush`).
 */
export const SNAP_FLUSH_IN = 6;

/** A box is coupled with a surface or another box whose face is this near, m (lib/speaker/spaceCoupling). */
export const COUPLING_GAP_M = 0.01;

/** The floor, as a box's couplings name it beside the walls (`CoupledSurface`). */
export const COUPLED_FLOOR = "floor";

/** A side that is open: no wall stands there, so nothing couples with it or snaps to it. */
export const OPEN_SIDE = "open" as const satisfies RoomMaterial;

/** Each surface a box can be coupled with, as the placement's "Coupled with" line names it. */
export const COUPLED_NAMES: Record<CoupledSurface, string> = {
  floor: "floor",
  front: "front wall",
  back: "back wall",
  left: "left wall",
  right: "right wall",
};

/** The Target level a new space starts with (and the empty start, and a fill or Hi-fi preset that names none), dB SPL: as the default coverage layout. */
export const SPACE_HOME_TARGET_DB = 105;

/** Which part of a driver entry radiates, by id: its cone (in its chamber's air) or its HF section. */
export const DRIVER_PART = {
  cone: "cone",
  hf: "hf",
} as const;

/** The Place list's fixed choice ids: the stack and the speaker open now. */
export const PLACE_ID = {
  openStack: "open-stack",
  openSpeaker: "open-speaker",
} as const;

/** The Place list's id prefixes: a choice's id is its prefix and the preset, template or saved document it names. */
export const PLACE_ID_PREFIX = {
  stackPreset: "stack-preset:",
  speakerTemplate: "speaker-template:",
  savedStack: "saved-stack:",
  savedSpeaker: "saved-speaker:",
} as const;

/** The ear's height of a seated listener, ft. */
export const SEATED_EAR_FT = 3.5;

/** A placement turns freely on the floor: its yaw wraps within this half turn either way (never clamps), degrees. */
export const SPACE_YAW_DEG = 180;
/** How far a placement may tilt up or down, degrees. */
export const SPACE_PITCH_DEG = 30;

/** The highest lift under a placement, in (a tall stand, a fly bar). */
export const SPACE_LIFT_MAX_IN = 240;

/** The band a fill's Auto level is matched to the mains in (lib/speaker/solveFeeds): the voice range a fill is there for. */
export const FILL_ALIGN_BAND = "mid" satisfies CoverageBand;

/**
 * How much later than the mains a fill arrives in its area, ms, so the sound still seems to come from the mains (the
 * precedence effect): what a fill's Auto delay adds (lib/speaker/solveFeeds). 5 to 15 ms are usual:
 * `FILL_PRECEDENCE_MS` is the first, `FILL_PRECEDENCE_MAX_MS` the last.
 */
export const FILL_PRECEDENCE_MS = 5;
export const FILL_PRECEDENCE_MAX_MS = 15;

/** Why a solved delay is not what its rule asks, by id (lib/speaker/solveFeeds). */
export const DELAY_NOTE = {
  /** a fill that would need a delay under 0 ms: it is held at 0 and arrives late */
  clamped: "clamped",
  /** a fill with no main to line up with */
  noMain: "noMain",
} as const;

/** A main arriving at the listener within this of the latest main is on time (green), ms. */
export const ARRIVAL_MAIN_ON_TIME_MS = 1;
/** A main within this of the latest main is close (orange); beyond it, off (red), ms. */
export const ARRIVAL_MAIN_CLOSE_MS = 3;

/** How a box's arrival at the listener compares with the mains, by id (the status colors: green, orange, red). */
export const ARRIVAL_STATUS = { onTime: "onTime", close: "close", off: "off" } as const;

/** The Space page's 1 m reference: it averages each placement with a modeled stack or speaker, not two stacks. */
const SPACE_ONE_METER = "1 m from the speakers";
const SPACE_ONE_METER_TIP =
  "The mean level at ear height, 1 m in front of each placed stack or speaker that plays in the band, on its aim.";

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

/** The control that puts a stack or speaker in the space (the Placements section's first control). */
const ADD_PLACEMENT = "Add speaker or stack";

/** The DOM id of placement `k`'s item in the Placements list, so a pick on the map can scroll it into view. */
export const placementDomId = (k: number) => `space-placement-${k}`;

export const SPACE_TEXT = {
  /** the name a new space starts with */
  newName: "New Space",
  coverage: "Coverage",
  side: "Side view",
  /** the Side view heading's tooltip, and the one line under the drawing */
  sideTip:
    "The speakers seen from the side, to scale, at their height and tilt. Each dashed line shows where a speaker points: the axis of its highest band.",
  sideNote: "The cyan dot is the listener's ear.",
  response: "Response at the listener",
  levels: "Levels",
  /** the line on the map of a room with nothing placed */
  quietRoom: "Add a speaker or stack to hear the room.",
  noPlacements: `Nothing is placed yet. Pick a stack or speaker and press ${ADD_PLACEMENT}.`,
  missing: "A placement names a stack or speaker that is not in this space, so it is left out.",
  /** the empty start in "New from…" */
  empty: "Empty Space",
  addPlacement: ADD_PLACEMENT,
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
  /** a placement's folded row after its name: its spot from the center line and the front wall, ft, and its level, dB */
  placementSummary: (fromCenter: string, fromFront: string, level: string) =>
    `${fromCenter} ft from the center line · ${fromFront} ft from the front wall · ${level} dB`,
  mirrored: "Mirrored pair",
  mirroredTip:
    "Adds a copy on the other side of the center line. It mirrors this box's position and rotation.",
  /** a mirrored placement's folded row says it stands twice */
  pairSummary: "pair",
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
  delayTip: `Auto delays the early boxes so they arrive with the last one at the alignment point. A fill arrives ${FILL_PRECEDENCE_MS} ms after the mains in its area.`,
  /** an Auto delay: the time (ms) and the distance it equals (ft), already formatted */
  delayAuto: (ms: string, ft: string) => `Auto: ${ms} ms (${ft} ft)`,
  /** an Auto level, dB, already formatted */
  levelAuto: (db: string) => `Auto: ${db} dB`,
  fillLevelTip: "Auto plays this fill at the level of the nearest main, where the fill aims.",
  fill: "Fill",
  fillTip: `A fill plays ${FILL_PRECEDENCE_MS} ms after the nearest main, where it aims.`,
  delayClamped: "This fill arrives late even with no delay. Move it nearer to its area.",
  delayNoMain: "No main to line up with. Add a placement that is not a fill.",
  feedTip: "A level and a delay on this placement's feed (a fill under, and after, the mains).",
  ampPower: "Amp power",
  ampPowerHint: AMP_POWER_TIP,
  ampPowerTip:
    "The space finds each speaker's limit from it. A mirrored pair, and a speaker placed twice, share one figure.",
  /** a band's amp power field: the band (or a passive network's bands) it is for */
  ampPowerFor: (bands: string) => `${bands}: amp power, W`,
  alignment: "Alignment",
  alignmentHint: "The settings for each box and band, at the level and delay the space asks of it.",
  alignmentTip: "A delay, an all-pass filter or moving the box can give a time offset.",
  /** a band's filters, as a row's value: its corner and slope */
  highpass: (filter: string) => `High-pass ${filter}`,
  lowpass: (filter: string) => `Low-pass ${filter}`,
  fullRange: "Full range",
  /** a band's level, dB (already formatted) */
  levelIs: (db: string) => `Level ${db} dB`,
  noDelay: "No delay",
  /** a delay as a time (ms) and as the distance it equals: how far back the box would stand (in) */
  delayIs: (ms: string, inches: string) => `Delay ${ms} ms, or move the box ${inches} in back`,
  offsetNote: "Some boxes need a time offset to line up at their crossovers.",
  placementNote: "Some placements play later, to line up with other speakers in the room.",
  outdoors: "Outdoors",
  /** the Placements section's toggle: a dragged box snaps flush against a wall or another box */
  snapFlush: "Snap to walls & boxes",
  /** a placement's couplings line: its label, what it says when nothing is coupled, and its tooltip */
  coupledWith: "Coupled with:",
  coupledNothing: "nothing",
  coupledTip:
    "A floor, a wall, or another box right against this box adds bass, most for horn subs.",
  ear: "Ear height, ft",
  target: "Target level",
  /** the Target level's tooltip */
  targetTip:
    "The level the lowest band gets at the spot in Measured at. With More bass, each higher band is quieter.",
  measuredAt: "Measured at",
  /** the map's caption: the band, its target, dB (already formatted), and where it is measured */
  mapCaption: (band: string, target: string, place: string) =>
    `${band}, ${target} dB target at ${place}.`,
  /** the band levels' heading: each band at the listener */
  bandLevels: "Each band at the listener, at this level:",
  /** one band's level and target there, dB (already formatted) */
  bandLevel: (band: string, db: string, target: string) => `${band} ${db} dB (target ${target})`,
  targetCurve: "Target, band balance",
  listenerHint: "Tap the map, or drag the cyan dot, to move the listener.",
  alignAtHint: "Drag the magenta diamond to move the alignment point.",
  arrivals: "Arrival at the listener",
  arrivalsTip: `Each box against the last main. Mains want 0 ms. A fill wants ${FILL_PRECEDENCE_MS} to ${FILL_PRECEDENCE_MAX_MS} ms.`,
  /** one arrival row: the placement's name, then its time (ms) and distance (ft) after the last main, already formatted */
  arrivalIs: (name: string, ms: string, ft: string) => `${name}: ${ms} ms (${ft} ft)`,
  /** under the one-frequency slider */
  oneNote: "One frequency adds all sources with phase.",
  audienceAverage: "Audience average",
  audienceMax: "Audience at the limit",
  listener: "Listener",
  /** the share of the floor at or above a level against the target */
  floorAtLeast: (db: string) => `Floor ≥ ${db} dB`,
  spread: "Spread, 10–90 %",
  responseY: "dB SPL at the listener",
  /** the reference can't get the band's target: where it is measured (`COVERAGE_LEVEL_REF_PLACE`), dB */
  cannotReach: (target: number, atLimit: number) =>
    `It cannot reach ${target.toFixed(0)} dB: ${atLimit.toFixed(1)} dB at its limit.`,
  turnedDown: (db: number, target: number) =>
    `Turned down ${db.toFixed(1)} dB to reach ${target.toFixed(0)} dB.`,
  listenerVs: "The listener against the target:",
} as const;

/** The Space page's Details fold: its own groups and lines (the room's groups come from pages/space/assumptionGroups). */
export const SPACE_DETAILS = {
  map: "The map",
  mapLines: (limitHz: number) => [
    "Drag a placement to move it.",
    "Drag its dot to turn it.",
    "Drag the listener, or tap the floor to put the listener there.",
    "Drag the alignment point. The mains arrive together there.",
    "One frequency shows the interference between the placements.",
    `One frequency goes up to ${limitHz} Hz. Above it, the pattern is finer than the map.`,
  ],
  levels: "Levels",
  /** the target in the band on show, where it is measured (`SPACE_LEVEL_REF_PLACE`), dB */
  targetLine: (targetDb: number, place: string, bandDb: number) =>
    `Target: ${targetDb} dB SPL in the lowest band, at ${place} (${bandDb} dB in this band).`,
  moreBass: "With More bass, each band above a crossover is quieter.",
  flat: "With Flat, every band has the same target.",
  headroom: "The box with the least headroom sets the level.",
  turnDown:
    "Then the space is turned down once, until the lowest band gets the target at Measured at, never past the limit. The band on show does not change it.",
  perBand:
    "The map, the audience figures, Floor and Spread are for the band on show. Listener is in the lowest band.",
  bandLevel: "Each band plays at its Level and its box's level.",
  audience: (clearanceFt: number) =>
    `Audience average: the mean over the floor, except ${clearanceFt} ft around every box.`,
  oneMeter: (place: string) =>
    `${place}: the mean at ear height, 1 m in front of each placed stack or speaker that plays in the band, on its aim.`,
  boxes: "Boxes and drivers",
  boxLines: (listenM: number) => [
    "Each box plays through its crossover, level and delay.",
    `The stack's delays put the boxes in phase at the crossovers, ${listenM} m out.`,
    "Each driver covers the room from its own place and aim.",
    "A driver's place includes its cabinet's kick-back, its tilt in the stack and the placement's tilt.",
    "Each cone band has a first-order baffle-step shelf.",
  ],
} as const;

/** The saving row's nouns on the Space page (`SaveRowWords`, constants/saveRow). */
export const SPACE_SAVE_WORDS = {
  namePlaceholder: "Space name",
  savedList: "Saved Spaces",
  pick: (n: number) => `Saved Spaces (${n})`,
  noSaved: "No saved Spaces yet",
  newFromTip:
    "Starts a new Space, empty or from a preset. It replaces the current design. A preset brings its own room. A PA preset also sets the band balance to More bass.",
} as const satisfies SaveRowWords;
