import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  sideDuctEndCorrection,
  slotMouthCorrection,
  maxStraightSlotIn,
  minFoldedSlotIn,
} from "../src/lib/acoustics/boxModels";
import {
  BOTH_ENDS_CORRECTION_RATIO,
  rectangleEndCorrection,
  rectangleEndCorrectionIntegral,
} from "../src/lib/acoustics/radiation";
import { ductFit } from "../src/lib/speaker/chips";
import { SHARP_BEND_CORRECTION } from "../src/data/acoustics/slot-inner-end";
import { SUB_OPTIONS } from "../src/lib/data";
import { portOfEffectiveLength, ventTuningHz } from "../src/lib/acoustics/hornModel";
import { chamberHornPort, chamberVentModel, stuffedLiters } from "../src/lib/speaker/chamberAir";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import type { Dims3, SpeakerChamber, SpeakerSpec } from "../src/types";
import { C, rel, close, vent, DRV18 } from "./helpers";
import { paSubBox, paSubBuild, paSubVent } from "./pa-build";

/** The tuning, Hz, of `liters` with a vent of `areaIn2` and effective length `effectiveIn` (the engine's duct). */
const engineFb = (liters: number, areaIn2: number, effectiveIn: number) =>
  ventTuningHz(liters, portOfEffectiveLength(areaIn2 * CM2_PER_IN2, effectiveIn * CM_PER_IN)) ??
  NaN;
/** Helmholtz's tuning, Hz, of `liters` with a vent of `areaIn2` and effective length `effectiveIn` (lumped). */
const helmholtzFb = (liters: number, areaIn2: number, effectiveIn: number) =>
  (C / (2 * Math.PI)) *
  Math.sqrt((areaIn2 * 0.00064516) / ((liters / 1000) * effectiveIn * 0.0254));
// Independent check of the closed form: integrate the potential of the rectangle numerically.
// phi(x, y) = integral of 1/distance over the rectangle, from its four corner sub-rectangles.
const F = (p: number, q: number) =>
  p <= 0 || q <= 0
    ? 0
    : p * Math.log((q + Math.hypot(p, q)) / p) + q * Math.log((p + Math.hypot(p, q)) / q);
const phi = (x: number, y: number, a: number, b: number) =>
  F(x, y) + F(a - x, y) + F(x, b - y) + F(a - x, b - y);
function Inum(a: number, b: number, n = 300) {
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) s += phi(((i + 0.5) * a) / n, ((j + 0.5) * b) / n, a, b);
  return (s * a * b) / (n * n);
}
test("rectI closed form matches numerical integration (square to 1:8)", (t) => {
  for (const [a, b] of [
    [1, 1],
    [1, 4],
    [6, 25],
    [3, 25],
  ])
    rel(t, rectangleEndCorrectionIntegral(a, b), Inum(a, b), 1e-4, `${a}x${b}`);
});
test("unit square: mean inverse distance 2.9732 (known constant)", (t) =>
  close(t, rectangleEndCorrectionIntegral(1, 1), 2.9732, 1e-4));
test("square aperture end correction ~ circle of equal area (0.8488 r)", (t) => {
  const r = Math.sqrt(1 / Math.PI);
  rel(t, rectangleEndCorrection(1, 1), 0.8488 * r, 0.02);
});
test("BOTH_ENDS reproduces 1.46 r for a round tube", (t) =>
  close(t, BOTH_ENDS_CORRECTION_RATIO * 0.8488, 1.46, 0.005));
