// The Load setting of a chamber on the Speaker page (src/pages/speaker/chamberLoad): Horn starts a horn from the chamber's cones
// and size that models and draws; Direct removes it; a chamber without a cone can't take a horn.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  flareLiters,
  hornRoom,
  startingHorn,
  withChamberLoad,
} from "../src/pages/speaker/chamberLoad";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { coneDepthIn, coneParts } from "../src/lib/speaker/driverParts";
import { wallClearanceIn } from "../src/lib/speaker/hornThroat";
import { SPEAKER_TEMPLATE, type SpeakerTemplate } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM_PER_IN, CM2_PER_IN2 } from "../src/constants/units";
import type { ChamberLoad, SpeakerSpec } from "../src/types";

const responseOf = (spec: SpeakerSpec) => speakerResponse(spec, { feed: spec.input });

/** The spec with chamber `i`'s load switched to `kind`, as the Load setting switches it. */
function switched(spec: SpeakerSpec, i: number, kind: ChamberLoad["kind"]) {
  const placed = speakerLayout(spec.cabinet).chambers[i];
  const chamber = spec.cabinet.chambers[i];
  const room = hornRoom(spec.cabinet, chamber, placed);
  const next = withChamberLoad(chamber, kind, room, responseOf(spec).chambers[i]?.netLiters);
  return {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c, k) => (k === i ? next : c)),
    },
  };
}

/** Templates with a chamber of cones alone and a vent the horn engine takes, by the chamber's place. */
const MODELED: readonly [SpeakerTemplate, number][] = [
  [SPEAKER_TEMPLATE.monitorCoax, 0],
  [SPEAKER_TEMPLATE.fill, 0],
  [SPEAKER_TEMPLATE.paTowerBaffleHorn, 1],
];

test("speaker horn load: Horn starts one conical section from the cones to the clear face", () => {
  for (const [template, i] of MODELED) {
    const spec = templateSpeaker(template);
    const chamber = spec.cabinet.chambers[i];
    assert.equal(chamber.load.kind, CHAMBER_LOAD.direct, template);
    const horned = switched(spec, i, CHAMBER_LOAD.horn);
    const after = horned.cabinet.chambers[i];
    assert.ok(after.load.kind === CHAMBER_LOAD.horn, template);
    const { horn } = after.load;
    assert.equal(horn.segments.length, 1);
    const [s] = horn.segments;
    assert.equal(s.profile, HORN_PROFILE.conical);
    assert.equal(horn.path, HORN_PATH.straight);
    assert.equal(horn.drive.kind, HORN_DRIVE.front);
    assert.equal(horn.mouthPosition, undefined, "the mouth centered");
    // the throat: every cone's Sd times its count
    const sd = chamber.drivers.reduce((sum, d) => sum + (coneParts(d)?.ts.Sd ?? 0) * d.count, 0);
    assert.equal(s.s1, sd, template);
    // the mouth: the clear face, drawn whole (not clipped, not a placeholder)
    const placed = speakerLayout(horned.cabinet).chambers[i];
    const clearCm2 = placed.clear.w * placed.clear.h * CM2_PER_IN2;
    assert.ok(Math.abs(s.s2 - clearCm2) < 1e-6, template);
    const flare = hornFlare(horned.cabinet, placed);
    assert.ok(flare, `${template}: the flare draws`);
    assert.equal(flare.mouthClipped, false);
    assert.ok(flare.path.fits, `${template}: the path fits the chamber`);
    // the length: the clear depth less the deepest cone and the walls' clearance in front of it
    const room = hornRoom(spec.cabinet, chamber, placed);
    const cone = Math.max(...chamber.drivers.map((d) => coneDepthIn(d) ?? 0));
    const clearance = wallClearanceIn(chamber.drivers);
    assert.ok(Math.abs(s.length / CM_PER_IN - (room.depthIn - cone - clearance)) < 1e-9, template);
    // the net air: the rear chamber, the flare's air taken off
    const before = responseOf(spec).chambers[i].netLiters;
    assert.ok(after.netLiters !== null);
    assert.ok(Math.abs(after.netLiters - (before - flareLiters(horn))) <= 0.05 + 1e-9, template);
    // it models: no gap, a tuning, a finite response that differs from the direct box
    const r = responseOf(horned);
    assert.deepEqual(r.chambers[i].gaps, [], template);
    assert.ok(
      r.sum.every((p) => Number.isFinite(p.spl)),
      template,
    );
    const direct = responseOf(spec).sum;
    assert.ok(Math.max(...r.sum.map((p, k) => Math.abs(p.spl - direct[k].spl))) > 0.1, template);
  }
});

