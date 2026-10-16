// The Speaker page's names and choices (src/pages/speaker): the spec's ids as the page shows them.
import type { SLOT_KIND, SLOT_PLACE, TUBE_ENDS, TUBE_LAYOUT } from "./speakerSpec";
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
import { FIRST_ORDER_FILTER } from "./speakerSpec";
import { UI_TEXT } from "./uiText";
import { FOLD_DRIVERS_REASON } from "./foldHorn";

/** Each driver kind as the Speaker page names it: the catalog table it picks from. */
export const DRIVER_KIND_NAMES = {
  sub: "Subwoofer",
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
  vented: "Ported",
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

/** The elbows a round tube can have, as the Speaker page names each count (lib/tubeFold `ELBOW_COUNTS`). */
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

/** Where a setting's value comes from, by id: worked out by its rule (Auto), or typed in (Custom). */
export const SET_BY = {
  auto: "auto",
  custom: "custom",
} as const;

/** The name the settings show for each. */
export const SET_BY_NAMES = {
  auto: "Auto",
  custom: "Custom",
} as const satisfies Record<keyof typeof SET_BY, string>;

/** The panels a vent can be cut into, as the Speaker page names them. */
export const VENT_PANEL_NAMES = {
  baffle: "Baffle",
  back: "Back",
} as const satisfies Record<VentPanel, string>;

/** Each place a horn on a driver can sit, as the Speaker page names it (`HORN_PLACEMENT`). */
export const HORN_PLACEMENT_NAMES = {
  baffle: "In the baffle",
  top: "Freestanding on top",
} as const satisfies Record<HornPlacement, string>;

/** Why a horn can't sit in a place, by place (the place's button shows it). */
export const HORN_PLACEMENT_NO_FIT = {
  baffle: "The horn mouth is larger than the clear face of the chamber.",
  top: "Another chamber is on the top of this chamber.",
} as const satisfies Record<HornPlacement, string>;

/** How a chamber's drivers meet the air, as the chamber's Load setting names it (`CHAMBER_LOAD`). */
export const CHAMBER_LOAD_NAMES = {
  direct: "Direct",
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
  back: "Back-loaded",
} as const satisfies Record<HornDrive["kind"], string>;

/** Each band's crossover as the Speaker page names it (the ids are the saved drive values: active, passive). */
export const DRIVE_NAMES = {
  active: "External",
  passive: "Internal",
} as const satisfies Record<HifiDrive, string>;

/** Why an arched top stays flat, by `ARCH_BLOCK` id: the condition the cabinet misses, in words. */
export const ARCH_BLOCK_TEXT = {
  frame: "An arch needs the frame and inset baffle construction.",
  shell: "An arch needs all chambers in one box: the same depth, with no gaps.",
  topChambers: "An arch needs one chamber at the top.",
  width: "An arch needs the top chamber to be the full width of the cabinet.",
  height: "An arch needs the top chamber to be at least half as tall as the cabinet is wide.",
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
    why: "the box cannot be calculated from these sizes (air, port, counts)",
    fix: "Set the air, the port size and the driver counts above zero.",
  },
  badFilter: {
    why: "a band filter has a corner that is not a positive frequency",
    fix: "Set each filter corner above 0 Hz.",
  },
  backLoaded: {
    why: "a back-loaded horn is not calculated",
    fix: "Use a front-loaded, offset or tapped horn.",
  },
  taps: {
    why: "a cone side does not sit between two flare sections",
    fix: "Set each cone side between two sections, the front before the back.",
  },
  tappedVent: {
    why: "a tapped horn has no vent",
    fix: "Set the vent to Sealed.",
  },
  driver: {
    why: "the horn needs one kind of cone driver with Thiele/Small data",
    fix: "Use one cone driver model that lists them in this chamber.",
  },
  segment: {
    why: "a horn section has an area or a length that is not above zero",
    fix: "Set each section's start area, end area and length above zero.",
  },
  vent: {
    why: "a horn with this vent is not calculated",
    fix: "Use a sealed chamber, round tubes or a slot.",
  },
  drawing: {
    why: "the drawn horn has no passage from the cones to the mouth",
    fix: "Put the drivers on a board so that one side of the cones opens into the passage.",
  },
} as const satisfies Record<SpeakerModelGap, { why: string; fix: string }>;

