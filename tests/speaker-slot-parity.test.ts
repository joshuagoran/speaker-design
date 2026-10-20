// The Speaker page's PA sub template against the PA design's sub (the same design, DEFAULT_PA): the letterbox's fins,
// its size and length, the model's vent and net air by the PA slot rule and the PA sub box's sum, the cutlist's pieces
// and the 3D view's fins match. And a letterbox built from the settings with another fin count carries it into the
// cutlist, the model and the views.
import { test } from "vite-plus/test";
import assert from "node:assert";
import * as THREE from "three";
import { templateSpeaker, defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { chamberVentModel } from "../src/lib/speaker/chamberAir";
import { speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { portRule, PORT_RULE, speakerLayout } from "../src/lib/speaker/speakerLayout";
import {
  maxSlotFins,
  slotFinLayout,
  slotFinsOf,
  slotMouthCorrection,
} from "../src/lib/acoustics/boxModels";
import { rectangleEndCorrection } from "../src/lib/acoustics/radiation";
import { paSubBuild, paSubNetAir } from "./pa-build";
import { buildSpeakerScene } from "../src/components/stack-view/buildSpeakerScene";
import { buildSubSlotShelf } from "../src/components/stack-view/buildSubwoofer";
import { subVentPlan } from "../src/lib/build/ventPlan";
import { createSceneContext } from "../src/components/stack-view/sceneContext";
import { VENT_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { SUB_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { DEFAULT_PA } from "../src/lib/defaults";
import { PA_SLOT_FINS, PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import type { CutPart, Dims3, SpeakerChamber, SpeakerSpec } from "../src/types";

/** A cutlist's pieces by part and size: each part's count at each size (the box, row and note aside). */
function pieces(parts: readonly CutPart[]) {
  const out = new Map<string, number>();
  for (const p of parts) {
    const k = `${p.part} ${p.a.toFixed(4)} × ${p.b.toFixed(4)} × ${p.t.toFixed(4)}`;
    out.set(k, (out.get(k) ?? 0) + p.qty);
  }
  return Object.fromEntries([...out].sort(([a], [b]) => a.localeCompare(b)));
}

/** The fins in a group: the vent's boxes a wall thick and a slot tall. */
function finsIn(group: THREE.Object3D, t: number, slotH: number) {
  let n = 0;
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.name !== VENT_MESH_NAME) return;
    const g = o.geometry;
    if (g instanceof THREE.BoxGeometry && g.parameters.width === t && g.parameters.height === slotH)
      n++;
  });
  return n;
}

/** The default PA design's sub: the design, its driver, and its box's cutlist as the PA adapter's spec builds it. */
function paSub() {
  const cfg = defaultPaDesign();
  const sub = byIdOrThrow(SUB_OPTIONS, cfg.sub, "subs");
  return { cfg, sub, parts: paSubBuild(cfg, "design").parts() };
}

/** The template's one chamber and its letterbox. */
function letterboxOf(spec: SpeakerSpec) {
  const [chamber] = spec.cabinet.chambers;
  assert.ok(chamber.vent.kind === VENT_KIND.vented);
  const { vent } = chamber;
  const { port } = vent;
  assert.ok(port.shape === PORT_SHAPE.slot && port.fins !== undefined, "a letterbox");
  return { chamber, vent, port };
}

test("the Speaker page's PA sub matches the PA design's: fins, slot, vent, net air, cutlist and 3D fins", () => {
  assert.equal(DEFAULT_PA.portStyle, "slots", "the PA's starting sub has the letterbox");
  const pa = paSub();
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
  const { chamber, port } = letterboxOf(spec);
  const t = spec.cabinet.panel.thicknessIn;
  // the slot: the PA design's fins, height and length, on the PA rule
  assert.equal(port.fins, PA_SLOT_FINS);
  assert.deepEqual([port.h, port.len], [pa.cfg.cVent.slotH, pa.cfg.cVent.len]);
  assert.equal(t, pa.cfg.wall);
  assert.equal(portRule(chamber)?.rule, PORT_RULE.pa);
  // the model's vent: the PA slot rule's area (the fins off the inside width), length and end correction (outside, the
  // floor mirrors the mouth; inside, its mouth on the floor, the back wall behind, its shelf from behind the baffle)
  const box = pa.cfg.cDim,
    inset = pa.cfg.inset;
  const open = box.w - 2 * t - PA_SLOT_FINS * t;
  const vent = chamberVentModel(spec.cabinet, chamber);
  assert.ok(vent);
  assert.ok(Math.abs(vent.areaIn2 - port.h * open) < 1e-9, `area ${vent.areaIn2}`);
  assert.equal(vent.lenIn, port.len);
  assert.ok(port.len < box.d - t - port.h, "a straight slot");
  const ec =
    rectangleEndCorrection(2 * port.h, open) +
    slotMouthCorrection(port.h, box.h - 2 * t, box.d - t - port.len, t, port.len - inset - 0.75);
  assert.ok(Math.abs(vent.endCorrectionIn - ec) < 1e-9, "end correction");
  // the net air: the PA sub box's sum
  const net = speakerResponse(spec).chambers[0].netLiters;
  const netL = paSubNetAir(pa.cfg);
  assert.ok(Math.abs(net - netL) < 1e-9 * netL, `net ${net}`);
  // the cutlist: the PA design's sub's pieces, the fins among them
  const parts = speakerCutParts(spec.cabinet, "butt").parts;
  assert.deepEqual(pieces(parts), pieces(pa.parts));
  const fins = parts.find((p) => p.part === "ductFin");
  assert.equal(fins?.qty, PA_SLOT_FINS);
  // the 3D view: the PA sub scene builds as many fins as the Speaker page's
  const ctx = createSceneContext({
    wall: t,
    inset: pa.cfg.inset,
    cabFinish: DEFAULT_PA.cabFinish,
    baffleColor: DEFAULT_PA.baffleColor,
    cutaway: true,
    horn: {},
  });
  const plan = subVentPlan(
    pa.sub,
    pa.cfg.cDim,
    pa.cfg.portStyle,
    { ductH: pa.cfg.cVent.slotH, tubeLen: pa.cfg.cVent.len },
    t,
  );
  buildSubSlotShelf(ctx, plan, { box: pa.cfg.cDim, plinth: 0, parent: ctx.group });
  const scene = buildSpeakerScene({ spec, cutaway: true });
  assert.equal(finsIn(ctx.group, t, port.h), PA_SLOT_FINS);
  assert.equal(finsIn(scene, t, port.h), PA_SLOT_FINS);
});

test("a letterbox's fin count reaches the cutlist, the model and the views", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
  const { chamber, vent: chamberVent, port } = letterboxOf(spec);
  const t = spec.cabinet.panel.thicknessIn;
  const withFins = (fins: number): SpeakerSpec => {
    const c: SpeakerChamber = { ...chamber, vent: { ...chamberVent, port: { ...port, fins } } };
    return { ...spec, cabinet: { ...spec.cabinet, chambers: [c] } };
  };
  const dims: Dims3 = chamber.dims;
  const iw = dims.w - 2 * t;
  for (const fins of [0, 1, 3, 4]) {
    const s = withFins(fins);
    const [c] = s.cabinet.chambers;
    // the model: the fins' thickness off the width
    const vent = chamberVentModel(s.cabinet, c);
    assert.ok(vent && Math.abs(vent.areaIn2 - port.h * (iw - fins * t)) < 1e-9, `${fins}: area`);
    // the cutlist: that many fins, none for none
    const row = speakerCutParts(s.cabinet, "butt").parts.find((p) => p.part === "ductFin");
    assert.equal(row?.qty ?? 0, fins, `${fins}: cutlist`);
    // the 3D view: that many fins, and the front drawing's openings between them
    assert.equal(finsIn(buildSpeakerScene({ spec: s, cutaway: true }), t, port.h), fins);
    const rule = portRule(c);
    assert.ok(rule?.rule === PORT_RULE.pa);
    const placed = speakerLayout(s.cabinet).chambers[0];
    const plan = subVentPlan(rule.sub, placed.dims, rule.portStyle, rule.portGeom, t);
    assert.equal(plan.fins.openings.length, fins + 1, `${fins}: openings`);
    // the openings and fins fill the inside width
    const layout = slotFinLayout(iw, t, fins);
    assert.ok(Math.abs((fins + 1) * layout.open + fins * t - iw) < 1e-9);
  }
});

test("a high fin count is held to what the width takes: the area stays positive, the end correction finite", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
  const { chamber, vent: chamberVent, port } = letterboxOf(spec);
  const t = spec.cabinet.panel.thicknessIn;
  const iw = chamber.dims.w - 2 * t;
  const most = maxSlotFins(iw, t, port.h);
  assert.ok(most >= PA_SLOT_FINS, "the default two fit the default box");
  // each opening at least the ply and half the slot's height
  assert.ok(slotFinLayout(iw, t, most).open >= Math.max(t, port.h / 2) - 1e-9);
  assert.ok(slotFinLayout(iw, t, most + 1).open < Math.max(t, port.h / 2));
  const fins = 40;
  assert.equal(slotFinsOf({ fins, slotH: port.h }, iw, t), most);
  assert.equal(slotFinsOf({ slotH: port.h }, iw, t), PA_SLOT_FINS);
  const c: SpeakerChamber = { ...chamber, vent: { ...chamberVent, port: { ...port, fins } } };
  const s: SpeakerSpec = { ...spec, cabinet: { ...spec.cabinet, chambers: [c] } };
  const vent = chamberVentModel(s.cabinet, c);
  assert.ok(vent && vent.areaIn2 > 0 && Number.isFinite(vent.endCorrectionIn));
  assert.ok(Math.abs(vent.areaIn2 - port.h * (iw - most * t)) < 1e-9);
  const row = speakerCutParts(s.cabinet, "butt").parts.find((p) => p.part === "ductFin");
  assert.equal(row?.qty, most);
  assert.equal(finsIn(buildSpeakerScene({ spec: s, cutaway: true }), t, port.h), most);
});
