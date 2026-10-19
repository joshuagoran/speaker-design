// The Speaker optimizer's vents: the port sizes a vented chamber tries, a port's length solved for a tuning on the
// chamber's net air, and a radiator's added masses. Each port keeps its shape and count. Pure.
import type { SpeakerCabinet, SpeakerChamber, SpeakerPort } from "../../../types";
import { chamberHornPort, chamberVentModel, stuffedLiters } from "../chamberAir";
import { PORT_RULE, portRule } from "../speakerLayout";
import { ventTuningHz } from "../../acoustics/hornModel";
import { hifiPortElbows } from "../../acoustics/wooferBox";
import { ventSizesFor } from "../../optimizer/searchSpace";
import { passiveRadiatorMassMax, HIFI_PASSIVES } from "../../data";
import { byId } from "../../tables";
import { PORT_SHAPE, VENT_KIND } from "../../../constants/speakerSpec";
import { SPEAKER_STEPS } from "../../../constants/speakerSteps";
import { onStep } from "./space";

/** The factors a Hi-fi rule port's size tries on yours (a slot's narrow side, a tube's diameter). */
const PORT_SIZE_FACTORS = [0.75, 1, 1.25, 1.5, 2];
/** The smallest slot and tube a port takes, in. */
const MIN_SLOT_IN = 0.25;
const MIN_DIA_IN = 0.75;
/** The shortest port the search builds, in. */
const MIN_PORT_LEN_IN = 0.5;
/** How many radiator masses the search tries, from none to the most the radiator takes. */
const RADIATOR_MASS_STEPS = 6;

/** A port's size along the axis the ladder moves (a duct's throat, a slot's narrow side, a tube's diameter). */
const sizeOf = (p: SpeakerPort) =>
  p.shape === PORT_SHAPE.duct ? p.throat : p.shape === PORT_SHAPE.slot ? p.h : p.dia;

/** The port at another size. */
const sized = (p: SpeakerPort, x: number): SpeakerPort =>
  p.shape === PORT_SHAPE.duct
    ? { ...p, throat: x }
    : p.shape === PORT_SHAPE.slot
      ? { ...p, h: x }
      : { ...p, dia: x };

/**
 * The port sizes a vented chamber tries, smallest first, yours among them: a PA port the PA search's sizes for its style
 * (tubes of its count), a Hi-fi port yours ×0.75 to ×2 on the field's step. Empty for a chamber with no port.
 */
export function portSizes(chamber: SpeakerChamber): SpeakerPort[] {
  if (chamber.vent.kind !== VENT_KIND.vented) return [];
  const port = chamber.vent.port;
  const rule = portRule(chamber);
  let sizes: number[];
  if (rule?.rule === PORT_RULE.pa) {
    const ladder = ventSizesFor(rule.portStyle);
    sizes =
      port.shape === PORT_SHAPE.duct
        ? ladder.flatMap((s) => (s.throat === undefined ? [] : [s.throat]))
        : port.shape === PORT_SHAPE.slot
          ? ladder.flatMap((s) => (s.slotH === undefined ? [] : [s.slotH]))
          : ladder.flatMap((s) => (s.nt === port.n && s.dia !== undefined ? [s.dia] : []));
  } else if (port.shape === PORT_SHAPE.slot)
    sizes = PORT_SIZE_FACTORS.map((f) =>
      Math.max(MIN_SLOT_IN, onStep(port.h * f, SPEAKER_STEPS.slotHIn)),
    );
  else if (port.shape === PORT_SHAPE.duct)
    sizes = PORT_SIZE_FACTORS.map((f) => onStep(port.throat * f, SPEAKER_STEPS.portSizeIn));
  else
    sizes = PORT_SIZE_FACTORS.map((f) =>
      Math.max(MIN_DIA_IN, onStep(port.dia * f, SPEAKER_STEPS.portSizeIn)),
    );
  const own = sizeOf(port);
  return [...new Set([...sizes, own])]
    .sort((a, b) => a - b)
    .map((x) => (x === own ? port : sized(port, x)));
}

