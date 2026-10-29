// The Speaker page's names and choices (src/pages/speaker): the spec's ids as the page shows them.
import type { FOLD_WALL, SLOT_KIND, SLOT_PLACE, TUBE_ENDS, TUBE_LAYOUT } from "./speakerSpec";
import type {
  ArchBlock,
  ChamberLoad,
  DriverKind,
  ElbowCount,
  FilterType,
  HifiBoxKind,
  HifiDrive,
  HornDrive,
  HornGoalLimit,
  HornPath,
  HornPlacement,
  SpeakerModelGap,
  SpeakerPort,
  VentPanel,
} from "../types";
import { CABINET_CONSTRUCTION_NAMES, FIRST_ORDER_FILTER } from "./speakerSpec";
import {
  BOX_LOAD_NAME,
  HORN_IMPORT_NAME,
  HORN_TYPE_NAME,
  SETTINGS_TEXT,
  START_FROM_GOALS,
} from "./speakerSettings";
import { HORN_PROFILE_NAMES } from "./hornEngine";
import { CUTLIST_TAB_NAME } from "./pages";
import { UI_TEXT } from "./uiText";
import { GAIN_LABEL, PAD_LABEL } from "./controlLabels";
import { FOLD_DRIVERS_REASON } from "./foldHorn";

// Settings that a tip in the same table names (`**name**`): each name once, before the tables use it.
const HORN_START_NAME = "Start area";
const HORN_END_NAME = "End area";
const PORT_LENGTH_NAME = "Length";
const SLOT_KIND_NAME = "Slot type";
const SLOT_FINS_NAME = "Fins";
const SLOT_COUNT_NAME = "Count";
const SLOT_FOLD_NAME = "Fold";
const STRAIGHT_HORN_NAME = "Straight horn";
const HORN_STEPS_OFF_NAME = "Off";
const HORN_STEPS_ON_NAME = "On";

/** The horn picker's first choice: no horn. */
export const NO_HORN_NAME = "None";

/** Each driver kind as the Speaker page names it: the catalog table it picks from. */
export const DRIVER_KIND_NAMES = {
  sub: "Sub",
  mid: "Mid-bass",
  compression: "Compression driver",
  woofer: "Woofer",
  tweeter: "Tweeter",
  coaxial: "Coaxial",
} as const satisfies Record<DriverKind, string>;

/**
 * The driver picker's types: one woofer list for the three woofer kinds (subwoofer, mid-bass, woofer), with
 * their size as a filter, then the other kinds.
 */
export const DRIVER_TYPE_NAMES = {
  woofer: "Woofer",
  compression: "Compression driver",
  tweeter: "Tweeter",
  coaxial: "Coaxial",
} as const satisfies Partial<Record<DriverKind, string>>;

/** The woofer size filter's first choice: every size. */
export const ALL_SIZES = "All sizes";

/** A woofer size as the size filter and the list's groups name it. */
export const wooferSizeName = (size: number) => `${size} in`;

/** Each vent kind as the Speaker page names it. */
export const VENT_KIND_NAMES = {
  sealed: "Sealed",
  vented: "Vented",
  radiator: "Passive radiator",
} as const satisfies Record<HifiBoxKind, string>;

/** Each port shape as the Speaker page names it. */
export const PORT_SHAPE_NAMES = {
  round: "Round",
  slot: "Slot",
  duct: "Side ducts",
} as const satisfies Record<NonNullable<SpeakerPort["shape"]>, string>;

/** Each slot kind as the Speaker page names it (`SLOT_KIND`). */
export const SLOT_KIND_NAMES = {
  letterbox: "Divided slot",
  plain: "Open slot",
} as const satisfies Record<keyof typeof SLOT_KIND, string>;

/** The tooltip of each slot kind (`SLOT_KIND`). */
export const SLOT_KIND_TIPS = {
  letterbox:
    "A wide slot along the bottom of the front, split by dividers. Its opening is at the floor.",
  plain: "A rectangular opening in the front or the back, with no dividers.",
} as const satisfies Record<keyof typeof SLOT_KIND, string>;

/** Each slot position as the Speaker page names it (`SLOT_PLACE`). */
export const SLOT_PLACE_NAMES = {
  floor: "Floor",
  sides: "Front sides",
} as const satisfies Record<keyof typeof SLOT_PLACE, string>;

