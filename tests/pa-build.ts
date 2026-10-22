// The Speaker page's build of a PA design, read through the PA adapter (lib/speaker/paSpec): the sub's chamber (its
// vent, net air, bracing, hardware and cutlist) and the mid's. The tests of the PA boxes' build rules read these.
import assert from "node:assert";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { chamberVentModel } from "../src/lib/speaker/chamberAir";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { stackCutParts } from "../src/lib/speaker/stackBuild";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { panelNominalNear } from "../src/lib/build/panel";
import { SPEAKER_PART } from "../src/constants/speakerSpec";
import { internalWoodLiters, subHardwarePlan } from "../src/lib/acoustics/boxModels";
import { SUB_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { chamberCutBox, CORNER_JOINT } from "../src/constants/cutParts";
import { LITERS_PER_CUBIC_IN } from "../src/constants/units";
import { PA_FLOOR, speakerAndFeed } from "./speaker-cases";
import type { CornerJoint, Dims3, PaDesign, PortStyle, SpeakerSpec, VentSpec } from "../src/types";

/** The default PA design with `over` set; its panel's nominal size follows the wall unless `over` sets it. */
export function paDesignWith(over: Partial<PaDesign>): PaDesign {
  const cfg = { ...defaultPaDesign(over.layout), ...over };
  return { ...cfg, panel: over.panel ?? panelNominalNear(cfg.wall) };
}

/** Which hardware the speakers keep: the design's (`design`), or none at all: no handles and no input dish. */
export type PaBuildHardware = "design" | "none";

/** The spec with no handles and no input dish. */
const withoutHardware = (spec: SpeakerSpec): SpeakerSpec => ({
  ...spec,
  cabinet: { ...spec.cabinet, handles: null, inputDish: false },
});

/**
 * The design's cutlist as the Stack page cuts it (lib/speaker/stackBuild): each member's boxes tagged apart, the sub's
 * first.
 */
export function paStackParts(
  cfg: PaDesign,
  joint: CornerJoint = CORNER_JOINT.butt,
  hardware: PaBuildHardware = "none",
) {
  const read = layersFromPa(cfg, { id: "pa", name: "pa" }, PA_FLOOR);
  const speakers = hardware === "none" ? read.speakers.map(withoutHardware) : read.speakers;
  return stackCutParts(read.stack, speakers, joint, {}).parts;
}

/** The design's speakers on the Speaker page: the sub's (the tower's whole cabinet) and the mid's (the tower again). */
export function paSpeakers(cfg: PaDesign, hardware: PaBuildHardware = "none") {
  const read = layersFromPa(cfg, { id: "pa", name: "pa" }, PA_FLOOR);
  const tower = cfg.layout === "tower";
  const fit = (spec: SpeakerSpec) => (hardware === "none" ? withoutHardware(spec) : spec);
  const sub = fit(speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub).spec);
  const top = tower ? sub : fit(speakerAndFeed(read, SPEAKER_PART.top).spec);
  return { sub, top, midIndex: tower ? 1 : 0 };
}

/** The Speaker build of the design's sub chamber: its spec, build, vent, net air and the cabinet's cutlist. */
export function paSubBuild(cfg: PaDesign, hardware: PaBuildHardware = "none") {
  const { sub: spec } = paSpeakers(cfg, hardware);
  const [chamber] = spec.cabinet.chambers;
  const [build] = cabinetBuild(spec.cabinet).chambers;
  assert.ok(chamber && build, "a sub chamber");
  return {
    spec,
    chamber,
    build,
    vent: chamberVentModel(spec.cabinet, chamber),
    netL: speakerResponse(spec).chambers[0].netLiters,
    parts: (joint: CornerJoint = CORNER_JOINT.butt) => speakerCutParts(spec.cabinet, joint).parts,
  };
}

/** The Speaker build of the design's mid chamber (its own box, or the tower's middle chamber) and its cabinet's cutlist. */
export function paMidBuild(cfg: PaDesign, hardware: PaBuildHardware = "none") {
  const { top: spec, midIndex } = paSpeakers(cfg, hardware);
  const build = cabinetBuild(spec.cabinet).chambers[midIndex];
  assert.ok(build, "a mid chamber");
  return {
    spec,
    build,
    parts: (joint: CornerJoint = CORNER_JOINT.butt) => speakerCutParts(spec.cabinet, joint).parts,
  };
}

/**
 * A PA design with the sub box `cDim`, its port style and its vent: `cVent` over the default vent's sizes; `over` sets
 * the rest (the wall, the inset, the sub).
 */
export function paSubBox(
  cDim: Dims3,
  portStyle: PortStyle,
  cVent: Partial<VentSpec>,
  over: Partial<PaDesign> = {},
): PaDesign {
  const base = paDesignWith(over);
  return paDesignWith({ ...over, cDim, portStyle, cVent: { ...base.cVent, ...cVent } });
}

/** The Speaker build's vent of a PA sub box (`paSubBox`); fails the test when the chamber has none. */
export function paSubVent(...args: Parameters<typeof paSubBox>) {
  const { vent } = paSubBuild(paSubBox(...args));
  assert.ok(vent, "a vented sub");
  return vent;
}

/**
 * The PA sub chamber's net air by the PA sub box's sum, L: its inside by hand (two walls off the width and height; the
 * inset, the 3/4″ baffle and the back off the depth), less the sub's displacement, the vent's air, the wood of its
 * cutlist rows inside it, and its hardware's recesses by the hardware rule (with the design's hardware). The tower's sub
 * chamber counts the wood of the sub box built as a box of its own: the tower's cleats run the whole cabinet's height,
 * and its sub chamber holds the same air as that box (tests/tower.test.ts).
 */
export function paSubNetAir(cfg: PaDesign) {
  const sub = byIdOrThrow(SUB_OPTIONS, cfg.sub, "subs");
  const { cDim: box, wall: t, inset } = cfg;
  const insideL =
    (box.w - 2 * t) * (box.h - 2 * t) * (box.d - inset - 0.75 - t) * LITERS_PER_CUBIC_IN;
  const built = paSubBuild(cfg, "design");
  assert.ok(built.vent, "a vented sub");
  const ventL = built.vent.areaIn2 * built.vent.lenIn * LITERS_PER_CUBIC_IN;
  const ownBox = cfg.layout === "tower" ? paSubBuild({ ...cfg, layout: "stack" }, "design") : built;
  const woodL = internalWoodLiters(ownBox.parts(), chamberCutBox(0));
  const { liters: recessL } = subHardwarePlan(
    box,
    t,
    inset,
    cfg.portStyle,
    cfg.cVent,
    sub,
    cfg.braceStyle,
    cfg.hardware.sub,
    cfg.backJoint,
  );
  return insideL - sub.ts.disp - ventL - woodL - recessL;
}
