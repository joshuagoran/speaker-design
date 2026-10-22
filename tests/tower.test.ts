// The tower layout's cabinet: the cutlist, the weight and the cards' front view all built from towerSpec, the same
// geometry the 3D view builds the tower from.
import { PORT_STYLE } from "../src/constants/portStyles";
import { test } from "vite-plus/test";
import assert from "node:assert";
import { towerMidDims, towerSpec } from "../src/lib/speaker/tower";
import { TOWER_MID_HEIGHT_IN } from "../src/constants/paLayouts";
import {
  BACK_JOINT_CUT_NOTES,
  BACK_JOINT_PARTITION_NOTES,
  BACK_JOINT_RAIL_NOTES,
  BACK_JOINT_SUMMARY,
  DEFAULT_BACK_JOINT,
  GLUED_BACK,
} from "../src/constants/bracing";
import { HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { close, vent } from "./helpers";
import { paMidBuild, paSubBox, paSubBuild } from "./pa-build";
import { SHELL_CUT_BOX, chamberCutBox, CORNER_JOINT } from "../src/constants/cutParts";
import { DEFAULT_PA } from "../src/lib/defaults";
import { HORN_MESHES } from "../src/data/meshes";
import { MESHED_HORN_IDS } from "../src/data/meshes/meshedHorns";
import type {
  BackJointId,
  CornerJoint,
  CutPart,
  CutPartId,
  PaLayout,
  Dims3,
  Horn,
  PortStyle,
  VentSpec,
} from "../src/types";
import { IN_PER_MM } from "../src/constants/units";

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

/** The Speaker build's cutlist of the PA design with this box, horn and vent: the tower's one cabinet, or the stack's sub. */
const parts = (
  layout: "tower" | "stack",
  h: Horn,
  joint: CornerJoint = CORNER_JOINT.butt,
  portStyle: PortStyle = PORT_STYLE.slot,
  cVent: VentSpec = SLOTS,
  backJoint?: BackJointId,
) =>
  paSubBuild(
    paSubBox(BOX, portStyle, cVent, {
      layout,
      sub: SUB.id,
      mid: MID.id,
      horn: h.id,
      wall: T,
      inset: INSET,
      backJoint,
    }),
  ).parts(joint);
/** The shell's panels and the cleats behind its baffle. */
const SHELL_PARTS: readonly CutPartId[] = ["side", "topBottom", "back", "baffle", "baffleCleat"];
/** The rows of the partitions between the chambers. */
const partitionsOf = (P: CutPart[]) => P.filter((p) => p.part === "partition");
const one = (P: CutPart[], id: CutPartId) => {
  const rows = P.filter((p) => p.part === id);
  assert.equal(rows.length, 1, `one ${id} row`);
  return rows[0];
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
    stack = parts("stack", FLAT);
  const spec = towerSpec(BOX, T, FLAT),
    H = spec.height,
    iw = BOX.w - 2 * T,
    inD = BOX.d - INSET - 0.75 - T,
    band = SLOTS.slotH + T;
  assert.ok(
    tower.filter((p) => SHELL_PARTS.includes(p.part)).every((p) => p.box === SHELL_CUT_BOX),
    "one cabinet: no mid box",
  );
  const side = one(tower, "side"),
    back = one(tower, "back"),
    baffle = one(tower, "baffle"),
    top = one(tower, "topBottom"),
    partitions = partitionsOf(tower);
  assert.deepEqual([side.qty, side.a, side.b], [2, BOX.d, H]);
  assert.deepEqual([back.a, back.b], [BOX.w - T, H - T]);
  assert.deepEqual([baffle.a, baffle.b], [iw, H - 2 * T - band]);
  assert.deepEqual([top.qty, top.a], [2, BOX.d]);
  assert.deepEqual(
    partitions.map((p) => [p.a, p.b, p.t]),
    spec.partitions.map(() => [iw, inD, T]),
  );
  assert.equal(
    partitions.reduce((n, p) => n + p.qty, 0),
    2,
  );
  // the uprights behind the baffle run its height
  assert.ok(
    tower.some(
      (p) =>
        p.part === "baffleCleat" && p.qty === 2 && Math.abs(p.b - (H - 2 * T - band - 1.5)) < 1e-9,
    ),
    "the uprights",
  );
  // everything in the sub chamber that isn't the shell, the partitions or the cleats is the sub box's own, unchanged
  const own = (P: CutPart[]) =>
    P.filter(
      (p) => p.box === chamberCutBox(0) && !SHELL_PARTS.includes(p.part) && p.part !== "partition",
    );
  assert.deepEqual(own(tower), own(stack));
  assert.ok(own(stack).length > 0, "the slot's shelf and fins at least");
  // area: the sub box's shell and cleats, the extension over it, and the partitions
  const ext = spec.extH;
  const shellCleats = (P: CutPart[]) => area(P.filter((p) => SHELL_PARTS.includes(p.part)));
  close(
    t,
    shellCleats(tower) - shellCleats(stack),
    // sides, back, baffle and the two cleat uprights grow by the extension
    2 * BOX.d * ext + (BOX.w - T) * ext + iw * ext + 2 * 0.75 * ext,
    1e-9,
  );
  close(t, area(partitions), 2 * iw * inD, 1e-9);
});

