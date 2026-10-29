// A straight front-loaded horn worked out from its box (#255, the draw-first mock): the mouth fills the front between
// the slots, the throat is the cones' area over the compression ratio, and the rear chamber is the air left behind the
// driver board and beside the flare. The Top drawing drags the flare's length and the throat's width; a change to the
// box keeps both and works the rest out again. Pure.
import type { SpeakerCabinet, SpeakerChamber } from "../../types";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_PATH,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { CM_PER_IN, CM2_PER_IN2, LITERS_PER_CUBIC_IN } from "../../constants/units";
import { hornFace, speakerLayout, type LayoutCabinet } from "../../lib/speaker/speakerLayout";
import { coneDepthIn } from "../../lib/speaker/driverParts";
import {
  compressionRatio,
  conesAreaCm2,
  frontChamber,
  throatCones,
  wallClearanceIn,
} from "../../lib/speaker/hornThroat";
import { chamberSetbackIn } from "../../lib/speaker/driverBoard";
import { MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { clamp } from "../../lib/clamp";
import { flareLiters, hornRoom } from "./chamberLoad";
import { shownTenth } from "./speakerFields";

/** The shortest flare the drag allows, in. */
const MIN_FLARE_IN = 4;
/** The compression ratios the throat's drag allows: from no compression up to a strong one. */
const RATIO_RANGE = [1, 4] as const;

/** A straight horn's sizes as the Top drawing shows them, in (areas' heights are the mouth's: straight-sided). */
export interface StraightHornSizes {
  flareIn: number;
  /** the longest flare the box holds: the clear depth less the cones' depth and the walls' clearance */
  maxFlareIn: number;
  throat: { w: number; h: number };
  mouth: { w: number; h: number };
  ratio: number;
  rearLiters: number;
}

/** What the Top drawing's drag sets: the flare's length, in, and the compression ratio. */
export interface StraightHornEdit {
  flareIn?: number;
  ratio?: number;
}

/** The chamber's straight front-loaded horn of one section, with what works it out; null for any other chamber. */
function straightHornOf(cabinet: LayoutCabinet, i: number) {
  const chamber = cabinet.chambers[i];
  if (chamber?.load.kind !== CHAMBER_LOAD.horn) return null;
  const { horn } = chamber.load;
  const [segment] = horn.segments;
  if (
    horn.path !== HORN_PATH.straight ||
    horn.drive.kind !== HORN_DRIVE.front ||
    horn.segments.length !== 1 ||
    !segment
  )
    return null;
  const throat = throatCones(chamber.drivers);
  const placed = speakerLayout(cabinet).chambers[i];
  if (!throat || !placed) return null;
  const face = hornFace(placed, cabinet.panel.thicknessIn);
  const room = hornRoom(cabinet, chamber, placed);
  const conesCm2 = conesAreaCm2(chamber.drivers);
  const deepest = Math.max(...chamber.drivers.map((d) => coneDepthIn(d) ?? 0));
  const maxFlareIn = Math.max(
    MIN_FLARE_IN,
    room.depthIn - deepest - wallClearanceIn(chamber.drivers),
  );
  return { chamber, horn, segment, throat, face, room, conesCm2, maxFlareIn };
}

/** The air the side slots take inside the chamber, L: each slot's width by the clear height by its length. */
function slotLiters(chamber: SpeakerChamber, clearH: number): number {
  if (chamber.vent.kind !== VENT_KIND.vented || chamber.vent.port.shape !== PORT_SHAPE.slot)
    return 0;
  const { n, h, len } = chamber.vent.port;
  return n * h * clearH * len * LITERS_PER_CUBIC_IN;
}

/** The chamber's horn sizes for the Top drawing; null for a chamber that isn't a straight front-loaded horn. */
export function straightHornSizes(cabinet: LayoutCabinet, i: number): StraightHornSizes | null {
  const found = straightHornOf(cabinet, i);
  if (!found) return null;
  const { chamber, segment, face, conesCm2, maxFlareIn } = found;
  const hCm = face.h * CM_PER_IN;
  return {
    flareIn: segment.length / CM_PER_IN,
    maxFlareIn,
    throat: { w: segment.s1 / hCm / CM_PER_IN, h: face.h },
    mouth: { w: segment.s2 / hCm / CM_PER_IN, h: face.h },
    ratio: compressionRatio(conesCm2, [segment]) ?? 1,
    rearLiters: chamber.netLiters ?? 0,
  };
}

/**
 * The chamber with its straight horn worked out from the box and `edit`: the flare's length kept in the box, the throat
 * from the ratio, the mouth the face between the slots, and the rear chamber the clear air less the drivers, the flare,
 * the front chamber and the slots (to the tenth, at least the build's floor). Null for a chamber that isn't a straight
 * front-loaded horn of one section.
 */
export function withStraightHorn(
  cabinet: LayoutCabinet,
  i: number,
  edit: StraightHornEdit = {},
): SpeakerChamber | null {
  const found = straightHornOf(cabinet, i);
  if (!found) return null;
  const { chamber, horn, segment, throat, face, room, conesCm2, maxFlareIn } = found;
  const ratio = clamp(
    edit.ratio ?? compressionRatio(conesCm2, [segment]) ?? 1,
    RATIO_RANGE[0],
    RATIO_RANGE[1],
  );
  const flareIn = clamp(edit.flareIn ?? segment.length / CM_PER_IN, MIN_FLARE_IN, maxFlareIn);
  const segments = [
    {
      ...segment,
      s1: conesCm2 / ratio,
      s2: Math.max(conesCm2 / ratio, face.w * face.h * CM2_PER_IN2),
      length: flareIn * CM_PER_IN,
    },
  ];
  const nextHorn = { ...horn, segments };
  const displacement = chamber.drivers.reduce((sum, d) => sum + throat.parts.dispL * d.count, 0);
  const clearAir = room.clear.w * room.clear.h * Math.max(0, room.depthIn) * LITERS_PER_CUBIC_IN;
  const front = frontChamber(
    throat.cone,
    throat.count,
    chamberSetbackIn(cabinet.panel, chamber),
  ).liters;
  const rear =
    clearAir - displacement - flareLiters(nextHorn) - front - slotLiters(chamber, room.clear.h);
  return {
    ...chamber,
    load: { kind: CHAMBER_LOAD.horn, horn: nextHorn },
    netLiters: Math.max(MIN_NET_L, shownTenth(rear)),
  };
}

/**
 * The cabinet with each straight horn whose chamber changed size or vent worked out again from its new box (the flare
 * and the ratio kept); the same cabinet back when none did.
 */
export function withStraightHornsFollowingBox(
  before: Pick<SpeakerCabinet, "chambers">,
  after: SpeakerCabinet,
): SpeakerCabinet {
  let changed = false;
  const chambers = after.chambers.map((c, i) => {
    const was = before.chambers[i];
    if (!was || (was.dims === c.dims && was.vent === c.vent)) return c;
    const next = withStraightHorn(after, i);
    if (!next) return c;
    changed = true;
    return next;
  });
  return changed ? { ...after, chambers } : after;
}