/** The folded-horn path chart's labels. */
export const FOLD_CHART_TEXT = {
  label: "Passage area against distance from the closed end",
  xAxis: "distance from the closed end, in",
  yAxis: "area, in²",
  traced: "Traced path",
  target: "Straight horn",
  taps: "Cones open",
  front: "front",
  back: "back",
  /** the readout at the place pointed at: distance, width, area (numbers as formatted text) */
  at: (distanceIn: string, widthIn: string, areaIn2: string) =>
    `${distanceIn} in · ${widthIn} in wide · ${areaIn2} in²`,
} as const;

/** The folded horn editor's tools, as their buttons and tooltips name them, and its marks. */
export const FOLD_EDITOR_TEXT = {
  heading: "Folded horn",
  tools: "Drawing tools",
  move: "Move: drag a board, the end of a board, or the drivers.",
  board: "Add board: press and drag. The ends snap onto walls and other boards.",
  remove: "Delete: click a board, a corner or the drivers.",
  drivers: "Drivers: click a board to put them there. Click again to turn them.",
  mouth: "Mouth: click a wall to open the mouth there. Drag its two ends.",
  square: "Square joint: click a joint to hold it at 90°. Click again to free it.",
  undo: "Undo (Ctrl+Z or Cmd+Z)",
  closedEnd: "closed end",
  label: "Side view of the folded horn. The baffle is at the left.",
  notDrawn: "Draw the folded horn. Until then, the response shows the straight horn.",
  key: "Blue: the passage. Yellow: sealed air. Yellow circle: a joint. Yellow square: held at 90°.",
} as const;

/** The folded horn's figures, as their tiles name them. */
export const FOLD_STAT_TEXT = {
  path: "Path",
  mouth: "Mouth",
  taps: "Cones open at",
  rear: "Rear chamber",
  match: "Off the straight horn",
  /** where the cones open, in from the closed end: one or two formatted lengths */
  tapsAt: (front: string | null, back: string | null) =>
    [front, back].filter((t) => t !== null).join(" and ") || "nowhere",
} as const;

/** What each check on a drawn horn says (`FOLD_CHECK`), from its figures (lengths formatted). */
export const FOLD_CHECK_TEXT = {
  mouth: () => "The mouth opens onto a board. Move the mouth or the board.",
  drivers: (reason: (typeof FOLD_DRIVERS_REASON)[keyof typeof FOLD_DRIVERS_REASON]) =>
    reason === FOLD_DRIVERS_REASON.none
      ? "Place the drivers: use the Drivers tool on a board."
      : reason === FOLD_DRIVERS_REASON.blocked
        ? "Both sides of the cones face a board. Move the drivers or the boards."
        : "Neither side of the cones opens into the passage. Move the drivers or the mouth.",
  rearChamber: () => "One side of the cones faces a board with no air behind it.",
  deadEnd: (at: string) =>
    `The cones first open ${at} from the closed end. That is a long dead end behind them. Move them nearer the closed end.`,
  choke: (at: string) => `The passage narrows sharply ${at} from the closed end.`,
  magnet: () => "A driver's motor is within 1 in of a board or a wall.",
  cutout: () => "A driver's cutout runs off its board.",
  strayAir: (count: number) =>
    count === 1
      ? "One pocket of sealed air does nothing."
      : `${count} pockets of sealed air do nothing.`,
  thin: (at: string, width: string) =>
    `The passage is only ${width} wide ${at} from the closed end.`,
  /** the drawing makes a different horn type than the Horn type setting */
  typeDiffers: (drawn: string, set: string) =>
    `The drawing makes a ${drawn} horn. Horn type is set to ${set}.`,
} as const;