test("tower cutlist: the arched top is a bent strip, the sides stop at the springline, and the curves aren't guillotine cuts", (t) => {
  const P = parts("tower", ROUND, CORNER_JOINT.rabbet);
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
  assert.equal(
    partitionsOf(P).reduce((n, p) => n + p.qty, 0),
    2,
  );
});

test("tower cutlist: the back, its rabbets and the partitions follow the back setting", () => {
  for (const back of [DEFAULT_BACK_JOINT, GLUED_BACK] as const) {
    const P = parts("tower", ROUND, CORNER_JOINT.rabbet, PORT_STYLE.slot, SLOTS, back);
    const rabbet = `on rear edge for the ${BACK_JOINT_SUMMARY[back]}`;
    assert.ok(one(P, "back").note.startsWith(BACK_JOINT_CUT_NOTES[back]), back);
    assert.ok(one(P, "archTop").note.includes(`${rabbet}'s arch`), back);
    assert.ok(one(P, "side").note.includes(rabbet), back);
    for (const partition of partitionsOf(P))
      assert.ok(partition.note.includes(BACK_JOINT_PARTITION_NOTES[back]), back);
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
  const P = (layout: Extract<PaLayout, "stack" | "tower">, backJoint?: BackJointId) => {
    const cfg = paSubBox(DEFAULT_PA.cDim, DEFAULT_PA.portStyle, DEFAULT_PA.cVent, {
      layout,
      wall: T,
      inset: INSET,
      braceStyle: "window",
      backJoint,
      horn: ROUND.id,
    });
    return { sub: paSubBuild(cfg).parts(), mid: paMidBuild(cfg).parts() };
  };
  const backOf = (parts: CutPart[]) => {
    const row = parts.find((p) => p.part === "back");
    assert.ok(row, "a back");
    return row.note;
  };
  for (const layout of ["stack", "tower"] as const) {
    const screwed = P(layout).sub;
    assert.ok(
      screwed.some((p) => p.box === chamberCutBox(0) && p.part === "windowBrace"),
      layout,
    );
    assert.ok(backOf(screwed).includes(rail), `${layout}: ${backOf(screwed)}`);
    // a glued back takes no screws
    assert.ok(!backOf(P(layout, GLUED_BACK).sub).includes(rail), layout);
  }
  // the stack's mid box takes no window brace: nothing to screw into
  const { mid } = P("stack");
  assert.ok(!mid.some((p) => p.part === "windowBrace"));
  assert.ok(!backOf(mid).includes(rail));
});

test("a stack's cutlist has no partitions or arched top, and the tower's sub chamber holds the air of the sub box alone", () => {
  for (const p of parts("stack", ROUND)) assert.ok(p.part !== "partition" && p.part !== "archTop");
  const at = (layout: "tower" | "stack") =>
    paSubBuild(
      paSubBox(BOX, PORT_STYLE.slot, SLOTS, {
        layout,
        sub: SUB.id,
        mid: MID.id,
        horn: ROUND.id,
        wall: T,
        inset: INSET,
      }),
    );
  const tower = at("tower"),
    stack = at("stack");
  // its clear volume, the vent's air, the wood inside it and its net air are the stack's sub box's
  for (const key of ["clearL", "ventL", "woodL"] as const)
    close(null, tower.build[key], stack.build[key], 1e-9, key);
  close(null, tower.netL, stack.netL, 1e-9, "net air");
});

test("the meshed horns' light list matches the meshes, and each mesh is its horn's catalog size", (t) => {
  assert.deepEqual([...MESHED_HORN_IDS].sort(), Object.keys(HORN_MESHES).sort());
  for (const id of MESHED_HORN_IDS) {
    const m = HORN_MESHES[id],
      h = horn(id);
    assert.ok(m, id);
    close(t, (m.max[0] - m.min[0]) * IN_PER_MM, h.size.w, 0.01);
    close(t, (m.max[1] - m.min[1]) * IN_PER_MM, h.size.h, 0.01);
  }
});

test("the tower's mid chamber: its clear height as built, between the partitions", (t) => {
  const spec = towerSpec(BOX, T, FLAT);
  const clear = spec.partitions[1] - spec.partitions[0] - T;
  close(t, clear, TOWER_MID_HEIGHT_IN - T, 1e-12);
});
