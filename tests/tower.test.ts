// The tower layout's cabinet: the cutlist, the weight and the cards' front view all built from towerSpec, the same
// geometry the 3D view builds the tower from.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  cutParts,
  midWeightLb,
  plywoodLbPerSqFt,
  towerMidWeightLb,
  MID_FIXINGS_LB,
  DRIVER_CUTOUT_IN,
  formatInches,
  boxInternalLiters,
  heaviestLiftLb,
  midGrossLiters,
  subLiftLb,
  towerUpperLoadedLb,
} from "../src/lib/pa/calc";
import { towerHornCutout, towerMidDims, towerSpec } from "../src/lib/pa/tower";
import { boxGeometry, evaluateDesign } from "../src/lib/pa/optimize";
import { TOWER_MID_HEIGHT_IN } from "../src/constants/paLayouts";
import {
  BACK_JOINT_CUT_NOTES,
  BACK_JOINT_PARTITION_NOTES,
  BACK_JOINT_RAIL_NOTES,
  BACK_JOINT_SUMMARY,
  DEFAULT_BACK_JOINT,
  GLUED_BACK,
} from "../src/constants/bracing";
import { CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { BoxFront } from "../src/components/drawings/BoxFront";
import { close, vent } from "./helpers";
import { DEFAULT_PA } from "../src/lib/defaults";
import { HORN_MESHES } from "../src/data/meshes";
import { MESHED_HORN_IDS } from "../src/data/meshes/meshedHorns";
import { MM_IN } from "../src/components/stack-view/geometry";
import type {
  BackJointId,
  CornerJoint,
  CutPart,
  CutPartId,
  PaDesignConfig,
  Dims3,
  Horn,
  PortStyle,
  VentSpec,
} from "../src/types";

const horn = (id: string): Horn => {
  const h = HORN_OPTIONS.find((o) => o.id === id);
  assert.ok(h, id);
  return h;
};
// a horn with no profile (a flat top) and a round one narrower than the cabinet (the arched top)
const FLAT = horn("me75"),
  ROUND = horn("a460g2_14");
const SUB = SUB_OPTIONS[0],
  MID = MID_OPTIONS[0];
const BOX: Dims3 = { w: 24, h: 32, d: 20 },
  T = 0.75,
  INSET = 0.75;
const SLOTS = vent({ slotH: 3.5, len: 17, nt: 2, dia: 6, throat: 3.25 });

const parts = (
  layout: "tower" | "stack",
  h: Horn,
  joint: CornerJoint = "butt",
  portStyle: PortStyle = "slots",
  cVent: VentSpec = SLOTS,
  backJoint?: BackJointId,
) =>
  cutParts({
    sub: SUB,
    mid: MID,
    subBox: BOX,
    midDims: towerMidDims(BOX),
    wall: T,
    inset: INSET,
    joint,
    portStyle,
    cVent,
    layout,
    backJoint,
    horn: h,
  }).parts;
const one = (P: CutPart[], id: CutPartId) => {
  const rows = P.filter((p) => p.part === id);
  assert.equal(rows.length, 1, `one ${id} row`);
  return rows[0];
};
/** The default design as the planner saves it, as a tower in BOX with the round horn. */
const towerConfig = (): PaDesignConfig => {
  const { midSize: _m, plywoodSheetKind: _k, boxSetCount: _n, ...rest } = DEFAULT_PA;
  return {
    ...rest,
    format: DEFAULT_PA.format.id,
    cabinet: DEFAULT_PA.cabinet.id,
    sub: DEFAULT_PA.sub.id,
    mid: DEFAULT_PA.mid.id,
    midBox: DEFAULT_PA.midBox.id,
    cd: DEFAULT_PA.cd.id,
    horn: ROUND.id,
    cDim: BOX,
    wall: T,
    inset: INSET,
    layout: "tower",
  };
};
const area = (P: CutPart[]) => P.reduce((a, p) => a + p.a * p.b * p.qty, 0);

test("towerMidDims: the sub's footprint, the mid chamber's height", () => {
  assert.deepEqual(towerMidDims(BOX), { w: 24, h: TOWER_MID_HEIGHT_IN, d: 20 });
});

test("towerSpec: the arched top only for a round horn narrower than the cabinet; heights add up", (t) => {
  const flat = towerSpec(BOX, T, FLAT),
    arch = towerSpec(BOX, T, ROUND);
  assert.equal(flat.archTop, false);
  assert.equal(arch.archTop, true);
  close(t, flat.hornSectionH, FLAT.size.h + 2, 1e-12);
  close(t, arch.hornSectionH, BOX.w - T, 1e-12);
  for (const s of [flat, arch]) {
    close(t, s.height, BOX.h + TOWER_MID_HEIGHT_IN + s.hornSectionH, 1e-12);
    assert.deepEqual(s.partitions, [BOX.h, BOX.h + TOWER_MID_HEIGHT_IN]);
    close(t, s.midCenter, BOX.h + TOWER_MID_HEIGHT_IN / 2, 1e-12);
  }
  close(t, flat.hornCenter, BOX.h + TOWER_MID_HEIGHT_IN + flat.hornSectionH / 2, 1e-12);
  // arched: the horn on the arch's center, a wall below the top's radius
  close(t, arch.hornCenter, arch.height - BOX.w / 2, 1e-12);
});

test("tower cutlist: the shell at the full height, two partitions, the sub's braces and vent as in its own box", (t) => {
  const tower = parts("tower", FLAT),
    stack = parts("stack", FLAT).filter((p) => p.box === "sub");
  const spec = towerSpec(BOX, T, FLAT),
    H = spec.height,
    iw = BOX.w - 2 * T,
    inD = BOX.d - INSET - 0.75 - T,
    band = SLOTS.slotH + T;
  assert.ok(
    tower.every((p) => p.box === "sub"),
    "one cabinet: no mid box",
  );
  const side = one(tower, "side"),
    back = one(tower, "back"),
    baffle = one(tower, "baffle"),
    top = one(tower, "topBottom"),
    partition = one(tower, "partition");
  assert.deepEqual([side.qty, side.a, side.b], [2, BOX.d, H]);
  assert.deepEqual([back.a, back.b], [BOX.w - T, H - T]);
  assert.deepEqual([baffle.a, baffle.b], [iw, H - 2 * T - band]);
  assert.deepEqual([top.qty, top.a], [2, BOX.d]);
  assert.deepEqual(
    [partition.qty, partition.a, partition.b, partition.t],
    [spec.partitions.length, iw, inD, T],
  );
  assert.equal(partition.qty, 2);
  // the uprights behind the baffle run its height
  assert.ok(
    tower.some(
      (p) =>
        p.part === "baffleCleat" && p.qty === 2 && Math.abs(p.b - (H - 2 * T - band - 1.5)) < 1e-9,
    ),
    "the uprights",
  );
  // everything that isn't the shell, the partitions or the cleats is the sub box's own, unchanged
  const own = (P: CutPart[]) =>
    P.filter(
      (p) => !["side", "topBottom", "back", "baffle", "baffleCleat", "partition"].includes(p.part),
    );
  assert.deepEqual(own(tower), own(stack));
  assert.ok(own(stack).length > 0, "the slot's shelf and fins at least");
  // area: the sub box's shell and cleats, the extension over it, and the partitions
  const ext = spec.extH;
  const shellCleats = (P: CutPart[]) =>
    area(P.filter((p) => ["side", "topBottom", "back", "baffle", "baffleCleat"].includes(p.part)));
  close(
    t,
    shellCleats(tower) - shellCleats(stack),
    // sides, back, baffle and the two cleat uprights grow by the extension
    2 * BOX.d * ext + (BOX.w - T) * ext + iw * ext + 2 * 0.75 * ext,
    1e-9,
  );
  close(t, area([partition]), 2 * iw * inD, 1e-9);
});

test("tower cutlist: the baffle's mid and horn cutouts are placed up from its bottom edge, where the 3D view opens them", () => {
  const spec = towerSpec(BOX, T, FLAT);
  const note = one(parts("tower", FLAT), "baffle").note;
  const band = SLOTS.slotH + T;
  const up = (y: number) => `centered ${formatInches(y - T - band)}″ up from its bottom edge`;
  // the mid's typical cutout and the horn's mouth, each centered where towerSpec puts it
  const hc = towerHornCutout(BOX, T, FLAT);
  assert.equal(hc.shape, "rect");
  assert.ok(
    note.includes(
      `mid ${formatInches(DRIVER_CUTOUT_IN[MID.size])}″ driver cutout (typical; use the datasheet's), ${up(spec.midCenter)}`,
    ),
    note,
  );
  assert.ok(
    note.includes(
      `horn cutout ${formatInches(hc.w)}″ × ${formatInches(hc.h)}″, ${formatInches(hc.r)}″ corners, ${up(spec.hornCenter)}`,
    ),
    note,
  );
});

test("tower cutlist: the arched top is a bent strip, the sides stop at the springline, and the curves aren't guillotine cuts", (t) => {
  const P = parts("tower", ROUND, "rabbet");
  const spec = towerSpec(BOX, T, ROUND),
    R = BOX.w / 2;
  assert.ok(!P.some((p) => p.part === "topBottom"), "no flat top");
  const bottom = one(P, "bottom"),
    bent = one(P, "archTop"),
    side = one(P, "side");
  assert.equal(bottom.qty, 1);
  close(t, side.b, spec.height - R, 1e-12);
  close(t, bent.b, Math.PI * (R - T / 2), 1e-12);
  assert.equal(bent.a, BOX.d);
  assert.match(bent.note, /guillotine/);
  // the back's arch seats in a rabbet on the strip, as the straight edges' do on the sides
  assert.match(bent.note, /rabbet 3\/4 × 3\/8 on rear edge for the screwed back's arch/);
  for (const id of ["back", "baffle"] as const) assert.match(one(P, id).note, /guillotine/);
  // the side's rabbet is on its bottom edge only; the bent top sits on its square top edge
  assert.match(side.note, /the bottom edge/);
  assert.doesNotMatch(side.note, /top and bottom edges/);
  assert.equal(one(P, "partition").qty, 2);
});

test("tower cutlist: the back, its rabbets and the partitions follow the back setting", () => {
  for (const back of [DEFAULT_BACK_JOINT, GLUED_BACK] as const) {
    const P = parts("tower", ROUND, "rabbet", "slots", SLOTS, back);
    const rabbet = `on rear edge for the ${BACK_JOINT_SUMMARY[back]}`;
    assert.ok(one(P, "back").note.startsWith(BACK_JOINT_CUT_NOTES[back]), back);
    assert.ok(one(P, "archTop").note.includes(`${rabbet}'s arch`), back);
    assert.ok(one(P, "side").note.includes(rabbet), back);
    assert.ok(one(P, "partition").note.includes(BACK_JOINT_PARTITION_NOTES[back]), back);
  }
  // absent, the back is screwed (DEFAULT_BACK_JOINT)
  assert.ok(
    one(parts("tower", FLAT), "back").note.startsWith(BACK_JOINT_CUT_NOTES[DEFAULT_BACK_JOINT]),
  );
});

test("a screwed back screws into the window braces' rear rails where they meet it, in a stack's boxes and the tower", () => {
  const rail = BACK_JOINT_RAIL_NOTES[DEFAULT_BACK_JOINT];
  assert.ok(rail);
  // the default sub in ¾″, Window braces: level frames, each with a rear rail on the back
  const P = (layout: "stack" | "tower", backJoint?: BackJointId) =>
    cutParts({
      sub: DEFAULT_PA.sub,
      mid: DEFAULT_PA.mid,
      subBox: DEFAULT_PA.cDim,
      midDims: layout === "tower" ? towerMidDims(DEFAULT_PA.cDim) : DEFAULT_PA.mDim,
      wall: T,
      inset: INSET,
      joint: "butt",
      portStyle: DEFAULT_PA.portStyle,
      cVent: DEFAULT_PA.cVent,
      layout,
      braceStyle: "window",
      backJoint,
      horn: ROUND,
    }).parts;
  const backOf = (parts: CutPart[], box: CutPart["box"]) => {
    const row = parts.find((p) => p.box === box && p.part === "back");
    assert.ok(row, `${box}: a back`);
    return row.note;
  };
  for (const layout of ["stack", "tower"] as const) {
    const screwed = P(layout);
    assert.ok(
      screwed.some((p) => p.box === "sub" && p.part === "windowBrace"),
      layout,
    );
    assert.ok(backOf(screwed, "sub").includes(rail), `${layout}: ${backOf(screwed, "sub")}`);
    // a glued back takes no screws
    assert.ok(!backOf(P(layout, GLUED_BACK), "sub").includes(rail), layout);
  }
  // the stack's mid box takes no window brace: nothing to screw into
  const stack = P("stack");
  assert.ok(!stack.some((p) => p.box === "mid" && p.part === "windowBrace"));
  assert.ok(!backOf(stack, "mid").includes(rail));
});

test("a stack's cutlist has no partitions or arched top, and the sub's volume reads the sub box alone in the tower", () => {
  for (const p of parts("stack", ROUND)) assert.ok(p.part !== "partition" && p.part !== "archTop");
  const subOnly = cutParts({
    sub: SUB,
    mid: MID,
    subBox: BOX,
    midDims: towerMidDims(BOX),
    wall: T,
    inset: INSET,
    joint: "butt",
    portStyle: "slots",
    cVent: SLOTS,
    layout: "tower",
    subOnly: true,
  }).parts;
  assert.ok(subOnly.every((p) => p.part !== "partition"));
  assert.deepEqual(
    subOnly,
    parts("stack", ROUND).filter((p) => p.box === "sub"),
  );
});

test("towerMidWeightLb: the mid chamber and the horn section over the sub box, by hand", (t) => {
  const W = BOX.w,
    D = BOX.d,
    spec = towerSpec(BOX, T, FLAT),
    ext = spec.extH;
  const face = W * ext,
    cut = (Math.PI / 4) * DRIVER_CUTOUT_IN[MID.size] ** 2 + towerHornCutout(BOX, T, FLAT).area;
  const want =
    ((face + 2 * D * ext + W * D + (W - 2 * T) * (D - INSET - 0.75 - T)) * plywoodLbPerSqFt(T) +
      (face - cut) * 2.3) /
      144 +
    MID_FIXINGS_LB;
  close(t, towerMidWeightLb(BOX, T, INSET, FLAT, MID), want, 1e-9);
  // more than the mid chamber alone as a box (the horn section), and the arched top weighs less than a flat one as tall
  assert.ok(towerMidWeightLb(BOX, T, INSET, FLAT, MID) > midWeightLb(towerMidDims(BOX), T, null));
  assert.ok(towerMidWeightLb(BOX, T, INSET, ROUND, MID) > midWeightLb(towerMidDims(BOX), T, null));
});

test("towerMidWeightLb: within a few percent of the tower's cut panels over the sub box, less its cutouts", () => {
  for (const h of [FLAT, ROUND]) {
    const P = parts(
      "tower",
      h,
      "butt",
      "round2",
      vent({ nt: 2, dia: 4, len: 12, slotH: 3, throat: 2 }),
    );
    const S = parts(
      "stack",
      h,
      "butt",
      "round2",
      vent({ nt: 2, dia: 4, len: 12, slotH: 3, throat: 2 }),
    ).filter((p) => p.box === "sub");
    const shell = ["side", "topBottom", "bottom", "back", "baffle", "partition", "archTop"];
    const lb = (Q: CutPart[]) =>
      Q.filter((p) => shell.includes(p.part)).reduce(
        (a, p) => a + ((p.a * p.b * p.qty) / 144) * plywoodLbPerSqFt(p.t),
        0,
      );
    const cut = (Math.PI / 4) * DRIVER_CUTOUT_IN[MID.size] ** 2 + towerHornCutout(BOX, T, h).area;
    // the tower's panels less the sub box's (whose top stands for the sub/mid partition), and its cutouts out of the
    // baffle: what the cabinet adds over the sub box
    const added = lb(P) - lb(S) - (cut * 2.3) / 144;
    const w = towerMidWeightLb(BOX, T, INSET, h, MID) - MID_FIXINGS_LB;
    assert.ok(
      w >= added * 0.95 && w <= added * 1.15,
      `${h.id}: formula ${w.toFixed(1)} vs parts ${added.toFixed(1)}`,
    );
  }
});

test("BoxFront: the tower as one cabinet, the partitions at towerSpec's heights, the arched top drawn", () => {
  const g = boxGeometry(towerConfig());
  assert.deepEqual(g.tower, towerSpec(BOX, T, ROUND));
  assert.deepEqual(g.mid, towerMidDims(BOX));
  assert.ok(g.tower?.archTop, "the round horn arches the top");
  const svg = renderToString(createElement(BoxFront, { g }));
  // one line per partition, and the outline's arc
  assert.equal(svg.match(/<line /g)?.length, g.tower.partitions.length);
  assert.match(svg, /<path d="M[^"]*A/);
  // the drawing's scale fits the whole tower: the outline spans the height the 3D view builds
  assert.ok(svg.includes(`tower ${g.sub.w} × ${Math.round(g.tower.height * 10) / 10}″`), svg);
  // a stack has neither
  const stack = renderToString(createElement(BoxFront, { g: { ...g, tower: null } }));
  assert.equal(stack.match(/<line /g), null);
});

test("the meshed horns' light list matches the meshes, and each mesh is its horn's catalog size", (t) => {
  assert.deepEqual([...MESHED_HORN_IDS].sort(), Object.keys(HORN_MESHES).sort());
  for (const id of MESHED_HORN_IDS) {
    const m = HORN_MESHES[id],
      h = horn(id);
    assert.ok(m, id);
    close(t, (m.max[0] - m.min[0]) * MM_IN, h.size.w, 0.01);
    close(t, (m.max[1] - m.min[1]) * MM_IN, h.size.h, 0.01);
  }
});

test("the tower's mid chamber: modeled at its clear height as built, between the partitions", (t) => {
  const spec = towerSpec(BOX, T, FLAT);
  const clear = spec.partitions[1] - spec.partitions[0] - T;
  close(t, clear, TOWER_MID_HEIGHT_IN - T, 1e-12);
  close(
    t,
    midGrossLiters(towerMidDims(BOX), T, INSET, "tower"),
    ((BOX.w - 2 * T) * clear * (BOX.d - INSET - 0.75 - T) * 16.387) / 1000,
    1e-9,
  );
  // a mid box elsewhere loses two walls, as before
  const box = { w: 15, h: 15, d: 15 };
  assert.equal(midGrossLiters(box, T, INSET, "stack"), boxInternalLiters(15, 15, 15, T, INSET));
});

test("the heaviest lift: the heavier box, or in the tower the whole cabinet", () => {
  assert.equal(heaviestLiftLb("stack", 80, 30), 80);
  assert.equal(heaviestLiftLb("pole", 20, 30), 30);
  assert.equal(heaviestLiftLb("tower", 80, 60), 140);
  assert.equal(subLiftLb("stack", 80, 60), 80);
  assert.equal(subLiftLb("tower", 80, 60), 140);
  // the optimizers' numbers for a tower: the cabinet over the sub as carried, and the whole tower as the lift
  const c = towerConfig();
  const m = evaluateDesign(c);
  assert.ok(m, "the tower evaluates");
  const mid = MID_OPTIONS.find((o) => o.id === c.mid),
    cd = CD_OPTIONS.find((o) => o.id === c.cd);
  assert.ok(mid && cd);
  close({}, m.midLb, towerUpperLoadedLb(BOX, T, INSET, ROUND, mid, cd), 1e-9);
  close({}, m.heaviest, m.subLb + m.midLb, 1e-9);
  const sub = m.chips.sub.find(([, , , id]) => id === "subWeight");
  assert.ok(sub, "the lift chip");
  assert.ok(sub[2].startsWith(`${m.heaviest.toFixed(0)} lb loaded`), sub[2]);
});