/** The chamber with this port (its vent's other settings kept). */
export function withPort(chamber: SpeakerChamber, port: SpeakerPort): SpeakerChamber {
  return chamber.vent.kind === VENT_KIND.vented
    ? { ...chamber, vent: { ...chamber.vent, port } }
    : chamber;
}

/** A Hi-fi round port's elbows as the Hi-fi rule bends it at its length (its own count where it doesn't fit). */
function bent(
  cabinet: Pick<SpeakerCabinet, "panel">,
  chamber: SpeakerChamber,
  port: SpeakerPort,
): SpeakerPort {
  const rule = portRule(withPort(chamber, port));
  if (
    rule?.rule !== PORT_RULE.hifi ||
    port.shape === PORT_SHAPE.slot ||
    port.shape === PORT_SHAPE.duct
  )
    return port;
  const elbows = hifiPortElbows(chamber.dims, cabinet.panel.thicknessIn, port);
  return elbows === null ? port : { ...port, elbows };
}

/**
 * The port at the length that tunes the chamber to `fbHz` (as the speaker model tunes it: the horn engine's
 * `ventTuningHz` on the stuffed net air, the vent's effective length by its rule, whose end corrections move with the
 * length), on the length field's step; null when even the shortest port tunes it lower than that. `netOf` gives the chamber's net air with a port in it, L.
 * `cabinet` holds the chamber at index `k` (its neighbors set its shared walls).
 */
export function tunedPort(
  cabinet: SpeakerCabinet,
  k: number,
  port: SpeakerPort,
  fbHz: number,
  netOf: (cabinet: SpeakerCabinet, chamber: SpeakerChamber) => number,
): SpeakerPort | null {
  const at = (p: SpeakerPort) => {
    const chamber = withPort(cabinet.chambers[k], p);
    const cab = { ...cabinet, chambers: cabinet.chambers.map((c, i) => (i === k ? chamber : c)) };
    return { chamber, cab };
  };
  let p = bent(cabinet, cabinet.chambers[k], port);
  for (let i = 0; i < 6; i++) {
    const { chamber, cab } = at(p);
    const vm = chamberVentModel(cab, chamber);
    const port = chamberHornPort(cab, chamber);
    if (!vm || !port) return null;
    const air = stuffedLiters(chamber, netOf(cab, chamber));
    if (!(air > 0)) return null;
    const Fb = ventTuningHz(air, port);
    if (Fb === null) return null;
    /** the vent's effective length, in: its path length plus its end corrections */
    const effectiveIn = p.len + vm.endCorrectionIn;
    // the tuning goes about as 1/√(effective length) (exactly, for a lumped vent): the next step's length
    const len = p.len + effectiveIn * (Math.pow(Fb / fbHz, 2) - 1);
    if (!Number.isFinite(len)) return null;
    const done = Math.abs(len - p.len) < 0.01;
    p = bent(cabinet, chamber, { ...p, len: Math.max(MIN_PORT_LEN_IN / 2, len) });
    if (done) break;
  }
  if (p.len < MIN_PORT_LEN_IN) return null;
  return bent(cabinet, cabinet.chambers[k], {
    ...p,
    len: Math.max(MIN_PORT_LEN_IN, onStep(p.len, SPEAKER_STEPS.portLenIn)),
  });
}

/** The added masses a chamber's radiators try, g, on the field's step: none to the most they take, yours among them. */
export function radiatorMasses(chamber: SpeakerChamber): number[] {
  if (chamber.vent.kind !== VENT_KIND.radiator) return [];
  const own = chamber.vent.radiators.addG;
  const drv = byId(HIFI_PASSIVES, chamber.vent.radiators.id);
  if (!drv) return [own];
  const max = passiveRadiatorMassMax(drv);
  const steps = Array.from({ length: RADIATOR_MASS_STEPS }, (_, i) =>
    onStep((max * i) / (RADIATOR_MASS_STEPS - 1), SPEAKER_STEPS.addG),
  );
  return [...new Set([...steps, own])].sort((a, b) => a - b);
}
