// The Space page's figures and words (src/pages/space; the model in lib/speaker/spaceLayout and spaceCoverage).
import { AUTO_BALANCE_MODE, AUTO_BALANCE_MODE_LABEL } from "./autoBalance";
import type {
  CoupledSurface,
  StageFace,
  CoverageBand,
  CoverageLevelRef,
  CoverageRoom,
  FloorPoint,
  RoomMaterial,
  RoomSurface,
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

/** How far a driver's direct level on its axis falls below its level at 1 m where its beam in the 3D view ends, dB. */
export const BEAM_FALL_DB = 20;
/** A beam's edge lines: where its driver falls this far off its axis, dB (dashed), and this far (dotted, fainter). */
export const BEAM_EDGE_DB = 6;
export const BEAM_INNER_EDGE_DB = 3;

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

/** Shift held while turning a box on the map: its yaw steps in multiples of this, degrees. */
export const AIM_SNAP_DEG = 45;

/** While something is dragged on the map, the room model (and a dragged listener) moves at most this often, ms. */
export const MAP_DRAG_UPDATE_MS = 100;

/** A box is coupled with a surface or another box whose face is this near, m (lib/speaker/spaceCoupling). */
export const COUPLING_GAP_M = 0.01;

/** The floor, as a box's couplings name it beside the walls (`CoupledSurface`). */
export const COUPLED_FLOOR = "floor";

/** The ceiling, as a box's couplings name it (`CoupledSurface`), and as the room's materials name it. */
export const COUPLED_CEILING = "ceiling" as const satisfies RoomSurface;

/** A side that is open: no wall stands there, so nothing couples with it or snaps to it. */
export const OPEN_SIDE = "open" as const satisfies RoomMaterial;

/** Each surface a box can be coupled with, as the placement's "Coupled with" line names it. */
export const COUPLED_NAMES: Record<CoupledSurface, string> = {
  floor: "floor",
  ceiling: "ceiling",
  front: "front wall",
  back: "back wall",
  left: "left wall",
  right: "right wall",
};

/** A stage's outline, by id: a rectangle (its handles move its edges) or a polygon (its handles move each corner). */
export const STAGE_SHAPE = { rectangle: "rectangle", polygon: "polygon" } as const;

/** A stage's faces a box can be coupled with, by id: its front (toward the back wall), its back, a side, its top. */
export const STAGE_FACE = { front: "front", back: "back", side: "side", top: "top" } as const;

/** Each stage face as a "Coupled with" line names it after the stage's name ("Stage 1 front"). */
export const STAGE_FACE_NAMES: Record<StageFace, string> = {
  front: "front",
  back: "back",
  side: "side",
  top: "top",
};

/** How many corners a stage's outline has: a rectangle's corners and its edges' middles. */
export const STAGE_CORNERS = 8;

/** A stage and a riser as they are added, ft: a club stage of four 4 × 8 ft decks, and a DJ or drum riser of one. */
export const NEW_STAGE = { widthFt: 16, depthFt: 8, heightFt: 2 } as const;
export const NEW_RISER = { widthFt: 8, depthFt: 4, heightFt: 1 } as const;
/** A riser too big for its stage: a 4 × 4 ft deck, ft. */
export const NEW_RISER_SMALL = { widthFt: 4, depthFt: 4, heightFt: NEW_RISER.heightFt } as const;

/** The steps a new stage's spot is searched in, ft. */
export const STAGE_SPOT_STEP_FT = 0.5;

/** The steps a new placement's free spot is searched in, ft. */
export const PLACE_SPOT_STEP_FT = 0.25;

/** The smallest stage, sq ft. */
export const STAGE_MIN_AREA_SQFT = 4;

/** The narrowest side a stage's fields or handles give it, ft. */
export const STAGE_MIN_SIDE_FT = 1;

/** A stage's height above what it stands on, ft: the lowest and the highest. */
export const STAGE_HEIGHT_FT = [0.5, 8] as const;

/** A point this near a stage's edge is on it, ft. */
export const STAGE_ON_EDGE_FT = 0.02;

/** The Add stage/riser choice that puts a new stage on the floor (a riser's choice is its stage's id). */
export const STAGE_ON_FLOOR = "floor";

/** A new stage's id: its number, unique in its space. */
export const stageId = (n: number) => `stage-${n}`;

/** The DOM id of a stage's item in the Stages list, so a pick on the map can scroll it into view. */
export const stageDomId = (id: string) => `space-stage-${id}`;

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

/** The band Calculate gains matches a fill to the mains in (lib/speaker/solveFeeds): the voice range a fill is there for. */
export const FILL_ALIGN_BAND = "mid" satisfies CoverageBand;

/**
 * How much later than the mains a fill arrives in its area, ms, so the sound still seems to come from the mains (the
 * precedence effect): what Calculate delays adds for a fill (lib/speaker/solveFeeds). 5 to 15 ms are usual:
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

/** A band at the reference within this of its target is on it: the readout shows its level, not the gap, dB. */
export const BAND_ON_TARGET_DB = 0.5;
/** A band within this of its target is close (green); within `BAND_NEAR_DB`, near (orange); past it, off (red), dB. */
export const BAND_CLOSE_DB = 3;
export const BAND_NEAR_DB = 6;

/** How a box's arrival at the listener compares with the mains, by id (the status colors: green, orange, red). */
export const ARRIVAL_STATUS = { onTime: "onTime", close: "close", off: "off" } as const;

/** The Space page's 1 m reference: it averages each placement with a modeled stack or speaker, not two stacks. */
const SPACE_ONE_METER = "1 m from the speakers";
const SPACE_ONE_METER_TIP =
  "The mean level at ear height, 1 m in front of each placed stack or speaker that plays in the band, on its aim.";

/** The Space page's "Measured at" choices' names: the PA's, with its own 1 m reference. */
export const SPACE_LEVEL_REF_NAMES: Record<CoverageLevelRef, string> = {
  listener: COVERAGE_LEVEL_REFS[0][1],
  audience: COVERAGE_LEVEL_REFS[1][1],
  stacks: SPACE_ONE_METER,
};

/** The Space page's "Measured at" choices. */
export const SPACE_LEVEL_REFS: readonly ToggleOption<CoverageLevelRef>[] = COVERAGE_LEVEL_REFS.map(
  ([id]) =>
    id === COVERAGE_LEVEL_REF.stacks
      ? [id, SPACE_LEVEL_REF_NAMES[id], SPACE_ONE_METER_TIP]
      : [id, SPACE_LEVEL_REF_NAMES[id]],
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

/** The coverage map's key for its mark: the listener (the cyan circle). */
export const MAP_MARK_NAMES = { listener: "Listener" } as const;

/** Control labels that other UI text names (marked `**…**`). */
const DELAY = "Delay";
const MEASURED_AT = "Measured at";
const TARGET_LEVEL = "Target level";
const GAIN = "Gain";
const SYSTEM_GAIN = "System gain";
const CALCULATE_GAINS = "Calculate gains";
const CALCULATE_DELAYS = "Calculate delays";

/** A placement's Main / Fill choice, by whether it is a fill. */
export const PLACEMENT_ROLES: readonly ToggleOption<boolean>[] = [
  [false, "Main"],
  [true, "Fill"],
];

export const SPACE_TEXT = {
  /** the name a new space starts with */
  newName: "New Space",
  coverage: "Coverage",
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
  /** a placement's folded row after its name: its spot from the center line and the front wall, ft, and its gain, dB */
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
  height: "Height above floor, ft",
  /** the height field of a placement that stands on a stage */
  heightOnStage: "Height above stage, ft",
  /** where a placement on a stage stands: the stages, joined */
  standsOn: (where: string) => `On ${where}.`,
  heightTip: "The gap under it: a plinth, a stand, a fly bar.",
  yaw: "Rotation, °",
  yawTip: "Its turn on the floor from straight down the room. + turns toward the right side.",
  pitch: "Tilt, °",
  pitchTip: "+ tilts it up. A box's tilt in the stack and its cabinet's kick-back add to it.",
  upsideDown: "Upside down",
  gain: `${GAIN}, dB`,
  /** beside a placement's Gain: the least headroom of its bands, dB (already formatted) */
  headroomIs: (db: string) => `Headroom ${db} dB`,
  delay: `${DELAY}, ms`,
  delayTip: `The delay on this placement's feed. **${CALCULATE_DELAYS}** sets it.`,
  /** the Main / Fill choice's label and tooltip */
  role: "Main / Fill",
  roleTip: `**${CALCULATE_DELAYS}** and **${CALCULATE_GAINS}** treat a fill differently. A fill arrives after the nearest main, at that main's level.`,
  calculateDelays: CALCULATE_DELAYS,
  calculateDelaysTip: `Sets each **${DELAY}**. The main boxes arrive together at the **${MAP_MARK_NAMES.listener}**. Each fill arrives ${FILL_PRECEDENCE_MS} ms after the nearest main.`,
  /** a note from Calculate delays on one placement: its name, then the note */
  delayNoteFor: (name: string, note: string) => `${name}: ${note}`,
  delayClamped: "This fill arrives late even with no delay. Move it nearer to its area.",
  delayNoMain: "No main to line up with. Add a placement that is not a fill.",
  feedTip: "A gain and a delay on this placement's feed (a fill under, and after, the mains).",
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
    "Contact changes the load on this box. The low end and its maximum output can change.",
  ear: "Ear height, ft",
  target: TARGET_LEVEL,
  /** the Target level's tooltip */
  targetTip: `The level to compare with below the lowest crossover, at the **${MEASURED_AT}** location. With **${AUTO_BALANCE_MODE_LABEL[AUTO_BALANCE_MODE.moreBass]}**, the level is lower above each crossover.`,
  measuredAt: MEASURED_AT,
  systemGain: `${SYSTEM_GAIN}, dB`,
  systemGainTip: `The gain on all placements together. A box plays at its limit when its **${GAIN}** and this add to 0.`,
  calculateGains: CALCULATE_GAINS,
  calculateGainsTip: `Sets each main's **${GAIN}** so the bands it plays most meet their target at the **${MEASURED_AT}** location. Then it lowers **${SYSTEM_GAIN}** until no band is past its limit. Each fill gets the level of the nearest main.`,
  /** the map's caption: the band, its target, dB (already formatted), and where it is measured */
  mapCaption: (band: string, target: string, place: string) =>
    `${band}, ${target} dB target at ${place}.`,
  /** the band levels' heading: where they are measured (a Measured at choice) */
  bandLevelsAt: (place: string) => `At the **${place}**:`,
  /** one band there: on its target, its level; off it, how far, dB (already formatted) */
  bandLevel: (band: string, db: string) => `${band} ${db} dB`,
  /** a band's tooltip with More bass: its own target, dB (already formatted) */
  bandTarget: (db: string) => `Target ${db} dB`,
  /** after Calculate gains, when a limit holds System gain down: how far every band is under its target, dB (formatted) */
  belowTarget: (db: string) => `Every band is ${db} dB below the target.`,
  /** the band and the box that limit the system */
  limitsSystem: (band: string, box: string) =>
    `The **${band}** band of the **${box}** limits the system.`,
  /** a band a hand-set gain puts past its limit, and how far, dB (already formatted) */
  overLimit: (band: string, box: string, db: string) =>
    `The **${band}** band of the **${box}** is ${db} dB over its limit.`,
  targetCurve: "Target, band balance",
  arrivals: "Arrival at the listener",
  arrivalsTip: `Each box against the last main. Mains want 0 ms. A fill wants ${FILL_PRECEDENCE_MS} to ${FILL_PRECEDENCE_MAX_MS} ms.`,
  /** one arrival row: the placement's name, then its time (ms) and distance (ft) after the last main, already formatted */
  arrivalIs: (name: string, ms: string, ft: string) => `${name}: ${ms} ms (${ft} ft)`,
  /** under the one-frequency slider */
  /** under the single-frequency slider: where it still adds with phase */
  oneNote: (coherentHz: number) =>
    `One frequency adds all sources (including phase below ${coherentHz} Hz).`,
  audienceAverage: "Audience average",
  audienceMax: "Audience at the limit",
  listener: "Listener",
  /** the share of the floor at or above a level against the target */
  floorAtLeast: (db: string) => `Floor ≥ ${db} dB`,
  spread: "Spread, 10–90 %",
  responseY: "dB SPL at the listener",
  listenerVs: "The listener against the target:",
  /** the Stages section */
  addStage: "Add stage/riser",
  stageOnFloor: "Stage, on the floor",
  riserOn: (stage: string) => `Riser, on ${stage}`,
  noStages: "No stages",
  stageName: (n: number) => `Stage ${n}`,
  riserName: (n: number) => `Riser ${n}`,
  removeStage: (name: string) => `Remove ${name}`,
  /** a stage's folded row: its size, height, and where it stands (already formatted, ft) */
  stageSummary: (w: string, d: string, h: string, where: string) =>
    `${w} ft × ${d} ft · ${h} ft high · ${where}`,
  stageFromFront: (y: string) => `${y} ft from the front wall`,
  stageOn: (stage: string) => `on ${stage}`,
  /** a stage on the map: its name and the height of its top, ft (already formatted) */
  stageLabel: (name: string, topFt: string) => `${name}, ${topFt} ft`,
  shape: "Shape",
  rectangle: "Rectangle",
  polygon: "Polygon",
  stageFromCenterTip:
    "Its middle from the room's center line. + is to the right, seen from the listener.",
  stageFromFrontTip: "Its back edge from the front wall.",
  width: "Width, ft",
  depth: "Depth, ft",
  stageHeight: "Height, ft",
  stageHeightTip: "A riser's height is above its stage.",
  /** a stage's face, as a placement's "Coupled with" line names it */
  stageFace: (stage: string, face: StageFace) => `${stage} ${STAGE_FACE_NAMES[face]}`,
} as const;

/** The Space page's Details fold: its own groups and lines (the room's groups come from pages/space/assumptionGroups). */
export const SPACE_DETAILS = {
  /** the first group: what the listener does */
  marks: MAP_MARK_NAMES.listener,
  markLines: [
    "It shows the level, the response, and the arrivals at its location.",
    `**${CALCULATE_DELAYS}** makes the main boxes arrive together here.`,
    "Moving it does not change a delay or a level.",
    "Tap the map, or drag the cyan dot, to move it.",
  ],
  map: "The map",
  mapLines: (limitHz: number, coherentHz: number) => [
    "Drag a placement to move it.",
    "Drag its dot to turn it.",
    "Drag the listener, or tap the floor to put the listener there.",
    `One frequency shows the interference between the placements (below ${coherentHz} Hz).`,
    `One frequency goes up to ${limitHz / 1000} kHz. Above ${coherentHz} Hz, it adds the placements by power.`,
  ],
  levels: "Levels",
  /** the target in the band on show, where it is measured (`SPACE_LEVEL_REF_PLACE`), dB */
  targetLine: (targetDb: number, place: string, bandDb: number) =>
    `Target: ${targetDb} dB SPL in the lowest band, at ${place} (${bandDb} dB in this band).`,
  moreBass: "With More bass, each band above a crossover is quieter.",
  flat: "With Flat, every band has the same target.",
  headroom: `A box plays at its limit when its **${GAIN}** and the **${SYSTEM_GAIN}** add to 0.`,
  turnDown: `**${CALCULATE_GAINS}** lowers **${SYSTEM_GAIN}** until no band is past its limit.`,
  perBand:
    "The map, the audience figures, Floor and Spread are for the band on show. Listener is in the lowest band.",
  bandLevel: "Each band plays at its gain and its box's gain.",
  audience: (clearanceFt: number) =>
    `Audience average: the mean over the floor, except ${clearanceFt} ft around every box.`,
  oneMeter: (place: string) =>
    `${place}: the mean at ear height, 1 m in front of each placed stack or speaker that plays in the band, on its aim.`,
  stages: "Stages",
  stageLines: [
    "Each stage is solid.",
    "Its edges act as walls for the boxes beside it.",
    "A riser stands on a stage. Its height is above that stage.",
    "Stages can touch, but they cannot overlap.",
    "A box stands on the highest stage under its middle.",
    "Drag a stage to move it. Drag it onto a stage to make it a riser.",
    "Drag its handles to change its size or its corners.",
  ],
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

/** The name of each wall's and the ceiling's mesh in the 3D view (stack-view/buildSpaceScene), so a check can find them. */
export const ROOM_SURFACE_NAME = "roomSurface";