test("long thin slot: end correction grows only as log of the width", (t) => {
  // doubling the width of a 1-wide strip adds ~ (1/pi) ln 2 per unit height, not sqrt(2) x
  const d = rectangleEndCorrection(1, 400) - rectangleEndCorrection(1, 200);
  close(t, d, Math.log(2) / Math.PI, 0.01);
});
test("letterbox Fb = Helmholtz with the slot end correction", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    g = paSubVent(box, "slots", { slotH: 3, len: 14 });
  const W = box.w - 1.5 - 1.5;
  // outside, the floor mirrors the mouth (a slot twice as tall); inside, its mouth on the floor, the back wall behind,
  // its shelf running into the box's air from behind the baffle (set 0.75 back, 0.75 thick)
  close(
    t,
    g.endCorrectionIn,
    rectangleEndCorrection(6, W) +
      slotMouthCorrection(3, 30 - 1.5, 20 - 0.75 - 14, 0.75, 14 - 0.75 - 0.75),
    1e-12,
  );
  // the engine's duct tunes a little below Helmholtz at the same effective length (its air's springiness, its exit's load)
  const duct = engineFb(120, g.areaIn2, 14 + g.endCorrectionIn),
    lumped = helmholtzFb(120, g.areaIn2, 14 + g.endCorrectionIn);
  assert.ok(duct < lumped);
  rel(t, duct, lumped, 0.03);
});
test("side ducts: each opening's correction, outside its throat x open height, inside a slot mouth on its side", (t) => {
  const box = { w: 22, h: 30, d: 20 };
  for (const st of ["vslots", "vslot1"] as const) {
    const g = paSubVent(box, st, { throat: 2, len: 12 });
    // outside, the ground mirrors the mouth's bottom (2 x 27.5 open, under two 1/2" dividers); inside, the side wall its
    // floor, the duct's inner wall its shelf from behind the baffle, the back wall behind it, the box's width (or half) across
    close(
      t,
      g.endCorrectionIn,
      rectangleEndCorrection(2, 2 * 27.5) +
        slotMouthCorrection(
          2,
          st === "vslots" ? 20.5 / 2 : 20.5,
          20 - 0.75 - 12,
          0.75,
          12 - 0.75 - 0.75,
        ),
      1e-12,
      st,
    );
  }
  // per-opening: two ducts tune like one duct in the mirrored half of the box (each opening its own correction; the
  // engine's duct, its exit one round opening of all the area, tunes them within 0.5 %)
  // the mirror image of one half: half the inner width, half the volume
  const half = { ...box, w: (box.w - 1.5) / 2 + 1.5 };
  const two = paSubVent(box, "vslots", { throat: 2, len: 12 }),
    one = paSubVent(half, "vslot1", { throat: 2, len: 12 });
  /** a vent's effective length, in */
  const eff = (v: typeof two) => v.lenIn + v.endCorrectionIn;
  rel(t, two.endCorrectionIn, one.endCorrectionIn, 1e-9, "each opening's correction");
  rel(t, helmholtzFb(120, two.areaIn2, eff(two)), helmholtzFb(60, one.areaIn2, eff(one)), 1e-9);
  rel(t, engineFb(120, two.areaIn2, eff(two)), engineFb(60, one.areaIn2, eff(one)), 0.005);
});
test("the speaker model passes the letterbox's end corrections to the engine", (t) => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
  const [chamber] = spec.cabinet.chambers;
  const port = chamberVentModel(spec.cabinet, chamber);
  assert.ok(port);
  const response = speakerResponse(spec);
  const air = stuffedLiters(chamber, response.chambers[0].netLiters);
  rel(
    t,
    response.chambers[0].fb ?? NaN,
    engineFb(air, port.areaIn2, port.lenIn + port.endCorrectionIn),
    1e-12,
  );
});

