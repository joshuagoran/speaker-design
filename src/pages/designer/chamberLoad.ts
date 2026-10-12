// A chamber's load as the Designer's Load setting switches it: Direct, or Horn with a starting horn made from the
// chamber's cones and size. Pure.
import type {
  ChamberLoad,
  Dims2,
  HornSegment,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerHorn,
} from "../../types";
import { coneParts } from "../../lib/speaker/driverParts";
import { clearDepthIn } from "../../lib/speaker/chamberAir";
import { coneDepthIn, MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { DIRECT_LOAD } from "../../lib/speaker/specParts";
import type { PlacedChamber } from "../../lib/speaker/speakerLayout";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../../constants/speakerSpec";
import { HORN_PROFILE } from "../../constants/hornEngine";
import { CM_PER_IN, CM2_PER_IN2, LITERS_PER_CUBIC_IN } from "../../constants/units";
import { shownTenth } from "./designerFields";

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
 * a mouth the size of the clear face, as long as the clear depth less the deepest cone; no throat chamber, a straight
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
  const pathIn = Math.max(MIN_PATH_IN, room.depthIn - Math.max(...cones.map((c) => c.depthIn)));
  return {
    throatChamber: 0,
    segments: [
      { profile: HORN_PROFILE.conical, s1: throat, s2: mouth, length: pathIn * CM_PER_IN },
    ],
    portOffset: 0,
    drive: { kind: HORN_DRIVE.front },
    path: HORN_PATH.straight,
  };
}

/**
 * The air inside one section, in³, by its flare law: a conical section is a cone's frustum, L/3 (S1 + S2 + √(S1 S2));
 * an exponential one, S1 e^(mx) along its length, holds (S2 − S1) L / ln(S2 / S1) (S1 L where the two are equal).
 */
function sectionIn3(s: HornSegment): number {
  const [a, b, len] = [s.s1 / CM2_PER_IN2, s.s2 / CM2_PER_IN2, s.length / CM_PER_IN];
  switch (s.profile) {
    case HORN_PROFILE.conical:
      return (len / 3) * (a + b + Math.sqrt(a * b));
    case HORN_PROFILE.exponential: {
      const ratio = Math.log(b / a);
      return Math.abs(ratio) < 1e-9 ? a * len : ((b - a) * len) / ratio;
    }
  }
}

/** The air inside a horn's flare, L: every section's, each by its flare law (`sectionIn3`). */
export const flareLiters = (horn: Pick<SpeakerHorn, "segments">) =>
  horn.segments.reduce((sum, s) => sum + sectionIn3(s) * LITERS_PER_CUBIC_IN, 0);

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