test("speaker horn load: Direct removes the horn and sets the net air back to Auto", () => {
  for (const [template, i] of MODELED) {
    const spec = templateSpeaker(template);
    const horn = switched(spec, i, CHAMBER_LOAD.horn);
    const back = switched(horn, i, CHAMBER_LOAD.direct);
    const chamber = back.cabinet.chambers[i];
    const start = spec.cabinet.chambers[i];
    assert.equal(chamber.load.kind, CHAMBER_LOAD.direct, template);
    assert.equal(chamber.netLiters, null, template);
    // the vent is the horn's (a horn's vent starts again: hornVentFrom); the rest is as it started
    assert.deepEqual(chamber.vent, horn.cabinet.chambers[i].vent, template);
    assert.deepEqual({ ...chamber, vent: start.vent }, start, `${template}: as it started`);
    assert.deepEqual(responseOf(back).chambers[i].gaps, [], template);
  }
  // a template's horn chamber goes direct too, and still models
  const bin = switched(templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne), 0, CHAMBER_LOAD.direct);
  assert.equal(bin.cabinet.chambers[0].load.kind, CHAMBER_LOAD.direct);
  assert.deepEqual(responseOf(bin).chambers[0].gaps, []);
});

test("speaker horn load: a chamber without a cone can't take a horn; the same load changes nothing", () => {
  const tower = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  // the horn section: a compression driver on its catalog horn, no cone
  const hf = tower.cabinet.chambers[2];
  const room = hornRoom(tower.cabinet, hf, speakerLayout(tower.cabinet).chambers[2]);
  assert.equal(startingHorn(hf, room), null);
  assert.equal(withChamberLoad(hf, CHAMBER_LOAD.horn, room, 10), hf);
  const bin = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne).cabinet.chambers[0];
  assert.equal(withChamberLoad(bin, CHAMBER_LOAD.horn, room, 10), bin, "already a horn");
});

test("speaker horn load: the flare's air follows each section's flare law", () => {
  const section = { s1: 100, s2: 400, length: 50 };
  const con = flareLiters({ segments: [{ ...section, profile: HORN_PROFILE.conical }] });
  const exp = flareLiters({ segments: [{ ...section, profile: HORN_PROFILE.exponential }] });
  const par = flareLiters({ segments: [{ ...section, profile: HORN_PROFILE.parabolic }] });
  // conical: (50/3)(100 + 400 + 200) cm³; exponential: 300 · 50 / ln 4 cm³; parabolic: 50 (100 + 400) / 2 cm³
  assert.ok(Math.abs(con - ((50 / 3) * 700) / 1000) < 1e-3, `${con}`);
  assert.ok(Math.abs(exp - (300 * 50) / Math.log(4) / 1000) < 1e-3, `${exp}`);
  assert.ok(Math.abs(par - (50 * 500) / 2 / 1000) < 1e-3, `${par}`);
  assert.ok(
    par > con,
    "a straight-sided flare holds more air than a conical one between the same areas",
  );
  assert.ok(
    exp < con,
    "an exponential flare holds less air than a conical one between the same areas",
  );
  // equal areas: a straight duct either way
  const duct = { s1: 200, s2: 200, length: 30 };
  for (const profile of Object.values(HORN_PROFILE))
    assert.ok(Math.abs(flareLiters({ segments: [{ ...duct, profile }] }) - 6) < 1e-3, profile);
});