test("side duct: the mouth's gap to the back wall is the one the cutlist and the 3D view build", (t) => {
  // the duct's inner wall runs `len` from the frame front (the cutlist's side duct wall; the 3D view's from its face), so
  // the longest duct ductFit allows leaves a throat's width to the back panel's inside face
  const box = { w: 24, h: 30, d: 20 },
    wall = 0.75;
  const v = vent({
    throat: 2.5,
    len: ductFit(box, "vslots", vent({ throat: 2.5 }), wall, 0.75, DRV18).maxSide,
  });
  close(t, v.len, 20 - wall - 2.5, 1e-12);
  close(
    t,
    sideDuctEndCorrection(box, v, wall, 0.75, 2),
    rectangleEndCorrection(2.5, 2 * 27.5) +
      slotMouthCorrection(2.5, (24 - 1.5) / 2, 2.5, wall, v.len - 0.75 - 0.75),
    1e-12,
  );
  const parts = paSubBuild(
    paSubBox(box, "vslots", v, { sub: SUB_OPTIONS[0].id, wall, inset: 0.75 }),
  ).parts();
  const duct = parts.find((p) => p.part === "sideDuctWall");
  assert.equal(duct?.b, v.len);
  assert.equal(duct?.qty, 2);
});
test("side duct: a longer duct, its mouth nearer the back wall, takes a larger inner end correction", () => {
  const box = { w: 24, h: 30, d: 20 };
  let prev = 0;
  for (const len of [6, 9, 12, 14, 15.5, 16.75]) {
    const ec = sideDuctEndCorrection(box, vent({ throat: 2.5, len }), 0.75, 0.75, 2);
    assert.ok(ec > prev, `${len}: ${ec}`);
    prev = ec;
  }
});
test("bottom slot: straight while it fits, folded past that (a sharp bend, and its mouth under the lid)", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    outer = rectangleEndCorrection(6, 19);
  // the straight run holds d - t - slotH = 16.25 (from the frame front); its mouth is a slot height from the back wall
  /** the Speaker build's vent of a slot `len` long, and whether its cutlist folds it up the back wall */
  const slot = (len: number) => {
    const sub = paSubBuild(paSubBox(box, "slots", { slotH: 3, len }));
    assert.ok(sub.vent);
    return { ...sub.vent, folded: sub.parts().some((p) => p.part === "ductRearWall") };
  };
  const straight = slot(16.25);
  close(
    t,
    straight.endCorrectionIn,
    outer + slotMouthCorrection(3, 28.5, 3, 0.75, 16.25 - 1.5),
    1e-12,
  );
  assert.ok(!straight.folded);
  // folded 20 long: the rear wall would rise 20 - 19.25 = 0.75, held at the least 1 (0.25 over the roof), so the mouth
  // is 28.5 - 3 - 1 under the lid, the box's inside depth (20 less the 0.75 inset, the 0.75 baffle and the
  // 0.75 back) across it
  const folded = slot(20);
  close(
    t,
    folded.endCorrectionIn,
    outer + SHARP_BEND_CORRECTION * 3 + slotMouthCorrection(3, 17.75, 24.5, 0.75, 0.25),
    1e-12,
  );
  assert.ok(folded.folded);
  // folded as far as it goes: the mouth a slot height under the lid, the rear wall 28.5 - 6 up
  const top = slot(50);
  close(
    t,
    top.endCorrectionIn,
    outer + SHARP_BEND_CORRECTION * 3 + slotMouthCorrection(3, 17.75, 3, 0.75, 22.5 - 0.75),
    1e-12,
  );
});
test("slot mouth: a nearer facing wall always adds (no flat stretch over the last inch), a thicker shelf adds", () => {
  let prev = 0;
  for (const gap of [24, 12, 6, 4, 3, 2.25, 1.5, 1, 0.75]) {
    const ec = slotMouthCorrection(3, 28.5, gap, 0.75, 12);
    assert.ok(ec > prev, `gap ${gap}: ${ec}`);
    prev = ec;
  }
  assert.ok(slotMouthCorrection(3, 28.5, 3, 1.5, 12) > slotMouthCorrection(3, 28.5, 3, 0.75, 12));
});
test("bottom slot: the shortest fold tunes a little above the longest straight run, as the 2D flow says", () => {
  // At the straight run's end the mouth is a slot height from the back wall; the shortest fold is 4 in or so longer
  // but its sharp bend takes some back, and its mouth opens wide under the lid, so its effective length is within about
  // an inch of the longest straight slot's in these boxes (tests/slot-flow.ts), and with the rear wall's wood and the
  // duct's own air off the box it tunes 0.4–1.2 Hz higher.
  const cases: [Dims3, number][] = [
    [{ w: 22, h: 30, d: 20 }, 3],
    [{ w: 21, h: 37, d: 18 }, 3],
    [{ w: 24, h: 24, d: 24 }, 4],
    [{ w: 20, h: 20, d: 16 }, 2.5],
  ];
  for (const [box, slotH] of cases) {
    const at = (len: number) =>
      paSubBuild(
        paSubBox(box, "slots", { slotH, len }, { sub: SUB_OPTIONS[0].id, wall: 0.75, inset: 0.75 }),
      );
    const straight = at(maxStraightSlotIn(box, slotH, 0.75)),
      fold = at(minFoldedSlotIn(box, 0.75));
    /** whether a build's cutlist folds its slot up the back wall */
    const folds = (g: typeof straight) => g.parts().some((p) => p.part === "ductRearWall");
    assert.ok(!folds(straight) && folds(fold));
    /** the tuning of a build's net air with its vent, Hz */
    const fbOf = (g: typeof straight) =>
      g.vent ? engineFb(g.netL, g.vent.areaIn2, g.vent.lenIn + g.vent.endCorrectionIn) : NaN;
    const step = fbOf(fold) - fbOf(straight);
    assert.ok(step > 0.3 && step < 3, `${box.h}: ${fbOf(straight)} -> ${fbOf(fold)} Hz`);
  }
});