/** Each kind of round tube end as the Speaker page names it (`TUBE_ENDS`). */
export const TUBE_ENDS_NAMES = {
  flared: "Flared",
  plain: "Plain",
} as const satisfies Record<keyof typeof TUBE_ENDS, string>;

/** Each layout of flared tubes as the Speaker page names it (`TUBE_LAYOUT`). */
export const TUBE_LAYOUT_NAMES = {
  row: "Row at the bottom",
  corners: "Corners",
} as const satisfies Record<keyof typeof TUBE_LAYOUT, string>;

/** The elbows a round tube can have, as the Speaker page names each count (lib/build/tubeFold `ELBOW_COUNTS`). */
export const ELBOW_COUNT_NAMES = {
  0: "None",
  1: "One",
  2: "Two",
} as const satisfies Record<ElbowCount, string>;

/** Whether a plain slot can fold up the back, as the Speaker page names each choice. */
export const SLOT_FOLD_NAMES = {
  straight: "No",
  folded: "Up the back",
} as const;

/** The filter types a band offers, in the order the picker lists them, and the name each shows. */
export const FILTER_TYPE_NAMES = {
  [FIRST_ORDER_FILTER]: "1st order (6 dB/oct)",
  BW24: "BW24",
  LR24: "LR24",
  BW48: "BW48",
  LR48: "LR48",
} as const satisfies Record<FilterType, string>;

/** Where a setting's value comes from, by id: worked out by its rule (Auto), or typed in (Manual). */
export const SET_BY = {
  auto: "auto",
  // shown as Manual; the key keeps its old name
  custom: "custom",
} as const;

/** The name the settings show for each. */
export const SET_BY_NAMES = {
  auto: "Auto",
  custom: "Manual",
} as const satisfies Record<keyof typeof SET_BY, string>;

/** The panels a vent can be cut into, as the Speaker page names them. */
export const VENT_PANEL_NAMES = {
  baffle: "Baffle",
  back: "Back",
} as const satisfies Record<VentPanel, string>;

/** Each place a horn on a driver can sit, as the Speaker page names it (`HORN_PLACEMENT`). */
export const HORN_PLACEMENT_NAMES = {
  baffle: "Baffle-mounted",
  top: "Freestanding",
} as const satisfies Record<HornPlacement, string>;

/** Why a horn can't sit in a place, by place (the place's button shows it). */
export const HORN_PLACEMENT_NO_FIT = {
  baffle: "The horn mouth is larger than the clear face of the chamber.",
  top: "Another chamber is on the top of this chamber.",
} as const satisfies Record<HornPlacement, string>;

/** How a chamber's drivers meet the air, as the chamber's Type setting names it (`CHAMBER_LOAD`). */
export const CHAMBER_LOAD_NAMES = {
  direct: BOX_LOAD_NAME,
  horn: "Horn",
} as const satisfies Record<ChamberLoad["kind"], string>;

/** How a horn's path runs, as the Horn settings name it (`HORN_PATH`). */
export const HORN_PATH_NAMES = {
  straight: "Straight",
  folded: "Folded",
} as const satisfies Record<HornPath, string>;

/** What limits a horn's maximum output, as the goals check names it (`HORN_GOAL_LIMIT`). */
export const HORN_GOAL_LIMIT_NAMES = {
  power: "the power rating",
  excursion: "cone travel",
} as const satisfies Record<HornGoalLimit, string>;

/** How a horn's drivers drive its path, as the Horn settings name it (`HORN_DRIVE`). */
export const HORN_DRIVE_NAMES = {
  front: "Front-loaded",
  offset: "Offset",
  tapped: "Tapped",
  back: "Rear-loaded",
} as const satisfies Record<HornDrive["kind"], string>;

/** Each band's crossover as the Speaker page names it (the ids are the saved drive values: active, passive). */
export const DRIVE_NAMES = {
  active: "External",
  passive: "Internal",
} as const satisfies Record<HifiDrive, string>;

/** Why an arched top stays flat, by `ARCH_BLOCK` id: the condition the cabinet misses, in words. */
export const ARCH_BLOCK_TEXT = {
  frame: `An arch needs the **${CABINET_CONSTRUCTION_NAMES.frameInset}** construction.`,
  shell: "An arch needs all chambers in one box: the same depth, with no gaps.",
  topChambers: "An arch needs one chamber at the top.",
  width: "An arch needs the top chamber to be the full width of the box.",
  height: "An arch needs the top chamber to be at least half as tall as the box is wide.",
} as const satisfies Record<ArchBlock, string>;

