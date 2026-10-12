// Where a chamber's vent and horn mouth sit: placed by their rule (Auto), or at a set position (Custom), as the
// layout (lib/speaker/speakerLayout) takes them. Pure.
import type {
  ChamberLoad,
  ChamberVent,
  FacePoint,
  RadiatorPanel,
  SpeakerCabinet,
  SpeakerChamber,
  VentPanel,
  VentPosition,
} from "../../types";
import {
  hornFlare,
  radiatorsAt,
  roundPortsAt,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { RADIATOR_PANEL } from "../../lib/hifi/hifi";
import { PANEL } from "../../constants/cutParts";
import { CHAMBER_LOAD, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";

/** A radiator panel as a vent's: a side panel isn't one a vent position names, so the back stands for it. */
const ventPanelOf = (panel: RadiatorPanel): VentPanel =>
  panel === PANEL.side ? PANEL.back : panel;

/** The center of a group of spots. */
const centerOf = (spots: readonly { x: number; y: number }[]): FacePoint => ({
  xIn: spots.reduce((sum, s) => sum + s.x, 0) / Math.max(1, spots.length),
  yIn: spots.reduce((sum, s) => sum + s.y, 0) / Math.max(1, spots.length),
});

/**
 * The vent with its position set, or cleared (undefined: its rule places it). Only a Hi-fi round port (not the PA's
 * flared tubes, whose place is part of the PA tube rule) and passive radiators can have one; any other vent comes back
 * as it is.
 */
export function withVentPosition(
  vent: ChamberVent,
  position: VentPosition | undefined,
): ChamberVent {
  if (vent.kind === VENT_KIND.radiator) {
    const { position: _old, ...rest } = vent;
    return position ? { ...rest, position } : rest;
  }
  if (vent.kind !== VENT_KIND.vented) return vent;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.slot || port.shape === PORT_SHAPE.duct || port.flared) return vent;
  const { position: _old, ...rest } = port;
  return { ...vent, port: position ? { ...rest, position } : rest };
}

/** A vent a position can move, and where it is: its set position (absent: Auto), and where its rule puts it. */
export interface VentPlace {
  /** what moves: round ports or passive radiators */
  what: typeof VENT_KIND.vented | typeof VENT_KIND.radiator;
  position: VentPosition | undefined;
  auto: VentPosition;
}

/**
 * The chamber's vent as a position moves it: its set position and its rule's place (the center of the round ports' row
 * along the baffle's bottom, or of the radiators' stack on `RADIATOR_PANEL`). Null for a vent that doesn't move: sealed,
 * slots, side ducts and the PA's flared tubes.
 */
export function ventPlace(
  cabinet: Pick<SpeakerCabinet, "panel">,
  placed: PlacedChamber,
): VentPlace | null {
  const { vent } = placed.chamber;
  const byRule: PlacedChamber = {
    ...placed,
    chamber: { ...placed.chamber, vent: withVentPosition(vent, undefined) },
  };
  if (vent.kind === VENT_KIND.radiator)
    return {
      what: VENT_KIND.radiator,
      position: vent.position,
      auto: {
        panel: ventPanelOf(RADIATOR_PANEL),
        ...centerOf(radiatorsAt(cabinet, byRule).spots),
      },
    };
  if (vent.kind !== VENT_KIND.vented) return null;
  const { port } = vent;
  if (port.shape === PORT_SHAPE.slot || port.shape === PORT_SHAPE.duct || port.flared) return null;
  const { panel, spots } = roundPortsAt(byRule, { ...port, position: undefined });
  return {
    what: VENT_KIND.vented,
    position: port.position,
    auto: { panel, ...centerOf(spots) },
  };
}

/** The chamber's load with its horn's mouth set, or cleared (undefined: centered on the clear face). */
export function withMouthPosition(load: ChamberLoad, position: FacePoint | undefined): ChamberLoad {
  if (load.kind !== CHAMBER_LOAD.horn) return load;
  const { mouthPosition: _old, ...horn } = load.horn;
  return { ...load, horn: position ? { ...horn, mouthPosition: position } : horn };
}

/**
 * A horn chamber's mouth as a position moves it: its set position (absent: Auto) and the center of its clear face,
 * where the mouth sits by default. Null for a chamber with no horn or no segments.
 */
export function mouthPlace(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  placed: PlacedChamber,
): { position: FacePoint | undefined; auto: FacePoint } | null {
  const { load } = placed.chamber;
  if (load.kind !== CHAMBER_LOAD.horn) return null;
  const chamber: SpeakerChamber = {
    ...placed.chamber,
    load: withMouthPosition(load, undefined),
  };
  const flare = hornFlare(cabinet, { ...placed, chamber });
  if (!flare) return null;
  const { mouth } = flare;
  return {
    position: load.horn.mouthPosition,
    auto: { xIn: mouth.x + mouth.w / 2 - placed.cx, yIn: mouth.y + mouth.h / 2 - placed.y0 },
  };
}
