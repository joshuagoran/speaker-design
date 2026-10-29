// The vents a horn chamber starts with (an undrawn front-loaded or offset horn: `hornVentKinds`): slots at the front
// sides beside the mouth, or a round port on the back. Never in the mouth. Pure.
import type { ChamberVent, SpeakerChamber, SpeakerPort } from "../../types";
import { PORT_SHAPE, SLOT_PLACE, VENT_KIND } from "../../constants/speakerSpec";
import { PANEL } from "../../constants/cutParts";
import { CM2_PER_IN2 } from "../../constants/units";
import { DEFAULT_PA } from "../../lib/defaults";
import { conesAreaCm2 } from "../../lib/speaker/hornThroat";
import { DEFAULT_PORTS } from "./speakerParts";

/** The share of the cones' area the starting slots open, both together: the PA presets open 35–50%. */
const SLOT_AREA_SHARE = 0.4;
/** The starting slots' length, as a share of the chamber's depth. */
const SLOT_DEPTH_SHARE = 1 / 3;
/** The step the starting sizes are rounded to, in. */
const STEP_IN = 0.25;

const stepped = (v: number) => Math.round(v / STEP_IN) * STEP_IN;

/**
 * A horn chamber's port of `shape`: two open slots at the front sides, together `SLOT_AREA_SHARE` of the cones' area
 * up the clear height and a third of the depth long; or the round port on the back, at its middle. The PA's air-speed
 * limit.
 */
export function hornPort(
  chamber: Pick<SpeakerChamber, "dims" | "drivers">,
  clearH: number,
  shape: (typeof PORT_SHAPE)["round" | "slot"],
): Extract<ChamberVent, { kind: "vented" }> {
  const port: SpeakerPort =
    shape === PORT_SHAPE.slot
      ? {
          shape: PORT_SHAPE.slot,
          n: 2,
          h: Math.max(
            STEP_IN * 2,
            stepped((SLOT_AREA_SHARE * conesAreaCm2(chamber.drivers)) / CM2_PER_IN2 / (2 * clearH)),
          ),
          len: Math.max(STEP_IN * 4, stepped(chamber.dims.d * SLOT_DEPTH_SHARE)),
          place: SLOT_PLACE.sides,
        }
      : {
          ...DEFAULT_PORTS.round,
          position: { xIn: 0, yIn: chamber.dims.h / 2, panel: PANEL.back },
        };
  return { kind: VENT_KIND.vented, port, maxSpeedMs: DEFAULT_PA.portMax };
}

/**
 * A chamber's vent as it turns into a horn chamber: a round port or slots start again as the horn's (`hornPort`); a
 * vent the horn engine does not model (side ducts, radiators) gives way to sealed.
 */
export function hornVentFrom(
  vent: ChamberVent,
  chamber: Pick<SpeakerChamber, "dims" | "drivers">,
  clearH: number,
): ChamberVent {
  if (vent.kind !== VENT_KIND.vented) return { kind: VENT_KIND.sealed };
  const shape = vent.port.shape ?? PORT_SHAPE.round;
  return shape === PORT_SHAPE.round || shape === PORT_SHAPE.slot
    ? hornPort(chamber, clearH, shape)
    : { kind: VENT_KIND.sealed };
}