/**
 * Why the model leaves a chamber or driver out, and what to change, in words: the notices name the chamber, the reason
 * (`why`) and the change (`fix`).
 */
export const MODEL_GAP_TEXT = {
  unknownDriver: { why: "a driver is not in its catalog", fix: "Choose the driver again." },
  mixedDrivers: {
    why: "cone drivers of different models, or on different bands, share its air",
    fix: "Use one driver model on one band in a chamber, or give each model its own chamber.",
  },
  noHf: {
    why: "a driver has no published HF sensitivity",
    fix: "Choose a driver that has one.",
  },
  unknownRadiator: {
    why: "the passive radiator is not in the catalog",
    fix: "Choose the radiator again.",
  },
  noModel: {
    why: "the box cannot be calculated from these sizes (air, vent, counts)",
    fix: "Set the air, the vent size, and the driver counts above zero.",
  },
  badFilter: {
    why: "a band filter has a corner that is not a positive frequency",
    fix: `Set each filter **${SETTINGS_TEXT.corner}** above 0 Hz.`,
  },
  backLoaded: {
    why: "a rear-loaded horn is not calculated",
    fix: `Use a **${HORN_DRIVE_NAMES.front}**, **${HORN_DRIVE_NAMES.offset}**, or **${HORN_DRIVE_NAMES.tapped}** horn.`,
  },
  taps: {
    why: "a cone side does not sit between two flare sections",
    fix: "Set each cone side between two sections, the front before the back.",
  },
  tappedVent: {
    why: "a tapped horn has no vent",
    fix: `Set **${SETTINGS_TEXT.ventType}** to **${VENT_KIND_NAMES.sealed}**.`,
  },
  driver: {
    why: "the horn needs one kind of cone driver with Thiele/Small data",
    fix: "Use one cone driver model that lists them in this chamber.",
  },
  segment: {
    why: "a horn section has an area or a length that is not above zero",
    fix: `Set each section's **${HORN_START_NAME}**, **${HORN_END_NAME}**, and **${PORT_LENGTH_NAME}** above zero.`,
  },
  vent: {
    why: "a horn with this vent is not calculated",
    fix: `Use a **${VENT_KIND_NAMES.sealed}** chamber, **${PORT_SHAPE_NAMES.round}** tubes, or a **${PORT_SHAPE_NAMES.slot}**.`,
  },
  drawing: {
    why: "the drawn horn has no passage from the cones to the mouth",
    fix: "Put the drivers on a board so that one side of the cones opens into the passage.",
  },
} as const satisfies Record<SpeakerModelGap, { why: string; fix: string }>;

/** The folded-horn path chart's labels. */
export const FOLD_CHART_TEXT = {
  label: "Passage area against distance from the closed end",
  /** the axes' titles, with their unit */
  xAxis: (unit: string) => `distance from the closed end, ${unit}`,
  yAxis: (unit: string) => `area, ${unit}`,
  traced: "Drawn passage",
  target: "Straight horn",
  taps: "Taps",
  front: "front",
  back: "back",
  /** the readout at the place pointed at: distance, width, area (formatted, with their units) */
  at: (distance: string, width: string, area: string) => `${distance} · ${width} wide · ${area}`,
} as const;

/** The folded horn editor's tools, by id, as their buttons name them. */
const FOLD_TOOL_NAMES = {
  move: "Move",
  board: "Add board",
  remove: "Remove",
  drivers: "Drivers",
  mouth: "Mouth",
  vent: "Vent",
  square: "Square joint",
} as const;

