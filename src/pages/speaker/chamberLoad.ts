// A chamber's load as the Speaker page's Load and Horn settings switch it: Direct, or Horn with a starting horn made
// from the chamber's cones and size; a horn's drive; a horn sized from its goals, and how it meets them. Pure.
import type {
  ChamberLoad,
  ChamberVent,
  Dims2,
  HornGoalFit,
  HornFold,
  HornGoals,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerHorn,
} from "../../types";
import { coneDepthIn, coneParts } from "../../lib/speaker/driverParts";
import { MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { frontChamber, throatCones, wallClearanceIn } from "../../lib/speaker/hornThroat";
import { hornDesignOf } from "../../lib/speaker/hornDesign";
import { foldRoom, isDrawn, tracedHorn } from "../../lib/speaker/foldHorn";
import { HORN_GOALS_DEFAULT } from "../../constants/hornGoals";
import { withDriveKind } from "./hornSections";
import { clearDepthIn, chamberClearFace } from "../../lib/speaker/chamberAir";
import { chamberSetbackIn } from "../../lib/speaker/driverBoard";
import { goalHorn, hornGoalFit, type GoalDrive } from "../../lib/speaker/hornGoals";
import { foldLayout } from "../../lib/speaker/foldLayout";
import { DEFAULT_VENTS } from "./speakerParts";
import { DIRECT_LOAD } from "../../lib/speaker/specParts";
import type { PlacedChamber } from "../../lib/speaker/speakerLayout";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH, VENT_KIND } from "../../constants/speakerSpec";
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
 * path, front-loaded, its mouth centered. A chamber with no drivers yet sizes it from `firstDriver` (the driver it would
 * get first), so a horn can be picked before a driver. Null when no cone has Thiele/Small parameters.
 */
export function startingHorn(
  chamber: Pick<SpeakerChamber, "drivers">,
  room: HornRoom,
  firstDriver?: SpeakerDriver,
): SpeakerHorn | null {
  const drivers = chamber.drivers.length || !firstDriver ? chamber.drivers : [firstDriver];
  const cones = drivers.flatMap((d) => {
    const sd = coneParts(d)?.ts.Sd;
    return sd ? [{ sd: sd * d.count, depthIn: coneDepthIn(d) ?? 0 }] : [];
  });
  if (cones.length === 0) return null;
  const throat = cones.reduce((sum, c) => sum + c.sd, 0);
  const mouth = Math.max(throat, room.clear.w * room.clear.h * CM2_PER_IN2);
  // the walls' back edges stand their clearance in front of the cones
  const pathIn = Math.max(
    MIN_PATH_IN,
    room.depthIn - Math.max(...cones.map((c) => c.depthIn)) - wallClearanceIn(drivers),
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
  firstDriver?: SpeakerDriver,
): SpeakerChamber {
  if (kind === chamber.load.kind) return chamber;
  if (kind === CHAMBER_LOAD.direct) return { ...chamber, load: DIRECT_LOAD, netLiters: null };
  const horn = startingHorn(chamber, room, firstDriver);
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
 * chamber's room (`hornRoom`), less the drivers' displacement. A folded horn also gets boards (`foldLayout`) and a
 * sealed chamber (its vent is drawn). Null when no layout can be modeled.
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
  /** the goals' horn in the chamber with `vent`, as `goalHorn` finds it */
  const search = (vent: ChamberVent) => {
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
        // the path the user picked: Design from goals keeps it
        path: chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn.path : HORN_PATH.straight,
      },
      room.depthIn * CM_PER_IN,
    );
    return (
      found && {
        chamber: {
          ...searched,
          load: { kind: CHAMBER_LOAD.horn, horn: found.horn },
          netLiters: Math.max(MIN_NET_L, shownTenth(found.netLiters)),
        },
        fit: found.fit,
        horn: found.horn,
      }
    );
  };
  const found = search(drive === HORN_DRIVE.tapped ? DEFAULT_VENTS.sealed : chamber.vent);
  if (!found) return null;
  const wasFolded =
    chamber.load.kind === CHAMBER_LOAD.horn && chamber.load.horn.path === HORN_PATH.folded;
  /**
   * The designed horn with no drawing: a straight horn, or a folded one the user draws next (with the chamber's vent).
   * The path stays the one the user picked.
   */
  const straight = (): { chamber: SpeakerChamber; fit: HornGoalFit } => ({
    chamber: wasFolded
      ? { ...found.chamber, load: { kind: CHAMBER_LOAD.horn, horn: withoutFold(found.horn) } }
      : found.chamber,
    fit: found.fit,
  });
  if (!wasFolded) return straight();
  // a folded horn: boards placed so the traced passage follows the straight horn, sized for a sealed rear chamber (the
  // vent is drawn, and the boards place none); none found: the straight horn with the chamber's vent plays until the
  // user draws
  const sealedFound =
    found.chamber.vent.kind === VENT_KIND.sealed ? found : search(DEFAULT_VENTS.sealed);
  if (!sealedFound) return straight();
  const fold = foldLayout(
    foldRoom(cabinet, sealedFound.chamber),
    sealedFound.horn.segments,
    sealedFound.horn.drive,
  );
  if (!fold) return straight();
  return {
    chamber: {
      ...sealedFound.chamber,
      load: { kind: CHAMBER_LOAD.horn, horn: { ...withoutFold(sealedFound.horn), fold } },
    },
    fit: sealedFound.fit,
  };
}

/** The horn folded, with no drawing. */
function withoutFold(horn: SpeakerHorn): SpeakerHorn {
  const { fold: _fold, ...rest } = horn;
  return { ...rest, path: HORN_PATH.folded };
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
 * yet), and its horn's air (the flare's and the front chamber's) with the chamber's when the horn holds more; null
 * without a horn.
 */
export function hornGoalCheck(
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
  placed: Pick<PlacedChamber, "clear"> | undefined,
  netLiters: number | undefined,
): { fit: HornGoalFit | null; overAir: { hornL: number; chamberL: number } | null } | null {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return null;
  const { horn } = chamber.load;
  const throat = throatCones(chamber.drivers);
  const setbackIn = chamberSetbackIn(cabinet.panel, chamber);
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
            traced: tracedHorn(cabinet, chamber) ?? undefined,
          },
        );
  const fit =
    read?.ok && throat
      ? hornGoalFit(read.design, horn.goals ?? HORN_GOALS_DEFAULT, throat.parts.ts)
      : null;
  const hornL =
    flareLiters(horn) + (throat ? frontChamber(throat.cone, throat.count, setbackIn).liters : 0);
  const chamberL = chamberAirLiters(cabinet, chamber, placed).airLiters;
  return { fit, overAir: hornL > chamberL ? { hornL, chamberL } : null };
}

/** The chamber with its horn's drawing set to `fold`, sealed once drawn (the drawing holds the vent); unchanged without a horn. */
export function withHornFold(chamber: SpeakerChamber, fold: HornFold): SpeakerChamber {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return chamber;
  return {
    ...chamber,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...chamber.load.horn, fold } },
    // a drawn horn's vent is in its drawing: the chamber's own goes
    ...(isDrawn(fold) ? { vent: DEFAULT_VENTS.sealed } : {}),
  };
}
