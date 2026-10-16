// A chamber's load as the Speaker page's Load and Horn settings switch it: Direct, or Horn with a starting horn made
// from the chamber's cones and size; a horn's drive; a horn sized from its goals, and how it meets them. Pure.
import type {
  ChamberLoad,
  ChamberVent,
  Dims2,
  HornGoalFit,
  HornGoals,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerHorn,
  HornBoards,
} from "../../types";
import { coneDepthIn, coneParts } from "../../lib/speaker/driverParts";
import { MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { frontChamber, throatCones, wallClearanceIn } from "../../lib/speaker/hornThroat";
import { hornDesignOf } from "../../lib/speaker/hornDesign";
import { HORN_GOALS_DEFAULT } from "../../constants/hornGoals";
import { withDriveKind } from "./hornSections";
import { clearDepthIn, chamberClearFace } from "../../lib/speaker/chamberAir";
import { chamberSetbackIn } from "../../lib/speaker/driverBoard";
import {
  goalHorn,
  hornGoalFit,
  scoreOf,
  type DriverPower,
  type GoalDrive,
} from "../../lib/speaker/hornGoals";
import { DEFAULT_VENTS } from "./speakerParts";
import {
  chamberFold,
  foldGrowNeeded,
  foldRoomOf,
  grownChamber,
  withDriverBoardPieces,
  zigzagTries,
  type FoldGrow,
} from "../../lib/speaker/speakerLayout";
import {
  foldPasses,
  foldRestLiters,
  hornBoardsLayout,
  type FoldDriverBody,
  type FoldRoom,
} from "../../lib/speaker/hornBoards";
import { FOLD_CUTOUT_MARGIN_IN, FOLD_FACE } from "../../constants/hornBoards";
import { isFolded, mouthAtBottom } from "../../lib/speaker/foldLayouts";
import { foldNarrowingDb, refinedBoards } from "../../lib/speaker/foldRefine";
import { DIRECT_LOAD } from "../../lib/speaker/specParts";
import type { PlacedChamber } from "../../lib/speaker/speakerLayout";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../../constants/speakerSpec";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { segmentsAirLiters } from "../../lib/acoustics/hornSegments";
import { CM_PER_IN, CM2_PER_IN2, LITERS_PER_CUBIC_IN } from "../../constants/units";
import { shownTenth } from "./speakerFields";

/** The shortest path a starting horn takes, in: where the cones fill the chamber's depth. */
const MIN_PATH_IN = 1;

/** The room a starting horn fills: the chamber's clear face and its clear depth behind the baffle, in. */
export interface HornRoom {
  clear: Dims2;
  depthIn: number;
}

/**
 * The chamber's room for a horn: its clear face as the layout places it (`placed`; absent, its size less a wall on each
 * side) and its clear depth (`clearDepthIn`).
 */
export const hornRoom = (
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  chamber: Pick<SpeakerChamber, "dims">,
  placed: Pick<PlacedChamber, "clear"> | undefined,
): HornRoom => {
  const t = cabinet.panel.thicknessIn;
  return {
    clear: placed?.clear ?? { w: chamber.dims.w - 2 * t, h: chamber.dims.h - 2 * t },
    depthIn: clearDepthIn(cabinet, chamber.dims),
  };
};

/**
 * A starting horn for the chamber: one conical section from its cones' total area (every cone's Sd times its count) to
 * a mouth the size of the clear face, as long as the clear depth less the deepest cone and the walls' clearance in
 * front of the cones (lib/speaker/hornThroat); a 1:1 compression ratio, a straight
 * path, front-loaded, its mouth centered. Null when the chamber has no cone with Thiele/Small parameters.
 */
export function startingHorn(
  chamber: Pick<SpeakerChamber, "drivers">,
  room: HornRoom,
): SpeakerHorn | null {
  const cones = chamber.drivers.flatMap((d) => {
    const sd = coneParts(d)?.ts.Sd;
    return sd ? [{ sd: sd * d.count, depthIn: coneDepthIn(d) ?? 0 }] : [];
  });
  if (cones.length === 0) return null;
  const throat = cones.reduce((sum, c) => sum + c.sd, 0);
  const mouth = Math.max(throat, room.clear.w * room.clear.h * CM2_PER_IN2);
  // the walls' back edges stand their clearance in front of the cones
  const pathIn = Math.max(
    MIN_PATH_IN,
    room.depthIn - Math.max(...cones.map((c) => c.depthIn)) - wallClearanceIn(chamber.drivers),
  );
  return {
    segments: [
      { profile: HORN_PROFILE.conical, s1: throat, s2: mouth, length: pathIn * CM_PER_IN },
    ],
    portOffset: 0,
    drive: { kind: HORN_DRIVE.front },
    path: HORN_PATH.straight,
  };
}

/** The air inside a horn's flare, L: every section's, each by its flare law (lib/acoustics/hornSegments). */
export const flareLiters = (horn: Pick<SpeakerHorn, "segments">) =>
  segmentsAirLiters(horn.segments);

/**
 * The chamber with its load switched to `kind`. Horn: a starting horn (`startingHorn`), and its net air set to the rear
 * chamber's (the horn engine needs it): the chamber's net air now (`netLiters`; absent, its clear volume) less the
 * flare's, to the tenth, at least the build's floor. Unchanged when it has no cone to horn-load or already has that
 * load. Direct: the horn removed, and the net air back to Auto (worked out from the size).
 */
export function withChamberLoad(
  chamber: SpeakerChamber,
  kind: ChamberLoad["kind"],
  room: HornRoom,
  netLiters: number | undefined,
): SpeakerChamber {
  if (kind === chamber.load.kind) return chamber;
  if (kind === CHAMBER_LOAD.direct) return { ...chamber, load: DIRECT_LOAD, netLiters: null };
  const horn = startingHorn(chamber, room);
  if (!horn) return chamber;
  const now =
    netLiters ?? room.clear.w * room.clear.h * Math.max(0, room.depthIn) * LITERS_PER_CUBIC_IN;
  return {
    ...chamber,
    load: { kind: CHAMBER_LOAD.horn, horn },
    netLiters: Math.max(MIN_NET_L, shownTenth(now - flareLiters(horn))),
  };
}

/**
 * The chamber with a starting layout sized from `goals` for `drive` (lib/speaker/hornGoals `goalHorn`): its horn, its
 * net air (the rear chamber) to the tenth, and a sealed vent for a tapped horn (it has none). The search reads the
 * chamber's room (`hornRoom`), less the drivers' displacement. Null when no layout can be modeled.
 */
export function withGoalHorn(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
  placed: Pick<PlacedChamber, "clear"> | undefined,
  drive: GoalDrive,
  goals: HornGoals,
): { chamber: SpeakerChamber; fit: HornGoalFit } | null {
  const throat = throatCones(chamber.drivers);
  if (!throat) return null;
  const { room, displacementLiters, airLiters } = chamberAirLiters(cabinet, chamber, placed);
  const vent: ChamberVent = drive === HORN_DRIVE.tapped ? DEFAULT_VENTS.sealed : chamber.vent;
  const searched = { ...chamber, vent };
  const found = goalHorn(
    {
      chamber: searched,
      drive,
      room: {
        face: chamberClearFace(cabinet, searched),
        wallIn: cabinet.panel.thicknessIn,
        setbackIn: chamberSetbackIn(cabinet.panel, searched),
      },
      airLiters,
      displacementLiters,
      power: throat.parts.ts,
      goals,
    },
    room.depthIn * CM_PER_IN,
  );
  if (!found) return null;
  const designed: SpeakerChamber = {
    ...searched,
    load: { kind: CHAMBER_LOAD.horn, horn: found.horn },
    netLiters: Math.max(MIN_NET_L, shownTenth(found.netLiters)),
  };
  if (!isFolded(found.horn)) return { chamber: designed, fit: found.fit };
  // a folded result plays as its boards: keep it only where its boards beat the best straight path that fits
  const boards = withGoalBoards(cabinet, designed, goals, throat.parts.ts, displacementLiters);
  // a tapped or offset horn is always folded
  if (drive !== HORN_DRIVE.front) return boards;
  const straightFound = goalHorn(
    {
      chamber: searched,
      drive,
      room: {
        face: chamberClearFace(cabinet, searched),
        wallIn: cabinet.panel.thicknessIn,
        setbackIn: chamberSetbackIn(cabinet.panel, searched),
      },
      airLiters,
      displacementLiters,
      power: throat.parts.ts,
      goals,
    },
    room.depthIn * CM_PER_IN,
    true,
  );
  const straight = straightFound && {
    chamber: {
      ...searched,
      load: { kind: CHAMBER_LOAD.horn, horn: straightFound.horn },
      netLiters: Math.max(MIN_NET_L, shownTenth(straightFound.netLiters)),
    },
    fit: straightFound.fit,
  };
  if (!boards || !straight) return boards ?? straight;
  return scoreOf(boards.fit, goals) <= scoreOf(straight.fit, goals) ? boards : straight;
}

/**
 * The chamber's depth and height where folded boards for `drive` fit its drivers (`foldGrowNeeded`), in; null when
 * they fit already, or not even at twice the size.
 */
export function foldNeeds(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
  drive: GoalDrive,
): FoldGrow | null {
  const where = foldRoomOf(cabinet, chamber);
  if (!where) return null;
  const { room, body } = where;
  const horn = chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null;
  const bottom = horn !== null && mouthAtBottom(horn, chamber.dims.h);
  const shape = horn?.foldShape;
  const fits = zigzagTries(room, drive, body, bottom, shape).some((plan) =>
    foldPasses(hornBoardsLayout(plan, room, body)),
  );
  return fits ? null : grownChamber(chamber.dims, foldGrowNeeded(room, drive, body, bottom, shape));
}

/** How many places along their board, from end to end of where they fit, Design from goals tries the drivers at. */
const DRIVER_SPOT_STEPS = 5;

/**
 * The plan with its drivers on their board (the layout's, near the closed end), at each place they fit along it
 * (`DRIVER_SPOT_STEPS` of them, the cutout and its margin on the board), each way round: the taps Design from goals tries.
 */
function withDriverSpots(
  plan: HornBoards,
  room: FoldRoom,
  body: FoldDriverBody | null,
): HornBoards[] {
  const drivers = plan.drivers;
  if (!drivers || !body) return [plan];
  const need = body.cutoutIn / 2 + FOLD_CUTOUT_MARGIN_IN;
  return [drivers.board].flatMap((at) => {
    const board = plan.boards[at];
    const lengthIn = Math.hypot(
      plan.corners[board.b].z - plan.corners[board.a].z,
      plan.corners[board.b].y - plan.corners[board.a].y,
    );
    if (lengthIn < 2 * need) return [];
    return Array.from(
      { length: DRIVER_SPOT_STEPS },
      (_, i) => need + ((lengthIn - 2 * need) * i) / (DRIVER_SPOT_STEPS - 1),
    ).flatMap((alongIn) =>
      [FOLD_FACE.line, FOLD_FACE.offset].map((coneFace) => ({
        ...plan,
        drivers: { board: at, alongIn, coneFace },
      })),
    );
  });
}

/**
 * A folded horn's chamber (`designed`) with the boards that meet the goals best among those that pass every check (the
 * layouts `zigzagTries` offers), each scored on its own passage and taps, less for a passage that narrows; then its
 * corners and drivers' spot moved while that improves (`refinedBoards`). Null when none passes (the box is too small
 * for the drivers folded) or none can be modeled.
 */
function withGoalBoards(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  designed: SpeakerChamber,
  goals: HornGoals,
  power: DriverPower,
  displacementLiters: number,
): { chamber: SpeakerChamber; fit: HornGoalFit } | null {
  if (designed.load.kind !== CHAMBER_LOAD.horn) return null;
  const { horn } = designed.load;
  const where = foldRoomOf(cabinet, designed);
  if (!where) return null;
  const { room, body } = where;
  const setbackIn = chamberSetbackIn(cabinet.panel, designed);
  const face = chamberClearFace(cabinet, designed);
  const tapped = horn.drive.kind === HORN_DRIVE.tapped;
  const bottom = mouthAtBottom(horn, designed.dims.h);
  /** the chamber with these boards, how it meets the goals, and its score with the passage's narrowing; null: fails */
  const tried = (plan: HornBoards) => {
    // checked and played as the page lays it out: the drivers' board as thick as the horn's Double setting makes it
    const layout = hornBoardsLayout(
      withDriverBoardPieces(plan, horn.doubleBoard ? 2 : 1),
      room,
      body,
    );
    if (!foldPasses(layout)) return null;
    // the air outside the passage is the rear chamber: Auto works it out from the boards (a tapped horn keeps the
    // small air behind its cones that the search set)
    const rearL = tapped
      ? (designed.netLiters ?? MIN_NET_L)
      : Math.max(MIN_NET_L, foldRestLiters(layout, room) - displacementLiters);
    const chamber: SpeakerChamber = {
      ...designed,
      load: { kind: CHAMBER_LOAD.horn, horn: { ...horn, boards: plan } },
      netLiters: tapped ? designed.netLiters : null,
    };
    const read = hornDesignOf(
      chamber,
      { count: 1, angle: 2 },
      { netLiters: rearL, face, wallIn: room.wallIn, setbackIn, fold: layout },
    );
    const fit = read.ok ? hornGoalFit(read.design, goals, power) : null;
    if (!fit) return null;
    const score = scoreOf(fit, goals) + foldNarrowingDb(layout);
    return Number.isFinite(score) ? { plan, chamber, fit, score } : null;
  };
  let best: NonNullable<ReturnType<typeof tried>> | null = null;
  for (const plan of zigzagTries(room, horn.drive.kind, body, bottom, horn.foldShape).flatMap(
    (p) => (tapped ? withDriverSpots(p, room, body) : [p]),
  )) {
    const t = tried(plan);
    if (t && (!best || t.score < best.score)) best = t;
  }
  if (!best) return null;
  // then each corner and the drivers' spot moved while the score improves
  const refined = refinedBoards(
    best.plan,
    best.score,
    (plan) => tried(plan)?.score ?? null,
    room.wallIn,
  );
  const final = refined.plan === best.plan ? best : (tried(refined.plan) ?? best);
  return { chamber: final.chamber, fit: final.fit };
}

/**
 * The chamber with its horn driven as `kind` (`withDriveKind`: enough sections for the taps, the taps on them); a
 * tapped horn's chamber sealed, as it has no vent. Unchanged without a horn.
 */
export function withHornDrive(
  chamber: SpeakerChamber,
  kind: SpeakerHorn["drive"]["kind"],
): SpeakerChamber {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return chamber;
  return {
    ...chamber,
    load: { kind: CHAMBER_LOAD.horn, horn: withDriveKind(chamber.load.horn, kind) },
    vent: kind === HORN_DRIVE.tapped ? DEFAULT_VENTS.sealed : chamber.vent,
  };
}

/** The chamber's air, L: its clear room (`hornRoom`) less its drivers' displacement. */
function chamberAirLiters(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
  placed: Pick<PlacedChamber, "clear"> | undefined,
) {
  const room = hornRoom(cabinet, chamber, placed);
  const displacementLiters = chamber.drivers.reduce(
    (sum, d) => sum + (coneParts(d)?.dispL ?? 0) * d.count,
    0,
  );
  return {
    room,
    displacementLiters,
    airLiters:
      room.clear.w * room.clear.h * Math.max(0, room.depthIn) * LITERS_PER_CUBIC_IN -
      displacementLiters,
  };
}

/**
 * How a horn chamber meets its goals (`hornGoalFit`, on the model's net air `netLiters`; no fit while that is not known
 * yet), its horn's air (the flare's and the front chamber's) with the chamber's when the horn holds more, and its
 * path's length, in; null without a horn.
 */
export function hornGoalCheck(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
  placed: Pick<PlacedChamber, "clear"> | undefined,
  netLiters: number | undefined,
): {
  fit: HornGoalFit | null;
  overAir: { hornL: number; chamberL: number } | null;
  pathIn: number;
} | null {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return null;
  const { horn } = chamber.load;
  const throat = throatCones(chamber.drivers);
  const setbackIn = chamberSetbackIn(cabinet.panel, chamber);
  const fold = chamberFold(cabinet, chamber);
  const read =
    netLiters === undefined
      ? null
      : hornDesignOf(
          chamber,
          { count: 1, angle: 2 },
          {
            netLiters,
            face: chamberClearFace(cabinet, chamber),
            wallIn: cabinet.panel.thicknessIn,
            setbackIn,
            fold: fold?.layout ?? null,
          },
        );
  const fit =
    read?.ok && throat
      ? hornGoalFit(read.design, horn.goals ?? HORN_GOALS_DEFAULT, throat.parts.ts)
      : null;
  // a folded horn's air is its boards' passage, the air in front of the cones with it
  const hornL = fold
    ? fold.layout.airLiters
    : flareLiters(horn) + (throat ? frontChamber(throat.cone, throat.count, setbackIn).liters : 0);
  const chamberL = chamberAirLiters(cabinet, chamber, placed).airLiters;
  // the path: the boards' when folded, else the sections'
  const pathIn = fold
    ? fold.layout.pathIn
    : horn.segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;
  // a folded horn's boards keep its passage in the box (their checks say where they do not)
  return { fit, overAir: !fold && hornL > chamberL ? { hornL, chamberL } : null, pathIn };
}
