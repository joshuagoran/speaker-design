import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  rectangleEndCorrectionIntegral,
  rectangleEndCorrection,
  sideDuctEndCorrection,
  ductEndCorrection,
  ductEndCorrection2D,
  BOTH_ENDS_CORRECTION_RATIO,
  ventGeometry,
  boxModel,
  subSystem,
  slotMouthCorrection,
  subGeometry,
  maxStraightSlotIn,
  minFoldedSlotIn,
} from "../src/lib/pa/calc";
import { SHARP_BEND_CORRECTION } from "../src/data/acoustics/slot-inner-end";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import type { SubSystemConfig } from "../src/types";
import { C, rel, close, vent } from "./helpers";
import { RETIRED_FOLDED_PORT_STYLE, savedPortStyle } from "../src/constants/portStyles";

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
    g = ventGeometry("slots", box, vent({ slotH: 3, len: 14 }), 0.75);
  const W = box.w - 1.5 - 1.5;
  // outside, the floor mirrors the mouth (a slot twice as tall); inside, its mouth on the floor, the back wall behind
  close(
    t,
    g.ec!,
    rectangleEndCorrection(6, W) + slotMouthCorrection(3, 30 - 1.5, 20 - 0.75 - 0.75 - 14, 0.75),
    1e-12,
  );
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;
  const m = boxModel(ts, 120, g.area, g.len, 25, 20, "BW24", { ecIn: g.ec })!;
  const Sp = g.area * 0.00064516,
    Leff = (14 + g.ec!) * 0.0254;
  rel(t, m.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / (0.12 * Leff)), 1e-9);
});
test("round tubes keep 1.46 r per opening", (t) => {
  assert.equal(
    ventGeometry("round2", { w: 22, h: 30, d: 20 }, vent({ nt: 2, dia: 4, len: 12 }), 0.75).ec,
    undefined,
  );
});
test("side duct: side wall mirrors the inner end only", (t) => {
  const f = 0.61 / 0.85;
  close(
    t,
    sideDuctEndCorrection(2, 27.5),
    rectangleEndCorrection(2, 27.5) + f * rectangleEndCorrection(4, 27.5),
    1e-12,
  );
  // between no mirrors and both mirrored
  assert.ok(
    sideDuctEndCorrection(2, 27.5) > BOTH_ENDS_CORRECTION_RATIO * rectangleEndCorrection(2, 27.5) &&
      sideDuctEndCorrection(2, 27.5) < ductEndCorrection(2, 27.5),
  );
});
test("side ducts: each opening gets the correction for its own throat x open height", (t) => {
  const box = { w: 22, h: 30, d: 20 };
  for (const st of ["vslots", "vslot1"] as const) {
    const g = ventGeometry(st, box, vent({ throat: 2, len: 12 }), 0.75);
    close(
      t,
      g.ec!,
      sideDuctEndCorrection(
        2,
        30 - 1.5 - 1,
        st === "vslots" ? (22 - 1.5) / 2 : 22 - 1.5,
        20 - 0.75 - 0.75 - 12,
      ),
      1e-12,
      st,
    );
  }
  // per-opening: two ducts tune like one duct in the mirrored half of the box
  const ts = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;
  // the mirror image of one half: half the inner width, half the volume
  const half = { ...box, w: (box.w - 1.5) / 2 + 1.5 };
  const two = ventGeometry("vslots", box, vent({ throat: 2, len: 12 }), 0.75),
    one = ventGeometry("vslot1", half, vent({ throat: 2, len: 12 }), 0.75);
  const a = boxModel(ts, 120, two.area, 12, 25, 20, "BW24", { nPorts: 2, ecIn: two.ec })!;
  const b = boxModel(ts, 60, one.area, 12, 25, 20, "BW24", { nPorts: 1, ecIn: one.ec })!;
  rel(t, a.Fb, b.Fb, 1e-9);
});
test("subSystem passes the slot end correction to the model", (t) => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500")!,
    mid = MID_OPTIONS[0];
  const cfg: SubSystemConfig = {
    subBox: { w: 22, h: 30, d: 22 },
    midDims: { w: 15, h: 15, d: 15 },
    wall: 0.75,
    inset: 0.75,
    portStyle: "slots",
    cVent: vent({ slotH: 3, len: 14 }),
    hpf: 30,
    hpType: "BW24",
    ampW: 800,
    portMax: 20,
    layout: "stack",
  };
  const s = subSystem(sub, mid, cfg);
  const Sp = s.port.area * 0.00064516,
    Leff = (s.port.len + s.port.ec!) * 0.0254;
  rel(t, s.mdl!.Fb, (C / (2 * Math.PI)) * Math.sqrt(Sp / ((s.netL / 1000) * Leff)), 1e-9);
});

// ---- inner end: the box interior as a duct ----
const FE = 0.61 / 0.85;
test("duct2D: a mouth filling the whole duct has no end correction", (t) =>
  close(t, ductEndCorrection2D(5, 5), 0, 1e-12));