/** The folded horn editor's tools, as their buttons and tooltips name them, and its marks. */
export const FOLD_EDITOR_TEXT = {
  /** the chamber's name at the start of the tool row, by its place (only with more than one chamber) */
  chamber: (n: number) => `Chamber ${n}`,
  tools: "Drawing tools",
  move: `**${FOLD_TOOL_NAMES.move}**: drag a board, the end of a board, or driver(s).`,
  board: `**${FOLD_TOOL_NAMES.board}**: click and drag. The ends snap onto walls and other boards.`,
  remove: `**${FOLD_TOOL_NAMES.remove}**: click a board, a corner, the drivers, or the vent.`,
  drivers: `**${FOLD_TOOL_NAMES.drivers}**: click a board to put them there. Click again to turn them.`,
  mouth: `**${FOLD_TOOL_NAMES.mouth}**: click a wall to move the mouth there. Drag its ends to adjust.`,
  vent: `**${FOLD_TOOL_NAMES.vent}**: click a wall next to the rear chamber to add a vent there. Drag its ends to adjust.`,
  square: `**${FOLD_TOOL_NAMES.square}**: click a joint to hold it at 90°. Click again to free it.`,
  undo: "Undo (Ctrl+Z or Cmd+Z)",
  closedEnd: "closed end",
  label: "Side view of the folded horn. The baffle is at the left.",
  notDrawn: "Draw the folded horn. Until then, the response shows the straight horn.",
  /** the drawing's legend, under it */
  legend: {
    boards: "boards",
    passage: "passage, dark at the closed end",
    sealed: "sealed air",
    ported: "vented air",
    drivers: "drivers (the line is the cone)",
    mouth: "mouth",
    vent: "vent",
    joint: "joint",
    held: "held at 90°",
  },
} as const;

/**
 * The straight horn's editor (#255, the draw-first mock): its tool's tip, the drawing's label, the throat's tile and
 * the legend's own entries. Its other tiles and legend entries reuse the folded horn editor's.
 */
export const STRAIGHT_EDITOR_TEXT = {
  move: `**${FOLD_TOOL_NAMES.move}**: drag the driver board, a throat corner, or a wall.`,
  label: "Top view of the straight horn. The front is at the bottom.",
  throat: "Throat",
  legend: {
    flare: "flare",
    drivers: "drivers",
    handle: "drag to change",
  },
} as const;

/** The folded horn's figures, as their tiles name them. */
export const FOLD_STAT_TEXT = {
  path: "Path",
  mouth: "Mouth",
  taps: "Taps from closed end",
  rear: "Rear chamber",
  vent: "Vent",
  match: "Off the straight horn",
  /** where the cones open, in from the closed end: one or two formatted lengths */
  tapsAt: (front: string | null, back: string | null) =>
    [front, back].filter((t) => t !== null).join(" and ") || "none",
  /** the vent's duct: its height and its length (both formatted), then their unit, as "1.5 × 6 in" */
  ventSize: (height: string, length: string, unit: string) => `${height} × ${length} ${unit}`,
} as const;

/** What each check on a drawn horn says (`FOLD_CHECK`), from its figures (lengths formatted). */
export const FOLD_CHECK_TEXT = {
  mouth: () => "The mouth opens onto a board. Move the mouth or the board.",
  drivers: (reason: (typeof FOLD_DRIVERS_REASON)[keyof typeof FOLD_DRIVERS_REASON]) =>
    reason === FOLD_DRIVERS_REASON.none
      ? `Place driver(s): use the **${FOLD_TOOL_NAMES.drivers}** tool on a board.`
      : reason === FOLD_DRIVERS_REASON.blocked
        ? "Both sides of the cones face a board. Move the drivers or the boards."
        : "Neither side of the cones opens into the passage. Move the drivers or the mouth.",
  rearChamber: () => "One side of the cones faces a board with no air behind it.",
  deadEnd: (at: string) =>
    `The cones first open ${at} from the closed end. That is a long dead end behind them. Move them nearer the closed end.`,
  choke: (at: string) => `The passage narrows sharply ${at} from the closed end.`,
  /** the clearance, with its unit */
  magnet: (clear: string) => `A driver's motor is within ${clear} of a board or a wall.`,
  cutout: () => "A driver's cutout runs off its board.",
  strayAir: (count: number) =>
    count === 1
      ? "One pocket of sealed air does nothing."
      : `${count} pockets of sealed air do nothing.`,
  thin: (at: string, width: string) =>
    `The passage is only ${width} wide ${at} from the closed end.`,
  ventBlocked: () => "The vent opens onto a board. Move the vent or the board.",
  ventLeak: () => "The vent opens into the horn's passage. Move the vent or add a board.",
  ventStray: () => "The vent opens into air that no driver uses.",
  ventNoAir: () => "The vent's duct fills all the air behind it. Leave a chamber behind the duct.",
  /** the drawing makes a different horn type than the Horn type setting */
  typeDiffers: (drawn: string, set: string) =>
    `The drawing traces as **${drawn}**. **${HORN_TYPE_NAME}** is set to **${set}**.`,
} as const;