test("short, wide slots still model: the engine keeps the rule's effective length, so Fb is Helmholtz's", (t) => {
  const start = templateSpeaker(SPEAKER_TEMPLATE.monitorCoax);
  const [chamber] = start.cabinet.chambers;
  assert.ok(chamber.vent.kind === VENT_KIND.vented, "a vented template");
  const { vent: ported } = chamber;
  const wall = start.cabinet.panel.thicknessIn;
  /** the chamber's air, L, that puts Helmholtz's tuning of a vent at 30 Hz: low, where the exit's load is a mass */
  const litersAt30 = (areaIn2: number, effectiveIn: number) =>
    100 * Math.pow(helmholtzFb(100, areaIn2, effectiveIn) / 30, 2);
  // `n` openings `h` high, running `w` (the clear face), `len` long: short beside a round exit's own end correction
  for (const { n, h, w, len } of [
    { n: 4, h: 1, w: 30, len: 0.5 },
    { n: 1, h: 1, w: 30, len: 0.5 },
    { n: 1, h: 2, w: 30, len: 1 },
    { n: 1, h: 3, w: 20, len: 0.5 },
  ]) {
    const name = `${n} × ${h} × ${w} in, ${len} in long`;
    // the bare vent: its length and its opening's flanged end correction only, shorter than the round exit's own
    const areaIn2 = n * h * w;
    const bareIn = len + rectangleEndCorrection(h, w);
    const bare = portOfEffectiveLength(areaIn2 * CM2_PER_IN2, bareIn * CM_PER_IN);
    assert.ok(bare.length > 0 && bare.exitReactanceRatio !== undefined, `${name}: a short duct`);
    const bareLiters = litersAt30(areaIn2, bareIn);
    rel(t, engineFb(bareLiters, areaIn2, bareIn), 30, 0.005, `${name}, bare`);
    // the same slot in a chamber whose clear face it runs: the chamber models, at the rule's effective length
    const slotChamber: SpeakerChamber = {
      ...chamber,
      dims: { ...chamber.dims, w: w + 2 * wall, h: Math.max(chamber.dims.h, n * h + 6) },
      vent: { ...ported, port: { shape: PORT_SHAPE.slot, n, h, len } },
    };
    const spec: SpeakerSpec = { ...start, cabinet: { ...start.cabinet, chambers: [slotChamber] } };
    const vent = chamberVentModel(spec.cabinet, slotChamber);
    assert.ok(vent && chamberHornPort(spec.cabinet, slotChamber), `${name}: a port`);
    const effectiveIn = vent.lenIn + vent.endCorrectionIn;
    rel(t, engineFb(litersAt30(areaIn2, effectiveIn), areaIn2, effectiveIn), 30, 0.005, name);
    assert.ok(speakerResponse(spec).chambers[0].fb !== null, `${name}: the chamber models`);
  }
});
