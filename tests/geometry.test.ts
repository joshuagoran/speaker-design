import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  boxInternalLiters,
  ventGeometry,
  internalWoodLiters,
  cutParts,
  subWeightLb,
  midWeightLb,
  plywoodLbPerSqFt,
  subBoxBracing,
  midBoxBracing,
  maxFoldedRearWallIn,
  maxFoldedSlotIn,
  foldedRearWallIn,
  foldedLidGapIn,
  ductDividerIn,
  subGeometry,
  ventTuning,
  braceWoodEstimate,
  braceWoodIn3,
} from "../src/lib/pa/calc";
import { defaultBraceStyleNear } from "../src/lib/bracing";
import { DEFAULT_PA } from "../src/lib/defaults";
import { ductFit } from "../src/lib/pa/chips";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import { close, vent, DRV18 } from "./helpers";
import { subWoodIn3, ventShape } from "../src/lib/pa/exactSub";
import type { CutPart, CutPartId } from "../src/types";

const IN3_L = 16.387 / 1000;
test("boxL: inner width/height lose two walls, depth loses inset + 3/4 baffle + back", (t) => {
  close(t, boxInternalLiters(20, 24, 16, 0.75, 0.75), 18.5 * 22.5 * 13.75 * IN3_L, 1e-9);
  close(t, boxInternalLiters(20, 24, 16, 0.5, 0), 19 * 23 * 14.75 * IN3_L, 1e-9);
  close(t, boxInternalLiters(20, 24, 16, 0.5, 1.5), 19 * 23 * 13.25 * IN3_L, 1e-9);
});
test("ventGeom: letterbox area = slot height x inner width less two fins", (t) => {
  const g = ventGeometry(
    "slots",
    { w: 22, h: 30, d: 20 },
    vent({ slotH: 3, len: 14 }),
    0.75,
    DRV18,
  );
  close(t, g.area, 3 * (22 - 1.5 - 1.5), 1e-9);
  assert.equal(g.n, 1);
});
test("ventGeom: side ducts = throat x inner height less dividers, one opening each", (t) => {
  const g2 = ventGeometry(
    "vslots",
    { w: 22, h: 30, d: 20 },
    vent({ throat: 2, len: 16 }),
    0.75,
    DRV18,
  );
  close(t, g2.area, 2 * 2 * (28.5 - 1), 1e-9);
  assert.equal(g2.n, 2);
  assert.equal(
    ventGeometry("vslot1", { w: 22, h: 30, d: 20 }, vent({ throat: 2, len: 16 }), 0.75, DRV18).n,
    1,
  );
});
test("ventGeom: round tubes = n circles, n openings", (t) => {
  const g = ventGeometry(
    "round2",
    { w: 20, h: 24, d: 16 },
    vent({ nt: 2, dia: 3.5, len: 14 }),
    0.75,
    DRV18,
  );
  close(t, g.area, 2 * Math.PI * 1.75 ** 2, 1e-9);
  assert.equal(g.n, 2);
});
test("internalWoodL: duct shelf + fins + brace rails + cleats, by hand", (t) => {
  const sub = SUB_OPTIONS[0],
    mid = MID_OPTIONS[0];
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75;
  const parts = cutParts({
    sub,
    mid,
    subBox: box,
    midDims: { w: 15, h: 15, d: 15 },
    wall: t0,
    inset: 0.75,
    joint: "butt",
    portStyle: "slots",
    cVent: vent({ slotH: 3, len: 14 }),
    layout: "stack",
  }).parts;
  const iw = 20.5,
    ih = 28.5,
    band = 3.75,
    inD = 20 - 0.75 - 0.75 - 0.75,
    len = Math.min(14, 20 - 0.75 - 3);
  const cleats = 0.75 * 0.75 * (2 * iw + 2 * (ih - band - 1.5));
  // the braces the rule put in: a window brace's 2″ rails round its cut-out center, a rib's whole strip
  const braceRows = parts.filter((p) => p.part === "windowBrace" || p.part === "rib");
  assert.ok(braceRows.length, "the rule braces this box");
  const braces = braceRows.reduce(
    (a, p) => a + (p.part === "rib" ? p.a * p.b : p.a * p.b - (p.a - 4) * (p.b - 4)) * p.t * p.qty,
    0,
  );
  // each frame spans two of the inside's sides
  const spans = [iw, ih, inD];
  assert.ok(
    braceRows.every(
      (p) => p.part === "rib" || (spans.includes(p.a) && spans.includes(p.b) && p.a !== p.b),
    ),
    "frames across the inside",
  );
  const duct = iw * len * t0 + 2 * 3 * len * t0;
  close(t, internalWoodLiters(parts, "sub"), (cleats + braces + duct) * IN3_L, 1e-9);
});
test("folded slot: the rear wall makes the centerline the set length, and the searches' wood volume matches the cutlist", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75,
    cVent = vent({ slotH: 3, len: 26 });
  const parts = cutParts({
    sub: SUB_OPTIONS[0],
    mid: MID_OPTIONS[0],
    subBox: box,
    midDims: { w: 15, h: 15, d: 15 },
    wall: t0,
    inset: 0.75,
    joint: "butt",
    portStyle: "slots",
    cVent,
    layout: "stack",
  }).parts;
  const part = (id: CutPartId) => parts.find((p) => p.box === "sub" && p.part === id);
  // floor shelf from the baffle front to the rear channel's wall, as a straight slot's shelf runs: the longest straight
  // run less the wall, 20 - 0.75 - 3 - 0.75 = 15.5
  close(t, part("ductShelf")?.b ?? NaN, 15.5, 1e-12);
  // centerline: the floor run to the channel's middle (20 - 0.75 - 1.5 = 17.75), then 1.5 up to the roof and the wall
  // above it, so the wall is 26 - 17.75 - 1.5 = 6.75
  close(t, part("ductRearWall")?.b ?? NaN, 6.75, 1e-12);
  // the searches count the braces by estimate: the cutlist's other wood, and that
  const bare = cutParts({
    sub: SUB_OPTIONS[0],
    mid: MID_OPTIONS[0],
    subBox: box,
    midDims: { w: 15, h: 15, d: 15 },
    wall: t0,
    inset: 0.75,
    joint: "butt",
    portStyle: "slots",
    cVent,
    layout: "stack",
    noBraces: true,
  }).parts;
  const est = braceWoodIn3(braceWoodEstimate(box, t0, 0.75, defaultBraceStyleNear(t0)));
  close(
    t,
    subWoodIn3("slots", box, t0, 0.75, cVent, undefined) * IN3_L,
    internalWoodLiters(bare, "sub") + est * IN3_L,
    1e-12,
  );
});
test("folded slot: the longest fold leaves a slot height under the lid, in the fit, the model and the cutlist", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    t0 = 0.75,
    slotH = 3;
  // the wall rises at most h - 2t - 2 slotH = 22.5 over the floor leg's roof (at t + slotH), so the mouth sits at
  // 0.75 + 3 + 22.5 = 26.25, a slot height under the lid's inside face (30 - 0.75)
  close(t, maxFoldedRearWallIn(box, slotH, t0), 22.5, 1e-12);
  const longest = maxFoldedSlotIn(box, slotH, t0);
  close(t, longest, 20 - 0.75 + 22.5, 1e-12);
  close(t, ductFit(box, "slots", vent({ slotH, len: 0 }), t0, DRV18).maxFold, longest, 1e-12);
  for (const len of [longest, longest + 5]) {
    const v = vent({ slotH, len });
    close(t, foldedRearWallIn(box, v, t0), 22.5, 1e-12);
    close(t, foldedLidGapIn(box, v, t0), slotH, 1e-12);
    const parts = cutParts({
      sub: SUB_OPTIONS[0],
      mid: MID_OPTIONS[0],
      subBox: box,
      midDims: { w: 15, h: 15, d: 15 },
      wall: t0,
      inset: 0.75,
      joint: "butt",
      portStyle: "slots",
      cVent: v,
      layout: "stack",
    }).parts;
    close(t, parts.find((p) => p.part === "ductRearWall")?.b ?? NaN, 22.5, 1e-12);
  }
});
test("weights: shell from panel areas at the ply density matches the cutlist parts", (t) => {
  // independent: sum the cutlist panels (butt joints), + driver + hardware; formula counts full outer
  // faces and full-size braces, so it should read a little high, never low, and within ~12 %
  for (const wall of [0.75, 0.5]) {
    const box = { w: 22, h: 30, d: 20 };
    const parts = cutParts({
      sub: SUB_OPTIONS[0],
      mid: MID_OPTIONS[0],
      subBox: box,
      midDims: { w: 15, h: 15, d: 15 },
      wall,
      inset: 0.75,
      joint: "butt",
      portStyle: "round2",
      cVent: vent({ nt: 2, dia: 4, len: 12 }),
      layout: "stack",
    }).parts.filter((p) => p.box === "sub");
    // a window brace weighs its rails only (its center is cut out)
    const area = (p: CutPart) =>
      p.part === "windowBrace" ? p.a * p.b - (p.a - 4) * (p.b - 4) : p.a * p.b;
    const lb = parts.reduce((a, p) => a + ((area(p) * p.qty) / 144) * plywoodLbPerSqFt(p.t), 0) + 6;
    const w = subWeightLb(
      box,
      wall,
      0,
      subBoxBracing(
        box,
        wall,
        0.75,
        "round2",
        vent({ nt: 2, dia: 4, len: 12 }),
        SUB_OPTIONS[0],
        undefined,
      ),
    );
    assert.ok(
      w >= lb * 0.98 && w <= lb * 1.12,
      `wall ${wall}: formula ${w.toFixed(1)} vs parts ${lb.toFixed(1)}`,
    );
  }
});
test("plyLb: the catalog's sizes, and measured thicknesses between and beyond them", (t) => {
  assert.equal(plywoodLbPerSqFt(0.75), 2.3);
  assert.equal(plywoodLbPerSqFt(0.625), 1.95);
  assert.equal(plywoodLbPerSqFt(0.5), 1.6);
  // 18 mm birch measured at 0.689″: between the 5/8″ and 3/4″ weights
  close(t, plywoodLbPerSqFt(0.689), 1.95 + (0.35 * (0.689 - 0.625)) / 0.125, 1e-9);
  // beyond the thinnest and thickest sizes: in proportion to the nearest
  close(t, plywoodLbPerSqFt(0.45), (1.6 * 0.45) / 0.5, 1e-9);
  close(t, plywoodLbPerSqFt(0.8), (2.3 * 0.8) / 0.75, 1e-9);
});
test("midWeight: 15 in cube in 3/4 birch", (t) => {
  close(
    t,
    midWeightLb(
      { w: 15, h: 15, d: 15 },
      0.75,
      midBoxBracing({ w: 15, h: 15, d: 15 }, 0.75, 0.75, MID_OPTIONS[0], "stack", undefined),
    ),
    // a 15″ cube in 3/4″ ply needs no braces: every panel clears the target as it is
    (225 * 2.3 + (225 + 450 + 450) * 2.3) / 144 + 2,
    1e-9,
  );
});
test("duct dividers: a thicker divider comes out of the side ducts' open area, not the net volume", (t) => {
  const box = { w: 22, h: 30, d: 20 },
    n = 2,
    throat = 2,
    len = 16,
    wall = 0.75,
    inset = 0.75,
    grow = 0.25; // ½″ to ¾″
  const cVent = (div?: number) => vent(div === undefined ? { throat, len } : { throat, len, div });
  const geometry = (div?: number) =>
    subGeometry(DEFAULT_PA.sub, DEFAULT_PA.mid, {
      subBox: box,
      midDims: DEFAULT_PA.mDim,
      wall,
      inset,
      portStyle: "vslots",
      cVent: cVent(div),
      layout: DEFAULT_PA.layout,
    });
  const half = geometry(),
    threeQ = geometry(0.75);
  // two dividers per duct, each a quarter inch thicker: each duct's open height loses half an inch
  close(t, half.port.area - threeQ.port.area, n * throat * 2 * grow, 1e-9);
  // the dividers sit inside the duct, so the wood they add is the air the duct loses: the net volume holds
  const moved = n * 2 * throat * len * grow * IN3_L;
  close(t, threeQ.woodL - half.woodL, moved, 1e-9);
  close(t, half.ductL - threeQ.ductL, moved, 1e-9);
  close(t, threeQ.netL, half.netL, 1e-9);
  // the exact sub model agrees: the same area and the same extra wood
  close(t, ventShape("vslots", box, cVent(0.75), wall, DRV18).area, threeQ.port.area, 1e-9);
  close(
    t,
    subWoodIn3("vslots", box, wall, inset, cVent(0.75), undefined) -
      subWoodIn3("vslots", box, wall, inset, cVent(), undefined),
    n * 2 * throat * len * grow,
    1e-9,
  );
  // the smaller vent tunes lower in the same box
  const fb = (g: typeof half) => ventTuning(g.netL, g.port.area, len, n, g.port.ec).Fb;
  assert.ok(fb(threeQ) < fb(half));
  // the cutlist cuts them at that thickness
  const { parts } = cutParts({
    sub: DEFAULT_PA.sub,
    mid: DEFAULT_PA.mid,
    subBox: box,
    midDims: DEFAULT_PA.mDim,
    wall,
    inset,
    joint: "butt",
    portStyle: "vslots",
    cVent: cVent(0.75),
    layout: DEFAULT_PA.layout,
  });
  assert.deepEqual(
    parts.filter((p) => p.part === "ductDivider").map((p) => [p.qty, p.t]),
    [[2 * n, 0.75]],
  );
  // a vent without a divider thickness (saves from before the choice) is at ½″
  assert.equal(ductDividerIn({}), 0.5);
});