/** The Speaker page's results headings and chart labels. */
export const SPEAKER_TEXT = {
  views: "The speaker",
  front: "Front",
  section: "Sections",
  sectionNote:
    "Top and side, cut through the horn's center, the baffle at the left. The horn's walls follow its flare sections. They start just in front of the cones and cover their outer parts. The dashed box is the front chamber, between the cones and the back edges of the walls. A folded path turns at the walls. A slot on a front side runs back along the side wall.",
  /** the horn's path does not fit its chamber: what it needs and what the chamber gives, as formatted lengths */
  hornNoRoom: (needs: { depth: string; height: string }, room: { depth: string; height: string }) =>
    `A horn path does not fit its chamber. It needs ${needs.depth} of depth and ${needs.height} of height. The chamber gives ${room.depth} and ${room.height}. The views draw the horn as it is, past the walls. Make the chamber larger, shorten the path, or set the path to Folded.`,
  hornMouthClipped:
    "A horn mouth is larger than the face its chamber leaves it (the clear face, less any side slots). The views draw it at that face, with a smaller flare.",
  hornMouthMoved:
    "A horn mouth is set outside the face its chamber leaves it (the clear face, less any side slots). The views move it to the nearest place that fits.",
  ventMoved:
    "A port or radiator is set outside the clear face of its chamber. The views move it to the nearest place that fits.",
  response: "Response",
  chambers: "Chambers",
  bands: "Bands",
  sum: "Sum",
  yLabel: "dB SPL, 2.83 V, 1 m",
  modelNote:
    "On axis at 1 m in half space. Every band gets 2.83 V. The response does not include the baffle step, the room or the driver positions yet. The Space page adds them.",
  noBands: "No band has a modeled driver. Add a driver to a chamber and select its band.",
  /** a chamber the model leaves out: its number, why, and what to change */
  chamberGap: (n: number, gap: { why: string; fix: string }) =>
    `Chamber ${n}: ${gap.why}. ${gap.fix}`,
  /** a part of the speaker the model leaves out that no chamber owns (a band filter): why, and what to change */
  speakerGap: (gap: { why: string; fix: string }) => `${gap.why}. ${gap.fix}`,
  maxOutput: "Maximum output",
  maxYLabel: "max dB SPL, 1 m",
  speakerMax: "Speaker max",
  maxNote:
    "On axis at 1 m. Each band gets its amp's full power, up to the first limit: cone travel, port air speed, radiator travel, the driver's program rating (2 × AES) or the amp. You set the port air speed limit in the chamber. A band's max is for music, with one drive for the whole band. The sum uses one input for all bands. A band limits the sum only where the band has signal.",
  chamber: "Chamber",
  noFilter: "None",
  /** a band the user adds, by its place among the bands */
  newBandName: (n: number) => `Band ${n}`,
  build: "Price, weight and bracing",
  weight: "Weight",
  /** under the price, weight and bracing, before the bracing words */
  priceNote:
    "The price is the total of the purchased parts on the Cutlist tab: the drivers, the horns, the radiators, the port tubes and the hardware. It does not include the plywood.",
  /** a chamber's weight tile, by its place */
  chamberWeight: (n: number) => `Chamber ${n} weight`,
  /** under the weight and bracing, with the bracing rule's panel target in words */
  buildNote: (target: string) =>
    `Each chamber gets braces until every panel is above ${target}. The notices above show the panels that do not get there. The net air of each chamber subtracts the braces, the vent walls, the baffle cleats and the hardware. The weight includes the panels, the braces, the drivers with their horns, the radiators and the hardware. The Cutlist tab lists every part.`,
  noBraces: "no braces",
  /** the Build notice and summary when the cabinet has no bracing (`NO_BRACING`) */
  notBraced:
    "The panels are not braced. The cutlist, the weight and the net air have no braces. Brace the box later, or from the outside.",
  notBracedSummary: "not braced",
  buildNoteUnbraced:
    "The net air of each chamber subtracts the vent walls, the baffle cleats and the hardware. The weight includes the panels, the drivers with their horns, the radiators and the hardware. The Cutlist tab lists every part.",
  hornNoFit:
    "A horn does not fit where it is mounted. Another chamber is on its top, or its mouth is larger than the baffle of its chamber. Select the other mounting in the driver settings. Until you do, the views and the cutlist do not show the horn.",
  /** the driver board's cutlist note: where the drivers mount, how a doubled board is glued, and each cone's cutout */
  driverBoardNote: (pieces: number) =>
    pieces > 1
      ? "the drivers mount on its back; glue the pieces face to face"
      : "the drivers mount on its back",
  driverBoardCutout: (count: number, kind: string, cutout: string) =>
    `${count} × ${kind.toLowerCase()} cutout, ${cutout}`,
  hornNoFitNote:
    "the horn does not fit where it is mounted; no cutout until you change the mounting",
  portTooLong: "too long for this chamber: make it shorter",
  slotTooLong: "too long to run straight in this chamber: make it shorter, or fold it",
  slotTooLongFolded: "too long to fold in this chamber: make it shorter",
  /** the cutlist's notes for slots up the front sides: the openings on the baffle, and the walls that close them */
  sideSlotOpening: (n: number, w: string, h: string) =>
    `${n} × slot up the front sides, one side then the other: ${w}″ wide, ${h}″ tall openings against the side walls, standing on the bottom panel`,
  sideSlotWalls: (n: number, w: string) =>
    `walls of the ${n} side slots: each ${w}″ in from its side wall, as tall as its opening, running back from the baffle`,
  /** a chamber whose braces can't bring every panel to the target (or a panel over its strength limit), by its place */
  underTarget: (n: number, target: string) =>
    `Chamber ${n} does not get to the ${target} bracing target. Not enough braces fit around its drivers, vent and horn. These panels are below the target, or above a strength limit:`,
  inputRange: "Input range",
  inputHint: "Filters in front of the speaker. They are not part of the box.",
  inputTip:
    "The filters in front of the speaker, for example the crossover to a sub. They are not part of the box. In a stack, the crossover of the stack sets them.",
  inputOff: "Off",
  construction: "Construction",
  top: "Top",
  inset: "Baffle inset, in",
  insetTip: "How far the baffle is behind the front edge of the frame.",
  braceStyle: "Bracing",
  backJoint: "Back panel",
  wallPanel: "Wall panels",
  /** the wall panels' tooltip, with the frame box's baffle thickness in words */
  wallPanelTip: (baffle: string) =>
    `The panel size of the sides, top, bottom and back. On a frame box, the baffle stays ${baffle}. On a flush box, the baffle is this size too. Thinner walls get more braces.`,
  /** the construction summary's wall panels, by their thickness in words */
  wallPanelSummary: (t: string) => `${t} walls`,
  hardware: "Hardware",
  hardwareTip:
    "Two handles, an input dish with two jacks on the back and, under a horn on the top, binding posts for the horn. It goes on the lowest chamber of each shell. None: no hardware.",
  hardwareNone: "None",
  hardwareOn: "Handles and input dish",
  handles: "Handles",
  /** where the hardware note (constants/hardware `hardwareNote`) puts the input dish, and the horn's posts */
  hardwareDishBox: "The lowest chamber of each shell",
  hardwarePostsBox: "Under a horn on its top",
  /** the construction summary's hardware: the handles' name, or none */
  hardwareSummary: (handles: string) => `hardware with ${handles}`,
  noHardwareSummary: "no hardware",
  braceTarget: "Bracing target",
  /** the target's tooltip, with the default target in words */
  braceTargetTip: (def: string) =>
    `Braces are added until the first resonance of each panel is above this frequency. Default: ${def}.`,
  /** under the Top choice when an arched top cannot apply: the start of the reason (`ARCH_BLOCK_TEXT`) */
  archFlat: "The top stays flat.",
  fromLeft: "From left, in",
  fromBottom: "From bottom, in",
  backFromFront: "Back from front, in",
  driversInBay: "The horn places the drivers in the bay behind the throat, stacked and centered.",
  placeTip:
    "Seen from the front. The position of the center, from the left side and the bottom of the chamber.",
  portPlace: "Port position",
  radiatorPlace: "Radiator position",
  mouthPlace: "Horn mouth position",
  panel: "Panel",
  slotNarrow: "Opening, narrow side, in",
  slotNarrowTip:
    "An open slot always runs the full inside width of the chamber, or the full inside height on the front sides. This size sets its area.",
  slotHeight: "Slot height, in",
  portLength: "Length, in",
  slotKind: "Slot type",
  slotKindTip:
    "Divided slot: a slot along the floor, split by fins. It folds up the back when it is too long. It needs the frame construction. Open slot: a rectangular opening with no fins. You can use more than one.",
  slotPlace: "Slot position",
  slotPlaceTip:
    "Floor: the slots stack up from the floor. Front sides: the slots stand on the floor against the side walls, beside the horn mouth.",
  slotFins: "Fins",
  slotFinsTip:
    "Fins split a divided slot into equal openings. Each fin is as thick as the walls. Default: two. Most: each opening stays at least half the slot height wide.",
  slotKindResets: "Switching the type resets the other type's settings: fins, or count and fold.",
  slotFolds: "The slot is too long to run straight. It folds up the back.",
  slotStraight: "The slot runs straight along the floor.",
  slotFold: "Fold",
  slotFoldTip:
    "Up the back: if the slot is too long to run straight, it folds up the back wall. No: the slot must fit straight.",
  tubeEnds: "Tube ends",
  tubeEndsTip:
    "Flared: tubes with flared ends. They need a sub driver in this chamber. Plain: plain round tubes.",
  tubeEndsNoSub: "Flared tubes need a cone driver in this chamber.",
  tubeLayout: "Tube position",
  elbows: "Elbows",
  elbowsTip:
    "The bends in each tube. Each bend adds a little to the length that the air sees, so the port tunes lower.",
  /** the side ducts' dividers' tooltip: the shared tip, and which thickness each size takes */
  ductDividersTip: `${UI_TEXT.ductDividersTip} Dividers of the wall size have the thickness of the walls. You can measure it on the Cutlist page. Dividers of a different size have the default thickness.`,
  ventFixed: "The shape of this port sets its position.",
  load: "Load",
  loadTip:
    "Direct: the cones radiate from the baffle. Horn: a horn in the box. A new horn has one conical section from the cones to the clear face. The net air is then the rear chamber.",
  loadNoCone: "A horn needs a cone driver with Thiele/Small parameters in this chamber.",
  horn: "Horn",
  hornSections: "Flare sections",
  hornSection: (n: number) => `Section ${n}`,
  hornProfile: "Profile",
  hornStart: "Start area, in²",
  hornEnd: "End area, in²",
  hornCompression: "Compression ratio",
  hornCompressionTip:
    "How much of the cone the horn walls cover. A higher ratio loads the cone more. It gives more output low in the band but less at the top, and faster air at the throat.",
  hornFrontChamber: "Front chamber",
  /** added to the front chamber's tip when the catalog gives no surround width or cone depth */
  hornFrontChamberEstimate:
    "The datasheet does not give the surround width or the cone depth, so this value uses estimates.",
  hornFrontChamberTip:
    "The air between the cones and the back edges of the horn walls, with the cutouts in the driver board. The edges stay clear of full cone travel. The drivers and the board set this value.",
  hornBoard: "Driver board thickness",
  hornBoardWall: "Wall",
  hornBoardDouble: "Double",
  hornBoardTip: "The board the drivers mount on. Double it for large drivers.",
  hornPath: "Path",
  hornPathTip:
    "Straight: one run from the cones to the mouth. Folded: the path runs back and forth up the box. Only the sections set the response.",
  hornDrive: "Horn type",
  hornDriveTip:
    "Where the cones meet the horn's path. Front-loaded: at the start. Offset: part way along, the path closed behind them. Tapped: the cone fronts and backs each open into the path. Back-loaded: the cone backs drive the horn.",
  hornDriveNote: "A back-loaded horn is not calculated yet.",
  hornTap: "Cones open after section",
  hornTapTip:
    "The front of the cones opens into the path after this section. The path before it is closed at its start.",
  hornFrontTap: "Cone fronts open after section",
  hornFrontTapTip:
    "The front of the cones opens into the path after this section. The path before it is closed at its start.",
  hornRearTap: "Cone backs open after section",
  hornRearTapTip:
    "The back of the cones opens into the path after this section. It comes after the front.",
  /** the line under a tapped horn's settings: what the chamber's volume is */
  hornTappedAir: "The chamber volume is the air behind the cones.",
  /** why a tapped horn's chamber takes no vent */
  ventTapped: "A tapped horn has no vent.",
  hornGoals: "Goals",
  hornGoalsTip:
    "What the horn is for. Design from goals sizes the horn to fit inside this chamber and meet them.",
  hornGoalLow: "Lowest frequency, Hz",
  hornGoalLowTip: "The horn plays flat down to here.",
  hornGoalHigh: "Highest frequency, Hz",
  hornGoalHighTip: "The crossover to the box above. The horn plays flat up to here.",
  hornGoalTarget: "Target level, dB",
  hornGoalTargetTip:
    "The level at 1 m at full power, from the lowest to the highest frequency. The power rating or the cone travel of the drivers limits it.",
  hornDesign: "Design from goals",
  hornDesigning: "Designing…",
  hornDesignTip:
    "Sets the sections, where the cones open and the chamber volume for these goals and this horn type. It keeps the drivers and the vent. A tapped horn gets a sealed chamber.",
  hornDesignFailed: "No horn for these goals can be calculated in this chamber.",
  hornGoalsOrder: "Set the highest frequency above the lowest.",
  /** the goals check: how flat the response is over the goals' band */
  hornFitSpread: (spread: string, low: string, high: string) =>
    `Response: within ${spread} dB from ${low} to ${high} Hz.`,
  /** the goals check: the level at the lowest frequency, when it falls more than the usual corner under the band */
  hornFitLowEdge: (db: string) => `At the lowest frequency it is ${db} dB quieter than the band.`,
  /** the goals check: the lowest maximum output over the band, where it is, and what limits it */
  hornFitMaxOut: (db: string, hz: string, limit: string) =>
    `Maximum output: ${db} dB at ${hz} Hz, limited by ${limit}.`,
  /** the goals check: how far the maximum output falls under the target level */
  hornFitShort: (db: string) => `That is ${db} dB under the target.`,
  /** the goals check: the horn holds more air than the chamber has */
  hornFitAir: (horn: string, chamber: string) =>
    `The horn holds ${horn} L. The chamber has only ${chamber} L of air.`,
  hornImport: "Import a horn record",
  hornImportTip:
    "Paste the text of a record file from a horn simulation program. It sets the sections, the horn type, the chamber volume and the vent. The drivers stay as set in this chamber.",
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
  /** the chamber Advanced fold's summary: its position, in */
  chamberAt: (x: number, y: number) => `${x} in from left, ${y} in up`,
  /** the Advanced fold's summary: the steps in the horn now */
  hornSteps: (n: number) => `Steps: ${n === 0 ? "none" : n}`,
  hornStepsSetting: "Steps",
  hornStepsTip:
    "Off: each section starts at the end area of the section before it, so the horn is smooth. On: each section after the first shows its start area, so you can make a step. When you set Off, each start area goes back to the end area before it.",
  hornProfileTip:
    "The shape of the flare in this section: how its area grows from the start to the end. Conical: both sides grow together. Exponential: a flat top and bottom, curved sides. Parabolic: a flat top and bottom, straight sides.",
  hornStartTip: "The area of the section at its throat end.",
  hornEndTip: "The area of the section at its mouth end.",
  hornLengthTip: "The length of the section along the horn path.",
  hornPathSectionsTip: "The horn is a row of sections, from the throat to the mouth.",
  driverHornTip:
    "A horn or waveguide on this compression driver or tweeter. None: the driver has no horn.",
  hornMountTip:
    "In the baffle: the horn mouth is cut into the baffle. Freestanding on top: the horn stands on the top of the chamber.",
  levelTip:
    "Sets the level of this band against the other bands, in dB. A negative value makes the band quieter. The default is 0 dB: no change, so each driver plays at its own sensitivity.",
  driveTip:
    "External: a crossover or DSP splits the signal before the amps. Each band has its own amp channel. Internal: a passive crossover in the box splits the signal after the amp. One amp channel drives these bands.",
  /** a passive band's amp power field: the one amp channel its network shares */
  sharedAmp: "Shared amp channel, W",
  cornerTip:
    "The corner frequency of the filter. A highpass cuts below it, and a lowpass cuts above it.",
  netAirTip:
    "The air the drivers work against. Auto: the inside volume minus the walls, the braces, the drivers and the vent. Custom: you type the value.",
  stuffing: "Stuffing: acts larger by, %",
  stuffingTip:
    "Fiber fill makes the box act larger than its air. Light fill: about 10%. Heavy fill: about 15%. Packed full: about 25%, the most real fill gives.",
  airSpeedTip:
    "The highest air speed in the port at full power. Above it, the port makes noise. The maximum output stops at this limit.",
  radiatorMassTip: "Mass that you add to each passive radiator. More mass tunes the box lower.",
  startOverHint:
    "This replaces the current design. To open a saved speaker, use the saved configurations above.",
  hornStepsOff: "Off",
  hornStepsOn: "On",
  addSection: "Add section",
  removeSection: "Remove section",
} as const;