test("duct2D: grows with the box like a free strip with the floor mirrored (slope 2h/pi per e-fold)", (t) => {
  // independent: the closed-form rectangle integral for a long strip of height 2h
  const dDuct = ductEndCorrection2D(1, 400) - ductEndCorrection2D(1, 200),
    dStrip = rectangleEndCorrection(2, 400) - rectangleEndCorrection(2, 200);
  close(t, dDuct, dStrip, 0.002);
  close(t, dDuct, (2 / Math.PI) * Math.log(2), 0.002);
});
test("duct2D: a back wall adds mass; far away it has no effect; closer than h is clamped to h", (t) => {
  const free = ductEndCorrection2D(3, 30);
  assert.ok(ductEndCorrection2D(3, 30, 6) > free);
  close(t, ductEndCorrection2D(3, 30, 500), free, 1e-9);
  close(t, ductEndCorrection2D(3, 30, 1), ductEndCorrection2D(3, 30, 3), 1e-12);
});
test("duct2D: two ducts on opposite walls = one duct in half the width (symmetry, computed directly)", (t) => {
  // direct modal sum for the pair: odd modes cancel, even modes double
  const h = 2,
    X = 26,
    pair = (() => {
      let s = 0;
      for (let m = 1; m <= 4000; m++) {
        const c = Math.sin((m * Math.PI * h) / X) * (1 + (-1) ** m);
        s += (c * c) / m ** 3;
      }
      return ((X * X) / (Math.PI ** 3 * h)) * s;
    })();
  close(t, ductEndCorrection2D(h, X / 2), pair, 1e-3);
});
test("side duct: outer end mirrored by the ground along its height", (t) => {
  close(
    t,
    sideDuctEndCorrection(2, 29, 13, 8),
    rectangleEndCorrection(2, 58) + FE * ductEndCorrection2D(2, 13, 8),
    1e-12,
  );
});
test("bottom slot: straight while it fits, folded past that (a sharp bend, and its mouth under the lid)", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    outer = rectangleEndCorrection(6, 19);
  // the straight run holds d - t - slotH = 16.25; its mouth is 20 - 0.75 - 0.75 - 16.25 = 2.25 from the back wall
  const straight = ventGeometry("slots", box, vent({ slotH: 3, len: 16.25 }), 0.75);
  close(t, straight.ec ?? NaN, outer + slotMouthCorrection(3, 28.5, 2.25, 0.75), 1e-12);
  assert.ok(!straight.desc.includes("folded"));
  // folded 20 long: the rear wall would rise 20 - 19.25 = 0.75, held at the least 1, so the mouth is 28.5 - 3 - 1 under
  // the lid, the box's inside depth (20 - 0.75 - 0.75) across it
  const folded = ventGeometry("slots", box, vent({ slotH: 3, len: 20 }), 0.75);
  close(
    t,
    folded.ec ?? NaN,
    outer + SHARP_BEND_CORRECTION * 3 + slotMouthCorrection(3, 18.5, 24.5, 0.75),
    1e-12,
  );
  assert.ok(folded.desc.includes("folded"));
  // folded as far as it goes: the mouth a slot height under the lid
  const top = ventGeometry("slots", box, vent({ slotH: 3, len: 50 }), 0.75);
  close(
    t,
    top.ec ?? NaN,
    outer + SHARP_BEND_CORRECTION * 3 + slotMouthCorrection(3, 18.5, 3, 0.75),
    1e-12,
  );
});
test("slot mouth: a nearer facing wall always adds (no flat stretch over the last inch), a thicker shelf adds", () => {
  let prev = 0;
  for (const gap of [24, 12, 6, 4, 3, 2.25, 1.5, 1, 0.75]) {
    const ec = slotMouthCorrection(3, 28.5, gap, 0.75);
    assert.ok(ec > prev, `gap ${gap}: ${ec}`);
    prev = ec;
  }
  assert.ok(slotMouthCorrection(3, 28.5, 3, 1.5) > slotMouthCorrection(3, 28.5, 3, 0.75));
});
test("bottom slot: the shortest fold tunes a little above the longest straight run, as the 2D flow says", () => {
  // At the straight run's end the mouth is under a slot height from the back wall, and squeezing through that gap adds
  // more mass than the shortest fold's open rear channel; solved directly in 2D (tests/slot-flow.ts) the shortest fold's
  // effective length is 1.4–2.7 in under the longest straight slot's in these boxes, so it tunes 1–2 Hz higher.
  const cases: [SubSystemConfig["subBox"], number][] = [
    [{ w: 22, h: 30, d: 20 }, 3],
    [{ w: 21, h: 37, d: 18 }, 3],
    [{ w: 24, h: 24, d: 24 }, 4],
    [{ w: 20, h: 20, d: 16 }, 2.5],
  ];
  for (const [box, slotH] of cases) {
    const at = (len: number) =>
      subGeometry(SUB_OPTIONS[0], MID_OPTIONS[0], {
        subBox: box,
        midDims: { w: 15, h: 15, d: 15 },
        wall: 0.75,
        inset: 0.75,
        portStyle: "slots",
        cVent: vent({ slotH, len }),
        layout: "stack",
      });
    const straight = at(maxStraightSlotIn(box, slotH, 0.75)),
      fold = at(minFoldedSlotIn(box, 0.75));
    assert.ok(!straight.port.desc.includes("folded") && fold.port.desc.includes("folded"));
    const step = fold.Fb - straight.Fb;
    assert.ok(step > 0.3 && step < 3, `${box.h}: ${straight.Fb} -> ${fold.Fb} Hz`);
  }
});
test("saved designs with the retired folded layout load as the bottom slot", () => {
  assert.equal(savedPortStyle(RETIRED_FOLDED_PORT_STYLE), "slots");
  assert.equal(savedPortStyle("vslots"), "vslots");
});