/** The Speaker page's results headings and chart labels. */
export const SPEAKER_TEXT = {
  /** the horn's path does not fit its chamber: what it needs, as formatted lengths */
  hornNoRoom: (needs: { depth: string; height: string }) =>
    `A horn path does not fit its chamber. It needs ${needs.depth} of depth and ${needs.height} of height.`,
  hornMouthClipped:
    "A horn mouth is larger than the face its chamber leaves it (the clear face, less any side slots). The views draw it at that face, with a smaller flare.",
  hornMouthMoved:
    "A horn mouth is set outside the face its chamber leaves it (the clear face, less any side slots). The views move it to the nearest place that fits.",
  ventMoved:
    "A vent or radiator is set outside the clear face of its chamber. The views move it to the nearest place that fits.",
  response: "Response",
  chambers: "Chambers",
  bands: "Bands",
  sum: "Sum",
  yLabel: "dB SPL, 2.83 V, 1 m",
  noBands: `No band has a driver the app can calculate. Add a driver to a chamber and select its **${SETTINGS_TEXT.band}**.`,
  /** a chamber the model leaves out: its number, why, and what to change */
  chamberGap: (n: number, gap: { why: string; fix: string }) =>
    `Chamber ${n}: ${gap.why}. ${gap.fix}`,
  /** a part of the speaker the model leaves out that no chamber owns (a band filter): why, and what to change */
  speakerGap: (gap: { why: string; fix: string }) => `${gap.why}. ${gap.fix}`,
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL, 1 m",
  speakerMax: "Speaker max",
  chamber: "Chamber",
  noFilter: "None",
  /** a band the user adds, by its place among the bands */
  newBandName: (n: number) => `Band ${n}`,
  weight: "Weight",
  /** a chamber's tiles: its net air, and a ported chamber's tuning */
  netAir: "Net air",
  fb: "Fb",
  /** a chamber's weight tile, by its place */
  chamberWeight: (n: number) => `Chamber ${n} weight`,
  noBraces: "no braces",
  /** the Construction summary when the cabinet has no bracing (`NO_BRACING`) */
  hornNoFit: "A horn does not fit where it is mounted. The views and the cutlist do not show it.",
  /** the driver board's cutlist note: where the drivers mount, how a doubled board is glued, and each cone's cutout */
  driverBoardNote: (pieces: number) =>
    pieces > 1
      ? "the drivers mount on its back; glue the pieces face to face"
      : "the drivers mount on its back",
  driverBoardCutout: (count: number, kind: string, cutout: string) =>
    `${count} × ${kind.toLowerCase()} cutout, ${cutout}`,
  hornNoFitNote:
    "the horn does not fit where it is mounted; no cutout until you change the mounting",
  /** the horn mouth's opening on a wall's cutlist note: its size and where it sits */
  hornMouthNote: (w: string, h: string, where: string) =>
    `horn mouth: ${w} × ${h}″ opening, ${where}`,
  /** the drawn rear chamber's vent opening on a wall's cutlist note: its size and where it sits */
  hornVentNote: (w: string, h: string, where: string) => `vent: ${w} × ${h}″ opening, ${where}`,
  /** where an opening in the top or the bottom sits: its two ends, back from the baffle's inside face */
  foldOpeningDepth: (from: string, to: string) =>
    `${from}″ to ${to}″ back from the baffle's inside face`,
  /** a note on the top and bottom row that applies to one of the two panels: `wall` is its name */
  foldWallOnly: (wall: string, note: string) => `${wall} only: ${note}`,
  /** the drivers' cutouts on the board they mount on: how many, and each one's diameter (formatted, in inches) */
  foldDriverCutNote: (count: number, diameter: string) =>
    `${count} × ${diameter}″ round driver cutout${count > 1 ? "s" : ""}`,
  /**
   * a folded horn board's cutlist note: its number, then its two ends' cuts, or one cut when both ends are alike. A
   * semicolon starts a new line of the row's notes, so the note has none.
   */
  foldBoardNote: (board: number, first: string, second: string) =>
    first === second
      ? `Horn board ${board}: ${first} at both ends`
      : `Horn board ${board}: ${first} at one end, ${second} at the other`,
  /** a folded horn board's end cut, `deg` off square (empty: square), by what it meets (`board` counts from 1) */
  foldEndFree: "square",
  foldEndCorner: (deg: string, board: number) =>
    deg ? `${deg}° miter to board ${board}` : `square to board ${board}`,
  foldEndWall: (deg: string, wall: string) =>
    deg ? `${deg}° bevel to the ${wall}` : `square to the ${wall}`,
  foldEndButt: (deg: string, board: number) =>
    deg ? `${deg}° bevel butt on board ${board}` : `square butt on board ${board}`,
  portTooLong: "too long for this chamber: make it shorter",
  slotTooLong: "too long to run straight in this chamber: make it shorter, or fold it",
  slotTooLongFolded: "too long to fold in this chamber: make it shorter",
  /** the cutlist's notes for slots up the front sides: the openings on the baffle, and the walls that close them */
  sideSlotOpening: (n: number, w: string, h: string) =>
    `${n} × slot up the front sides, one side then the other: ${w}″ wide, ${h}″ tall openings against the side walls, standing on the bottom panel`,
  sideSlotWalls: (n: number, w: string) =>
    `walls of the ${n} side slots: each ${w}″ in from its side wall, as tall as its opening, running back from the baffle`,
  inputRange: "External crossover",
  construction: "Construction",
  top: "Top",
  inset: "Baffle inset",
  insetTip: "How far the baffle is behind the front edge of the frame.",
  wallPanel: "Wall panels",
  /** the wall panels' tooltip, with the frame box's baffle thickness in words */
  wallPanelTip: (baffle: string) =>
    `The panel size of the sides, top, bottom, and back. On a frame box, the baffle stays ${baffle}. On a flush box, the baffle is this size too. Thinner walls get more braces.`,
  /** the construction summary's wall panels, by their thickness in words */
  wallPanelSummary: (t: string) => `${t} walls`,
  braceTarget: "Bracing target",
  /** the target's tooltip, with the default target in words */
  braceTargetTip: (def: string) =>
    `Braces are added until the first resonance of each panel is above this frequency. Default: ${def}.`,
  /** under the Top choice when an arched top cannot apply: the start of the reason (`ARCH_BLOCK_TEXT`) */
  archFlat: "The top stays flat.",
  placeTip: `**${SET_BY_NAMES.auto}**: the chamber's layout places it. **${SET_BY_NAMES.custom}**: you set the position of its center.`,
  portPlace: "Vent position",
  radiatorPlace: "Radiator position",
  mouthPlace: "Horn mouth position",
  panel: "Panel",
  slotNarrow: "Opening, narrow side",
  slotNarrowTip:
    "An open slot always runs the full inside width of the chamber, or the full inside height on the front sides. This size sets its area.",
  slotHeight: "Slot height",
  portLength: PORT_LENGTH_NAME,
  slotKind: SLOT_KIND_NAME,
  slotKindTip: `**${SLOT_KIND_NAMES.letterbox}**: a slot along the floor, split by fins. **${SLOT_KIND_NAMES.plain}**: a rectangular opening with no fins.`,
  slotPlace: "Slot position",
  slotPlaceTip: `**${SLOT_PLACE_NAMES.floor}**: the slots stack up from the floor. **${SLOT_PLACE_NAMES.sides}**: the slots stand on the floor against the side walls, beside the horn mouth.`,
  slotFins: SLOT_FINS_NAME,
  slotFinsTip:
    "Fins split a divided slot into equal openings. Each fin is as thick as the walls. The default is two.",
  slotKindResets: `Switching **${SLOT_KIND_NAME}** resets the other type's settings: **${SLOT_FINS_NAME}**, or **${SLOT_COUNT_NAME}** and **${SLOT_FOLD_NAME}**.`,
  slotFolds: "The slot is too long to run straight. It folds up the back.",
  slotStraight: "The slot runs straight along the floor.",
  slotCount: SLOT_COUNT_NAME,
  slotFold: SLOT_FOLD_NAME,
  slotFoldTip: `**${SLOT_FOLD_NAMES.folded}**: if the slot is too long to run straight, it folds up the back wall. **${SLOT_FOLD_NAMES.straight}**: the slot must fit straight.`,
  tubeEnds: "Tube ends",
  tubeEndsTip: `**${TUBE_ENDS_NAMES.flared}**: tubes with flared ends. They need a sub driver in this chamber. **${TUBE_ENDS_NAMES.plain}**: plain round tubes.`,
  tubeEndsNoSub: `**${TUBE_ENDS_NAMES.flared}** tubes need a cone driver in this chamber.`,
  tubeLayout: "Tube position",
  elbows: "Elbows",
  elbowsTip:
    "The bends in each tube. Each bend adds a little to the length that the air sees, so the vent tunes lower.",
  /** the side ducts' dividers' tooltip: the shared tip, and which thickness each size takes */
  ductDividersTip: `${UI_TEXT.ductDividersTip} Dividers of the wall size have the thickness of the walls. You can measure it on the **${CUTLIST_TAB_NAME}** tab. Dividers of a different size have the default thickness.`,
  ventFixed: "The shape of this vent sets its position.",
  load: "Type",
  loadTip: `**${CHAMBER_LOAD_NAMES.direct}**: the cones radiate from the baffle. **${CHAMBER_LOAD_NAMES.horn}**: a horn in the box. A new horn has one conical section from the cones to the clear face.`,
  loadNoCone: "A horn needs a cone driver with Thiele/Small parameters in this chamber.",
  horn: "Horn",
  hornSections: "Flare sections",
  hornSection: (n: number) => `Section ${n}`,
  hornProfile: "Profile",
  hornStart: HORN_START_NAME,
  hornEnd: HORN_END_NAME,
  hornCompression: "Compression ratio",
  hornCompressionTip:
    "How much of the cone the horn walls cover. A higher ratio loads the cone more. It makes lower frequencies louder and high frequencies quieter, with faster air at the throat.",
  hornFrontChamber: "Front chamber",
  /** added to the front chamber's tip when the catalog gives no surround width or cone depth */
  hornFrontChamberEstimate:
    "The datasheet does not give the surround width or the cone depth, so this value uses estimates.",
  hornFrontChamberTip:
    "The air between the cones and the back edges of the horn walls, with the cutouts in the driver board. The edges stay clear of full cone travel. The drivers and the board set this value.",
  hornBoard: "Driver board thickness",
  hornBoardWall: "Wall",
  hornBoardDouble: "Double",
  hornPath: "Path",
  hornDrive: HORN_TYPE_NAME,
  hornTap: "Tap after section",
  hornTapTip: "Where the front of the cones joins the horn, counted from the closed end.",
  hornFrontTap: "Front tap after section",
  hornFrontTapTip:
    "Where the front and back of the cones join the horn, counted from the closed end.",
  hornRearTap: "Back tap after section",
  hornRearTapTip:
    "Where the front and back of the cones join the horn, counted from the closed end.",
  /** the line under a tapped horn's settings: what the chamber's volume is */
  hornTappedAir: "The chamber's net air is the air behind the cones.",
  /** why a tapped horn's chamber takes no vent */
  hornGoals: "Target band",
  hornGoalLow: "Lowest",
  hornGoalLowTip: "Lowest flat frequency goal.",
  hornGoalHigh: "Highest",
  hornGoalHighTip: "Highest flat frequency goal. Usually the crossover.",
  hornGoalTarget: "Level at 1 m",
  hornGoalTargetTip: "Level at full power goal.",
  hornDesign: START_FROM_GOALS,
  hornDesigning: "Starting…",
  hornDesignFailed: "No horn for these goals can be calculated in this chamber.",
  hornGoalsOrder: "Set the highest frequency above the lowest.",
  /** the goals check: how flat the response is over the goals' band */
  hornFitSpread: (spread: string, low: string, high: string) =>
    `**${SPEAKER_TEXT.response}**: within ${spread} dB from ${low} to ${high} Hz.`,
  /** the goals check: the level at the lowest frequency, when it falls more than the usual corner under the band */
  hornFitLowEdge: (db: string) => `At the lowest frequency it is ${db} dB quieter than the band.`,
  /** the goals check: the lowest maximum output over the band, where it is, and what limits it */
  hornFitMaxOut: (db: string, hz: string, limit: string) =>
    `**${SPEAKER_TEXT.maxOutput}**: ${db} dB at ${hz} Hz, limited by ${limit}.`,
  /** the goals check: how far the maximum output falls under the target level */
  hornFitShort: (db: string) => `That is ${db} dB quieter than the target.`,
  /** the goals check: the horn holds more air than the chamber has (the volumes with their unit) */
  hornFitAir: (horn: string, chamber: string) =>
    `The horn holds ${horn}. The chamber has only ${chamber} of air.`,
  hornImport: HORN_IMPORT_NAME,
  hornImportTip: `Paste the text of a Hornresp record. It sets the **${STRAIGHT_HORN_NAME}**, the **${HORN_TYPE_NAME}**, the taps, the **${SETTINGS_TEXT.rearChamber}**, and the **${SETTINGS_TEXT.vent}**. The drivers stay as set in this chamber.`,
  hornImportField: "Record text",
  hornImportAction: "Import",
  hornImportDone: "Imported. The drivers stay as set in this chamber.",
  hornImportFailed: (reason: string) =>
    `This record cannot be imported: ${reason.replace(/\.$/, "")}.`,
  /** after a tapped record with a front chamber: the cones and the walls set it here */
  hornImportFrontChamber: "The record's front chamber is not used. The cones and the walls set it.",
  hornImportNoHorn: "it has no horn",
  /** the note under a section that starts with a step, by the section's number */
  hornStep: (n: number) =>
    `Section ${n} starts at a different area than section ${n - 1} ends. This makes a step in the horn.`,
  /** the closed fold for settings most designs leave alone (a horn's steps, a chamber's position) */
  advanced: "Advanced",
  straightHorn: STRAIGHT_HORN_NAME,
  straightHornNote: "The shape the drawing should follow. The path chart shows it dashed.",
  /** the Advanced fold's summary: the steps in the horn now */
  hornSteps: (n: number) => `Steps: ${n === 0 ? "none" : n}`,
  hornStepsSetting: "Steps",
  hornStepsTip: `**${HORN_STEPS_OFF_NAME}**: each section starts where the section before it ends. **${HORN_STEPS_ON_NAME}**: each section after the first shows its **${HORN_START_NAME}**, so you can make a step.`,
  hornProfileTip: `The shape of the flare in this section: how its area grows from the start to the end. **${HORN_PROFILE_NAMES.con}**: both sides grow together. **${HORN_PROFILE_NAMES.exp}**: a flat top and bottom, curved sides. **${HORN_PROFILE_NAMES.par}**: a flat top and bottom, straight sides.`,
  /** the section's area tips, with the area's unit */
  hornStartTip: (unit: string) => `The area of the section at its throat end, ${unit}.`,
  hornEndTip: (unit: string) => `The area of the section at its mouth end, ${unit}.`,
  hornLengthTip: "The length of the section along the horn path.",
  hornPathSectionsTip: "The horn is a row of sections, from the throat to the mouth.",
  driverHornTip: `A horn or waveguide on this compression driver or tweeter. **${NO_HORN_NAME}**: the driver has no horn.`,
  hornMountTip: `**${HORN_PLACEMENT_NAMES.baffle}**: the mouth is cut into the baffle. **${HORN_PLACEMENT_NAMES.top}**: the horn stands on the chamber.`,
  /** an active band's level field, and a passive band's (its tooltip is `padTip`) */
  gain: GAIN_LABEL,
  pad: PAD_LABEL,
  padTip: `Cuts this band against the other bands on its amp channel, in dB. An **${DRIVE_NAMES.passive}** crossover can only cut, so the highest value is 0 dB.`,
  levelTip:
    "Sets the gain of this band against the other bands, in dB. A negative value makes the band quieter. The default is 0 dB: no change, so each driver plays at its own sensitivity.",
  driveTip: `**${DRIVE_NAMES.active}**: a crossover or DSP splits the signal before the amps. Each band has its own amp channel. **${DRIVE_NAMES.passive}**: a passive crossover in the box splits the amplified signal. One amp channel drives these bands.`,
  /** a passive band's amp power field: the one amp channel its network shares */
  sharedAmp: "Shared amp channel",
  cornerTip:
    "The corner frequency of the filter. A high-pass cuts below it. A low-pass cuts above it.",
  airSpeed: "Air speed limit",
  airSpeedTip:
    "The highest air speed in the vent at full power. Above it, the vent makes noise. The maximum output stops at this limit.",
  radiatorMassTip: "Mass that you add to each passive radiator. More mass tunes the box lower.",
  hornStepsOff: HORN_STEPS_OFF_NAME,
  hornStepsOn: HORN_STEPS_ON_NAME,
  addSection: "Add section",
  removeSection: "Remove section",
} as const;

/** A chamber's walls by id, as a cutlist note names them. */
export const FOLD_WALL_NAMES = {
  baffle: "baffle",
  bottom: "bottom",
  back: "back",
  top: "top",
} as const satisfies Record<keyof typeof FOLD_WALL, string>;
