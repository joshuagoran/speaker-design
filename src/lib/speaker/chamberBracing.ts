// A chamber's bracing as the build takes it (lib/speaker/speakerBuild): a Box chamber's own choice, a horn chamber's
// boards in place of braces.
import type { BackJointId, ChamberBracing, SpeakerChamber } from "../../types";
import { DEFAULT_BACK_JOINT, GLUED_BACK, NO_BRACING } from "../../constants/bracing";
import { CHAMBER_LOAD } from "../../constants/speakerSpec";

/**
 * The bracing a chamber takes: a Box chamber its own (`SpeakerChamber.bracing`); a horn chamber none, as its boards
 * brace its panels, a glued back, and no target to hold its bare panels to (0 Hz).
 */
export function bracingTaken(chamber: Pick<SpeakerChamber, "load" | "bracing">): ChamberBracing {
  if (chamber.load.kind !== CHAMBER_LOAD.horn) return chamber.bracing;
  return { braceStyle: NO_BRACING, backJoint: GLUED_BACK, braceTargetHz: 0 };
}

/**
 * The back joint of a shell's one back panel over `chambers`: screwed when any chamber's back is screwed (so it comes
 * off), else glued. A cabinet with no chambers takes the default.
 */
export function shellBackJoint(chambers: readonly Pick<SpeakerChamber, "load" | "bracing">[]) {
  if (!chambers.length) return DEFAULT_BACK_JOINT;
  const joints = chambers.map((c) => bracingTaken(c).backJoint);
  return joints.find((j): j is BackJointId => j !== GLUED_BACK) ?? GLUED_BACK;
}

/** Whether no chamber takes braces (every Box chamber unbraced, or only horn chambers). */
export const noChamberBraced = (chambers: readonly Pick<SpeakerChamber, "load" | "bracing">[]) =>
  chambers.every((c) => bracingTaken(c).braceStyle === NO_BRACING);
