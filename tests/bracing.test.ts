import { test } from "vite-plus/test";
import assert from "node:assert";
import * as THREE from "three";
import {
  BIRCH_PLY_STIFFNESS,
  MDF_STIFFNESS,
  bracingRegions,
  defaultBraceStyle,
  defaultBraceStyleNear,
  plateFirstModeHz,
  baysHz,
  braceBox,
  regionsOverlap,
  braceShortfalls,
  ribFirstModeHz,
  ribFlangeIn,
  teeSecondMoment,
  WINDOW_RAIL_IN,
  RIB_FREE_END_IN,
  RIB_DEPTH_IN,
  RIB_DEPTHS_IN,
} from "../src/lib/bracing";
import {
  NO_SUPPORTS,
  paBoxPanels,
  DRIVER_CLEARANCE_IN,
  PA_BRACING_CROSSOVER_HZ,
  PA_PANEL_TARGET_HZ,
} from "../src/lib/pa/bracing";
import { XO_LO_OPTIONS, paBraceStyle, paSearchBraceStyle } from "../src/lib/pa/optimize";
import { PA_OPTIMIZER_PANEL } from "../src/constants/optimizerPanels";
import {
  DRIVER_CUTOUT_IN,
  cutParts,
  internalWoodLiters,
  midBoxBracing,
  midKeepOut,
  paInner,
  paPanelStock,
  subBoxBracing,
  subKeepOut,
  braceWoodEstimate,
  braceWoodIn3,
  braceParts,
} from "../src/lib/pa/calc";
import { subDriverDepthIn } from "../src/lib/pa/tubes";
import { subWoodIn3 } from "../src/lib/pa/exactSub";
import {
  RIB_HALF_LAP_NOTE,
  braceUnderNote,
  savedBackJoint,
  GLUED_BACK,
  DEFAULT_BACK_JOINT,
  LEGACY_SUB_BRACE_STYLE_KEY,
  bracePanelName,
  savedBraceStyle,
  savedStackBraceStyle,
} from "../src/constants/bracing";
import { braceNoteLines } from "../src/lib/bracingNotes";
import { PA_SETTINGS_TABS } from "../src/constants/paSettingsTabs";
import { formatHz } from "../src/lib/format";
import { DEFAULT_PA } from "../src/lib/defaults";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import {
  BRACE_MESH_NAME,
  DRIVER_BODY_MESH_NAME,
  VENT_MESH_NAME,
} from "../src/components/stack-view/buildBraces";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES } from "../src/lib/data";
import { close, rel, vent } from "./helpers";
import { configs } from "./golden-configs";
import { scenePropsOf } from "./scene-cases";
import type {
  BoxBracing,
  BracePanelId,
  BoxKeepOut,
  BoxRegion,
  BraceStyleId,
  CornerJoint,
  BackJointId,
  Dims3,
  PanelResonance,
  PortStyle,
} from "../src/types";

const IN3_L = 16.387 / 1000;
const STYLES: BraceStyleId[] = ["window", "ribs", "both"];
const JOINTS: CornerJoint[] = ["butt", "rabbet", "miter"];

test("plate: an isotropic square is the textbook (π/2)·√(D/ρh)·2/a²", (t) => {
  const s = { t: 0.75, lbPerSqFt: 3.4, ...MDF_STIFFNESS };
  const a = 20 * 0.0254,
    h = 0.75 * 0.0254;
  const D = (MDF_STIFFNESS.eStrong * h ** 3) / (12 * (1 - 0.25 ** 2));
  const rhoH = (3.4 * 0.45359237) / 0.09290304;
  close(t, plateFirstModeHz(20, 20, s), (Math.PI / 2) * Math.sqrt(D / rhoH) * (2 / a ** 2), 1e-9);
});

test("plate: thicker, smaller or stiffer reads higher; the weak modulus sets the short span", () => {
  const s = paPanelStock(0.75);
  assert.ok(plateFirstModeHz(20, 30, s) > plateFirstModeHz(20, 31, s));
  assert.ok(plateFirstModeHz(20, 30, s) > plateFirstModeHz(20, 30, paPanelStock(0.5)));
  assert.ok(plateFirstModeHz(20, 30, s) === plateFirstModeHz(30, 20, s), "orientation-free");
  const strongAcross = { ...s, eWeak: BIRCH_PLY_STIFFNESS.eStrong };
  assert.ok(plateFirstModeHz(20, 30, strongAcross) > plateFirstModeHz(20, 30, s));
  // a rib carrying less panel rings higher
  assert.ok(ribFirstModeHz(24, 4, s) > ribFirstModeHz(24, 8, s));
});

test("the PA target is twice the highest sub-to-mid crossover the optimizers try", () => {
  assert.strictEqual(PA_BRACING_CROSSOVER_HZ, Math.max(...XO_LO_OPTIONS));
  assert.strictEqual(PA_PANEL_TARGET_HZ, 2 * PA_BRACING_CROSSOVER_HZ);
});

test("default style, by nominal size: ribs for ⅝″ / 15 mm and ½″ / 12 mm, window braces for ¾″ / 18 mm", () => {
  assert.strictEqual(defaultBraceStyle("5/8"), "ribs");
  assert.strictEqual(defaultBraceStyle("1/2"), "ribs");
  assert.strictEqual(defaultBraceStyle("3/4"), "window");
  // a wall known only by its thickness reads as the nominal size nearest it
  for (const t of [0.5, 15 / 32, 0.625, 0.59])
    assert.strictEqual(defaultBraceStyleNear(t), "ribs", `${t}`);
  for (const t of [0.75, 0.689, 23 / 32])
    assert.strictEqual(defaultBraceStyleNear(t), "window", `${t}`);
  assert.strictEqual(savedBraceStyle("both"), "both");
  assert.strictEqual(savedBraceStyle("rib"), undefined);
  // a save without a style (older saves, or the plywood's default) follows the plywood
  assert.strictEqual(savedBraceStyle(undefined), undefined);
});

test("one style for the stack: an older save's per-cabinet styles read the sub's; the default is the nominal size's", () => {
  assert.strictEqual(savedStackBraceStyle({ braceStyle: "both" }), "both");
  // saves from earlier builds, one style per cabinet
  const older = {
      braceStyle: undefined,
      [LEGACY_SUB_BRACE_STYLE_KEY]: "ribs",
      midBraceStyle: "window",
    },
    midOnly = { braceStyle: undefined, midBraceStyle: "window" };
  assert.strictEqual(savedStackBraceStyle(older), "ribs");
  assert.strictEqual(savedStackBraceStyle(midOnly), undefined);
  // a stale value under the new key doesn't hide a style under the old one
  const stale = { ...older, braceStyle: "tbeam" };
  assert.strictEqual(savedStackBraceStyle(stale), "ribs");
  // the optimizers and cards read an older save's style as the planner does, not the plywood's default
  assert.strictEqual(paBraceStyle({ wall: 0.75, ...older }), "ribs");
  assert.strictEqual(paSearchBraceStyle(older), "ribs");
  // ¾″ measured at 0.68″ sits nearer ⅝″, but it is ¾″ stock: window braces, as the planner shows
  const wall = { wall: 0.68, panel: "3/4", exactIn: { "3/4": 0.68 } } as const;
  assert.strictEqual(defaultBraceStyleNear(0.68), "ribs");
  assert.strictEqual(paBraceStyle(wall), "window");
  assert.strictEqual(paBraceStyle({ ...wall, braceStyle: "both" }), "both");
  assert.strictEqual(paBraceStyle({ wall: 0.5 }), "ribs");
  // the optimizers design in their own plywood, so with no style chosen they brace as it does
  assert.strictEqual(paSearchBraceStyle({}), defaultBraceStyle(PA_OPTIMIZER_PANEL));
});

/** Each golden design's two boxes, as the planner braces them: the inside, the keep-out and the bracing. */
function goldenBoxes(style: BraceStyleId | undefined) {
  return configs.flatMap((c) => {
    const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
    const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
    const mDim = c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box;
    const wall = c.wall ?? 0.75,
      inset = c.inset ?? 0.75,
      layout = c.layout ?? "stack";
    const out: { name: string; box: Dims3; wall: number; keep: BoxKeepOut; b: BoxBracing }[] = [
      {
        name: `${c.name} sub`,
        box: c.cDim,
        wall,
        keep: subKeepOut(c.cDim, wall, inset, c.portStyle, c.cVent, sub),
        b: subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style),
      },
    ];
    const mb = midBoxBracing(mDim, wall, inset, mid, layout, style);
    if (mb)
      out.push({
        name: `${c.name} mid`,
        box: mDim,
        wall,
        keep: midKeepOut(mDim, wall, mid),
        b: mb,
      });
    return out.map((o) => ({ ...o, inner: paInner(o.box, wall, inset) }));
  });
}

test("no brace or rib enters the driver's basket and magnet or the vent, in any golden box, style or joint", () => {
  for (const style of [undefined, ...STYLES])
    for (const { name, inner, wall, keep, b } of goldenBoxes(style)) {
      const regions = bracingRegions(b, inner, wall);
      const tag = `${name} ${style ?? "default"}`;
      for (const r of regions) {
        for (const k of ["x", "y", "z"] as const)
          assert.ok(
            r[k][0] >= -1e-9 && r[k][1] <= inner[k] + 1e-9,
            `${tag}: inside the box (${k})`,
          );
        for (const o of keep.driver)
          assert.ok(!regionsOverlap(r, o), `${tag}: clear of the driver`);
        for (const o of keep.vent) assert.ok(!regionsOverlap(r, o), `${tag}: clear of the vent`);
      }
      // ribs meeting in a corner butt rather than cross
      const ribs = b.ribs.flatMap((rb) =>
        bracingRegions({ windows: { x: [], y: [], z: [] }, notch: null, ribs: [rb] }, inner, wall),
      );
      ribs.forEach((p, i) =>
        ribs.forEach((q, j) =>
          assert.ok(j <= i || !regionsOverlap(p, q), `${tag}: ribs ${i} and ${j}`),
        ),
      );
    }
  // the cutlist carries the same braces whatever the corner joint (the joint changes the panels, not the inside)
  for (const c of configs.slice(0, 6))
    for (const joint of JOINTS) {
      const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
      const parts = cutParts({
        sub,
        mid: MID_OPTIONS[0],
        subBox: c.cDim,
        midDims: { w: 15, h: 15, d: 15 },
        wall: c.wall ?? 0.75,
        inset: c.inset ?? 0.75,
        joint,
        portStyle: c.portStyle,
        cVent: c.cVent,
        layout: "stack",
      }).parts.filter((p) => p.box === "sub" && (p.part === "windowBrace" || p.part === "rib"));
      const b = subBoxBracing(
        c.cDim,
        c.wall ?? 0.75,
        c.inset ?? 0.75,
        c.portStyle,
        c.cVent,
        sub,
        undefined,
      );
      assert.strictEqual(
        parts.reduce((a, p) => a + p.qty, 0),
        b.windows.x.length +
          b.windows.y.length +
          b.windows.z.length +
          b.ribs.reduce((a, r) => a + r.at.length, 0),
        `${c.name} ${joint}`,
      );
    }
});

test("the driver's keep-out covers its cutout at the baffle and reaches its magnet, with the clearance", () => {
  const sub = DEFAULT_PA.sub;
  const k = subKeepOut(DEFAULT_PA.cDim, 0.75, 0.75, DEFAULT_PA.portStyle, DEFAULT_PA.cVent, sub);
  const front = k.driver[0];
  close(
    { name: "cutout" },
    front.x[1] - front.x[0],
    DRIVER_CUTOUT_IN[sub.size] + 2 * DRIVER_CLEARANCE_IN,
    1e-9,
  );
  assert.strictEqual(front.z[0], 0, "from the baffle");
  const back = Math.max(...k.driver.map((o) => o.z[1]));
  close({ name: "depth" }, back, subDriverDepthIn(sub) - 0.75 + DRIVER_CLEARANCE_IN, 1e-9);
  // it narrows toward the magnet, never widens
  k.driver.forEach((o, i) =>
    assert.ok(i === 0 || o.x[1] - o.x[0] <= k.driver[i - 1].x[1] - k.driver[i - 1].x[0] + 1e-9),
  );
  // the mid's, with no depth in its entry, stands on the size's typical depth
  const mk = midKeepOut(DEFAULT_PA.mDim, 0.75, DEFAULT_PA.mid);
  assert.ok(Math.max(...mk.driver.map((o) => o.z[1])) > 0);
});

test("a window brace that ties the sides goes behind the magnet or above or below the driver, never through it", () => {
  for (const { name, inner, keep, b } of goldenBoxes("window")) {
    const top = Math.max(...keep.driver.map((o) => o.y[1])),
      bottom = Math.min(...keep.driver.map((o) => o.y[0])),
      back = Math.max(...keep.driver.map((o) => o.z[1]));
    for (const y of b.windows.y) assert.ok(y > top || y < bottom, `${name}: level brace at ${y}`);
    // across z the frame's rails run round the walls; a brace in front of the magnet must clear the basket there
    const R = WINDOW_RAIL_IN;
    for (const z of b.windows.z)
      assert.ok(
        z > back ||
          keep.driver.every(
            (o) =>
              z < o.z[0] ||
              z > o.z[1] ||
              (o.x[0] >= R && o.x[1] <= inner.x - R && o.y[0] >= R && o.y[1] <= inner.y - R),
          ),
        `${name}: upright brace at ${z}`,
      );
    // a front-to-back brace through the driver opens its frame round it and doesn't count for the baffle
    if (b.notch) for (const x of b.notch.at) assert.ok(b.windows.x.includes(x));
  }
});

test("the rule is deterministic and every style only lifts panels", () => {
  for (const style of STYLES) {
    const a = goldenBoxes(style),
      again = goldenBoxes(style);
    a.forEach((o, i) => {
      assert.deepStrictEqual(o.b, again[i].b, `${o.name} ${style}`);
      for (const p of o.b.panels) assert.ok(p.hz >= p.bareHz - 1e-9, `${o.name} ${style} ${p.id}`);
    });
  }
});

test("the starting sub needs bracing, and the rule lifts it", () => {
  // its back glued, so window braces can hold it too (a screwed back's test is below)
  for (const wall of [0.75, 0.5])
    for (const style of STYLES) {
      const b = subBoxBracing(
        DEFAULT_PA.cDim,
        wall,
        DEFAULT_PA.inset,
        DEFAULT_PA.portStyle,
        DEFAULT_PA.cVent,
        DEFAULT_PA.sub,
        style,
        undefined,
        GLUED_BACK,
      );
      const tag = `${wall} ${style}`;
      assert.ok(
        b.panels.some((p) => p.bareHz < PA_PANEL_TARGET_HZ),
        `${tag}: some panel starts low`,
      );
      assert.ok(b.windowIn3 + b.ribIn3 > 0, `${tag}: braced`);
      assert.ok(
        b.panels.some((p) => p.hz > p.bareHz),
        `${tag}: some panel rings higher`,
      );
    }
});

test("a box whose panels already clear the target takes nothing", () => {
  const b = midBoxBracing({ w: 15, h: 15, d: 15 }, 0.75, 0.75, MID_OPTIONS[0], "stack", undefined);
  assert.ok(b);
  assert.strictEqual(b.windowIn3 + b.ribIn3, 0);
  assert.ok(b.panels.every((p) => p.hz === p.bareHz && p.hz >= PA_PANEL_TARGET_HZ));
  assert.strictEqual(
    midBoxBracing({ w: 15, h: 15, d: 15 }, 0.75, 0.75, MID_OPTIONS[0], "tower", undefined),
    null,
  );
});

test("the vent's parts count as supports: a slot's shelf lifts the sides, its fins the bottom", () => {
  const box = { w: 24, h: 32, d: 18 },
    cv = vent({ slotH: 3, len: 14 }),
    sub = SUB_OPTIONS[0];
  const hz = (style: PortStyle, id: string) =>
    subBoxBracing(box, 0.75, 0.75, style, cv, sub, "window").panels.find((p) => p.id === id)
      ?.bareHz ?? NaN;
  assert.ok(hz("slots", "sideL") > hz("round2", "sideL"));
  assert.ok(hz("slots", "bottom") > hz("round2", "bottom"));
  assert.ok(hz("vslots", "sideL") > hz("round2", "sideL"));
  assert.ok(hz("vslot1", "sideR") > hz("vslot1", "sideL"), "one duct, on the right");
  // a short slot (under DUCT_SUPPORT_MIN_SHARE of the depth) is left out
  const short = subBoxBracing(box, 0.75, 0.75, "slots", vent({ slotH: 3, len: 4 }), sub, "window");
  close(
    { name: "short" },
    short.panels.find((p) => p.id === "sideL")?.bareHz ?? NaN,
    hz("round2", "sideL"),
    1e-9,
  );
});

test("the searches' wood volume matches the cutlist's, its braces by estimate, for every style and vent", (t) => {
  for (const wall of [0.75, 0.5])
    for (const style of STYLES)
      for (const portStyle of ["slots", "vslots", "vslot1", "round2"] as const) {
        const box = { w: 22, h: 34, d: 22 },
          cVent = vent({ slotH: 3, len: 16, nt: 2, dia: 4, throat: 2 }),
          sub = SUB_OPTIONS[0];
        const cut = (noBraces: boolean) =>
          cutParts({
            sub,
            mid: MID_OPTIONS[0],
            subBox: box,
            midDims: { w: 15, h: 15, d: 15 },
            wall,
            inset: 0.75,
            joint: "butt",
            portStyle,
            cVent,
            layout: "stack",
            braceStyle: style,
            noBraces,
          }).parts;
        const parts = cut(false);
        close(
          t,
          subWoodIn3(portStyle, box, wall, 0.75, cVent, style) * IN3_L,
          internalWoodLiters(cut(true), "sub") +
            braceWoodIn3(braceWoodEstimate(box, wall, 0.75, style)) * IN3_L,
          1e-12,
        );
        const b = subBoxBracing(box, wall, 0.75, portStyle, cVent, sub, style);
        const ribs = parts.filter((p) => p.box === "sub" && p.part === "rib");
        assert.strictEqual(
          ribs.reduce((a, p) => a + p.qty, 0),
          b.ribs.reduce((a, r) => a + r.at.length, 0),
          `${wall} ${style} ${portStyle}: a row per run of ribs`,
        );
      }
});

// a triangle and a box overlap (the separating-axis test: the box's three axes, the triangle's normal, and the nine
// edge cross products), the box shrunk a hair so faces that only touch don't count
function triangleMeetsBox(tri: THREE.Triangle, box: THREE.Box3) {
  const c = box.getCenter(new THREE.Vector3()),
    h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).subScalar(1e-3);
  if (h.x <= 0 || h.y <= 0 || h.z <= 0) return false;
  const v = [tri.a, tri.b, tri.c].map((p) => p.clone().sub(c));
  const e = [v[1].clone().sub(v[0]), v[2].clone().sub(v[1]), v[0].clone().sub(v[2])];
  const unit = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const axes = [
    ...unit,
    e[0].clone().cross(e[1]),
    ...unit.flatMap((u) => e.map((x) => u.clone().cross(x))),
  ];
  return axes.every((a) => {
    if (a.lengthSq() < 1e-12) return true;
    const p = v.map((x) => x.dot(a));
    const r = h.x * Math.abs(a.x) + h.y * Math.abs(a.y) + h.z * Math.abs(a.z);
    return !(Math.min(...p) > r || Math.max(...p) < -r);
  });
}
function trianglesOf(m: THREE.Mesh) {
  m.updateWorldMatrix(true, false);
  const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
  const pos = g.getAttribute("position");
  const out: THREE.Triangle[] = [];
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const [a, b, c] = [i, i + 1, i + 2].map((j) =>
      new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld),
    );
    out.push(new THREE.Triangle(a, b, c));
  }
  return out;
}

/** A design as the scene tests take it, with the bracing style the planner would pass. */
type CutawayCase = Parameters<typeof scenePropsOf>[0] & { name: string };
/**
 * The cutaway of design `c` under `style`: no brace or rib meets a driver or the vent's parts as drawn, and every brace
 * and rib is drawn. Returns how many rib and brace meshes it drew.
 */
function checkCutaway(
  c: CutawayCase,
  style: BraceStyleId | undefined,
  back: BackJointId = DEFAULT_BACK_JOINT,
) {
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
  const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
  const mDim = c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box;
  const wall = c.wall ?? 0.75,
    inset = c.inset ?? 0.75,
    layout = c.layout ?? "stack";
  const subBracing = subBoxBracing(
    c.cDim,
    wall,
    inset,
    c.portStyle,
    c.cVent,
    sub,
    style,
    undefined,
    back,
  );
  const midBracing = midBoxBracing(mDim, wall, inset, mid, layout, style, undefined, back);
  const g = buildStackScene({
    ...scenePropsOf({ ...c, cutaway: true }),
    subBracing,
    midBracing,
    subKeepOut: subKeepOut(c.cDim, wall, inset, c.portStyle, c.cVent, sub),
    midKeepOut: layout === "tower" ? null : midKeepOut(mDim, wall, mid),
  });
  g.updateMatrixWorld(true);
  const named = (n: string) => {
    const out: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name === n) out.push(o);
    });
    return out;
  };
  const tag = `${c.name} ${style ?? "default"}`;
  const braceMeshes = named(BRACE_MESH_NAME);
  const regions = [
    ...bracingRegions(subBracing, paInner(c.cDim, wall, inset), wall),
    ...(midBracing ? bracingRegions(midBracing, paInner(mDim, wall, inset), wall) : []),
  ];
  assert.strictEqual(braceMeshes.length, regions.length, `${tag}: every brace and rib drawn`);
  const braces = braceMeshes.map((m) => new THREE.Box3().setFromObject(m));
  const others = [...named(DRIVER_BODY_MESH_NAME), ...named(VENT_MESH_NAME)];
  assert.ok(named(DRIVER_BODY_MESH_NAME).length > 0, `${tag}: the drivers show in the cutaway`);
  for (const m of others) {
    const near = braces.filter((b) => b.intersectsBox(new THREE.Box3().setFromObject(m)));
    if (!near.length) continue;
    for (const tri of trianglesOf(m))
      for (const b of near)
        assert.ok(!triangleMeetsBox(tri, b), `${tag}: a brace meets the ${m.name}`);
  }
  return braceMeshes.length;
}

test("in the cutaway, no brace or rib meets a driver or the vent's parts as drawn", () => {
  for (const c of configs) checkCutaway(c, undefined);
});

test("the starting sub's cutaway under each style: ribs, window braces and both drawn clear of the driver and vent", () => {
  const d = DEFAULT_PA;
  for (const wall of [0.75, 0.5])
    for (const style of STYLES) {
      const c: CutawayCase = {
        name: `default PA ${wall}`,
        sub: d.sub.id,
        mid: d.mid.id,
        horn: d.horn.id,
        midBox: d.midBox.id,
        mDim: d.mDim,
        portStyle: d.portStyle,
        cDim: d.cDim,
        cVent: d.cVent,
        wall,
        inset: d.inset,
      };
      const b = subBoxBracing(
        d.cDim,
        wall,
        d.inset,
        d.portStyle,
        d.cVent,
        d.sub,
        style,
        undefined,
        GLUED_BACK,
      );
      // each style puts in its own kind: ribs only under Ribs, frames only under Window braces, under Both whichever
      // does more for the wood (here ribs alone: the cutout lifts the baffle over the target without a frame)
      const frames = b.windows.x.length + b.windows.y.length + b.windows.z.length;
      if (style === "ribs") assert.strictEqual(frames, 0, `${wall} ${style}: window braces`);
      if (style === "window") assert.strictEqual(b.ribs.length, 0, `${wall} ${style}: ribs`);
      assert.ok(frames + b.ribs.length > 0, `${wall} ${style}: braced`);
      assert.ok(checkCutaway(c, style, GLUED_BACK) > 0);
    }
});

test("the 3D view draws the braces and ribs, and the drivers only in the cutaway", () => {
  const c = configs[0];
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
  const wall = c.wall ?? 0.75,
    inset = c.inset ?? 0.75;
  const subBracing = subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, "both");
  const subKeep = subKeepOut(c.cDim, wall, inset, c.portStyle, c.cVent, sub);
  const count = (cutaway: boolean, name: string) => {
    let n = 0;
    buildStackScene({
      ...scenePropsOf({ ...c, cutaway }),
      subBracing,
      subKeepOut: subKeep,
    }).traverse((o) => {
      if (o.name === name) n++;
    });
    return n;
  };
  const regions: BoxRegion[] = bracingRegions(subBracing, paInner(c.cDim, wall, inset), wall);
  assert.strictEqual(count(true, BRACE_MESH_NAME), regions.length);
  assert.ok(count(true, DRIVER_BODY_MESH_NAME) > 0);
  assert.strictEqual(count(false, DRIVER_BODY_MESH_NAME), 0, "the closed cabinet hides them");
});

test("rib: the panel beside it is a flange (Eurocode 5's effective width), so the T rings higher than the rib alone", (t) => {
  const s = paPanelStock(0.75);
  // the flange: the rib's width and the panel each side, at most a tenth of the span, 20 panel thicknesses or the bay
  close(t, ribFlangeIn(24, 30, 0.75), 0.75 + 2.4, 1e-12);
  close(t, ribFlangeIn(200, 30, 0.75), 0.75 + 15, 1e-12);
  close(t, ribFlangeIn(200, 6, 0.75), 6, 1e-12);
  // the parallel-axis theorem by hand: a 4 × 1 flange (at 0.5) on a 1 × 3 web (at 2.5), centroid 9.5 / 7 up
  const y = 9.5 / 7;
  close(
    t,
    teeSecondMoment(4, 1, 1, 3),
    4 / 12 + 4 * (y - 0.5) ** 2 + 27 / 12 + 3 * (2.5 - y) ** 2,
    1e-12,
  );
  // no flange beyond the rib: one rectangle t × (t + depth)
  close(t, teeSecondMoment(1, 1, 1, 3), 4 ** 3 / 12, 1e-12);
  // the T is well stiffer than the rib alone carrying the same panel
  const alone = (span: number, trib: number) => {
    const w = 0.75 * 0.0254,
      d = 2.5 * 0.0254,
      L = span * 0.0254,
      kg = (s.lbPerSqFt * 0.45359237) / 0.09290304;
    const mu = kg * d + kg * trib * 0.0254;
    return ((Math.PI / 2) * Math.sqrt((s.eWeak * w * d ** 3) / 12 / mu)) / L ** 2;
  };
  assert.ok(ribFirstModeHz(24, 6, s) > 1.5 * alone(24, 6));
});

test("the notes under the Bracing setting name the cabinet and each panel left under the target", () => {
  // a 30″-wide box under Ribs: no rib can cross the driver, so its wide baffle stays bare and under the target
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 30, h: 32, d: 18 },
    0.5,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
  );
  const notes = braceNoteLines(PA_SETTINGS_TABS.sub, b);
  const under = braceShortfalls(b);
  assert.ok(under.some((p) => p.id === "baffle"));
  assert.deepStrictEqual(
    notes,
    under.map((p) =>
      braceUnderNote(
        bracePanelName(PA_SETTINGS_TABS.sub, p.id),
        formatHz(p.hz),
        formatHz(b.targetHz),
      ),
    ),
  );
  // a box that needs nothing has no note
  const d = DEFAULT_PA;
  const mid = midBoxBracing(d.mDim, 0.75, d.inset, d.mid, "stack", "ribs");
  assert.ok(mid);
  assert.deepStrictEqual(braceNoteLines(PA_SETTINGS_TABS.mid, mid), []);
});

test("braceShortfalls: exactly the panels under the target, with their first mode", () => {
  const d = DEFAULT_PA;
  for (const style of STYLES) {
    const b = subBoxBracing(d.cDim, 0.75, d.inset, d.portStyle, d.cVent, d.sub, style);
    assert.deepStrictEqual(
      braceShortfalls(b),
      b.panels.filter((p) => p.hz < b.targetHz),
      style,
    );
    assert.strictEqual(braceShortfalls(b).length === 0, b.meets, style);
  }
});

test("the strict styles keep a ½″ sub to their own kind, and Both takes either", () => {
  const d = DEFAULT_PA;
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  if (!sub) throw new Error("the B&C 18NW100 is in the catalog");
  const box = { w: 22, h: 32, d: 18 },
    slot = { ...d.cVent, len: 4 };
  for (const handles of [undefined, d.hardware.sub]) {
    const plan = (style: BraceStyleId): BoxBracing =>
      subBoxBracing(box, 0.5, d.inset, d.portStyle, slot, sub, style, handles);
    const ribs = plan("ribs"),
      win = plan("window"),
      both = plan("both");
    const frames = (b: BoxBracing) => b.windows.x.length + b.windows.y.length + b.windows.z.length;
    const tag = handles ? "with hardware" : "bare";
    // Ribs: ribs only; Window braces: frames only; Both: whichever does more for the wood
    assert.strictEqual(frames(ribs), 0, tag);
    assert.ok(ribs.ribs.length > 0, tag);
    assert.ok(frames(win) > 0, tag);
    assert.deepStrictEqual(win.ribs, [], tag);
    assert.ok(frames(both) + both.ribs.length > 0, tag);
    // the strict plans differ
    const key = (b: BoxBracing) => JSON.stringify([b.windows, b.ribs]);
    assert.notStrictEqual(key(ribs), key(win), tag);
  }
  // the cutlist's rib rows say to half-lap a rib only where it crosses a window brace
  const lapped = (style: BraceStyleId) =>
    cutParts({
      sub: d.sub,
      mid: d.mid,
      subBox: d.cDim,
      midDims: d.mDim,
      wall: d.wall,
      inset: d.inset,
      joint: "butt",
      portStyle: d.portStyle,
      cVent: d.cVent,
      layout: "stack",
      braceStyle: style,
    })
      .parts.filter((p) => p.box === "sub" && p.part === "rib")
      .map((p) => (p.note ?? "").endsWith(RIB_HALF_LAP_NOTE));
  // Ribs has no window brace, and under Both the starting sub takes ribs alone, so no rib crosses one
  for (const style of ["ribs", "both"] as const) {
    assert.ok(lapped(style).length > 0, style);
    assert.ok(
      lapped(style).every((x) => !x),
      style,
    );
  }
});

test("cutlist: a rib row says to half-lap only where its rib crosses a window brace", () => {
  const d = DEFAULT_PA;
  const base = subBoxBracing(d.cDim, d.wall, d.inset, d.portStyle, d.cVent, d.sub, "both");
  // an upright frame 10″ from the left side; two ribs on the top running across (x), one over it and one past it, and
  // one on the back running up (y), which no frame crosses
  const b: BoxBracing = {
    ...base,
    windows: { x: [10], y: [], z: [] },
    notch: null,
    ribs: [
      { panel: "top", across: "z", at: [8], from: 0, len: 20, depth: RIB_DEPTH_IN },
      { panel: "top", across: "z", at: [16], from: 12, len: 8, depth: RIB_DEPTH_IN },
      { panel: "back", across: "x", at: [10], from: 0, len: 20, depth: RIB_DEPTH_IN },
    ],
  };
  const notes = braceParts("sub", b, { x: 20, y: 20, z: 20 }, d.wall)
    .filter((p) => p.part === "rib")
    .map((p) => (p.note ?? "").endsWith(RIB_HALF_LAP_NOTE));
  assert.deepStrictEqual(notes, [true, false, false]);
});

test("rib: the T section's EI and first mode against a hand calculation (a ¾″ rib 2½″ deep over 22½″, a 9.2″ bay)", (t) => {
  const s = paPanelStock(0.75);
  // the flange: 0.75 + min(0.1 × 22.5, 20 × 0.75, 9.2 − 0.75) = 0.75 + 2.25 = 3.0″
  close(t, ribFlangeIn(22.5, 9.2, 0.75), 3, 1e-12);
  // the flange 3 × 0.75 (area 2.25 at 0.375 up), the rib 0.75 × 2.5 (area 1.875 at 2.0 up): the centroid
  // (2.25 × 0.375 + 1.875 × 2.0) / 4.125 = 1.113636″, and by the parallel-axis theorem
  // I = 3 × 0.75³/12 + 2.25 × 0.738636² + 0.75 × 2.5³/12 + 1.875 × 0.886364² = 3.782670 in⁴
  close(t, teeSecondMoment(3, 0.75, 0.75, 2.5), 3.78267, 1e-5);
  // 3.87 × the rib alone's 0.75 × 2.5³ / 12 = 0.976563 in⁴
  close(t, teeSecondMoment(3, 0.75, 0.75, 2.5) / 0.976563, 3.8734, 1e-4);
  // EI at WISA birch's weaker modulus, 7 452 N/mm²; μ the rib and the 9.2″ of panel it carries
  const EI = 7.452e9 * 3.78267 * 0.0254 ** 4;
  const mu = ((s.lbPerSqFt * 0.45359237) / 0.09290304) * (2.5 + 9.2) * 0.0254;
  rel(
    t,
    ribFirstModeHz(22.5, 9.2, s),
    ((Math.PI / 2) * Math.sqrt(EI / mu)) / (22.5 * 0.0254) ** 2,
    1e-6,
  );
});

test("the starting sub under Ribs takes ribs: on the back at ¾″, and on the sides, top and back at ½″", () => {
  const d = DEFAULT_PA;
  const braced = (wall: number) =>
    subBoxBracing(d.cDim, wall, d.inset, d.portStyle, d.cVent, d.sub, "ribs");
  const on = (b: BoxBracing, id: BracePanelId) =>
    b.ribs.filter((r) => r.panel === id).reduce((a, r) => a + r.at.length, 0);
  const hz = (b: BoxBracing, id: BracePanelId) => b.panels.find((p) => p.id === id)?.hz ?? NaN;
  // ¾″: the back takes ribs and clears the target, and so do the sides
  const thick = braced(0.75);
  assert.ok(on(thick, "back") >= 1);
  assert.ok(hz(thick, "back") >= thick.targetHz);
  for (const id of ["sideL", "sideR"] as const) assert.ok(hz(thick, id) >= thick.targetHz, id);
  // ½″: ribs on both sides, the top and the back, each then over the target
  const thin = braced(0.5);
  for (const id of ["sideL", "sideR", "top", "back"] as const) {
    assert.ok(on(thin, id) >= 1, `${id}: ribbed`);
    assert.ok(hz(thin, id) >= thin.targetHz, `${id}: over the target`);
  }
});

test("the optimizers' brace estimate stays near the rule over the golden boxes, in the optimizers' ¾″ ply", () => {
  for (const style of STYLES) {
    const err: number[] = [];
    for (const c of configs) {
      const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
      const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
      const mDim = c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box;
      const inset = c.inset ?? 0.75;
      const ruled = subBoxBracing(c.cDim, 0.75, inset, c.portStyle, c.cVent, sub, style);
      err.push(
        (braceWoodIn3(braceWoodEstimate(c.cDim, 0.75, inset, style)) - braceWoodIn3(ruled)) * IN3_L,
      );
      const mb = midBoxBracing(mDim, 0.75, inset, mid, c.layout ?? "stack", style);
      if (mb)
        err.push(
          (braceWoodIn3(braceWoodEstimate(mDim, 0.75, inset, style)) - braceWoodIn3(mb)) * IN3_L,
        );
    }
    // liters of wood: under a liter on the whole, a couple of liters at worst (a sub box holds 60 to 200); the strict
    // styles fit worst, since a frame-only or rib-only plan stops where its kind can do no more
    const rms = Math.sqrt(err.reduce((a, e) => a + e * e, 0) / err.length);
    assert.ok(rms < 0.8, `${style}: ${rms.toFixed(3)} L rms`);
    assert.ok(
      Math.max(...err.map(Math.abs)) < 2.4,
      `${style}: ${err.map((e) => e.toFixed(2)).join(" ")}`,
    );
  }
});

test("ribs: a first pick one way doesn't lock a panel out of the other way when that lifts it more", () => {
  // ⅝″ walls, an 18″ sub in a short, deep box: one rib across the height leaves the sides at 261 Hz and the driver's
  // basket keeps a second off them; one rib up the side (across the depth) clears the target
  const sub = SUB_OPTIONS.find((s) => s.id === "es18lw2420");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 20, h: 24, d: 22 },
    0.625,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 14 },
    sub,
    "ribs",
  );
  for (const id of ["sideL", "sideR"] as const) {
    assert.ok((b.panels.find((p) => p.id === id)?.hz ?? 0) >= b.targetHz, `${id}: over the target`);
    assert.deepEqual(
      b.ribs.filter((r) => r.panel === id).map((r) => r.across),
      ["z"],
      `${id}: ribs up the side`,
    );
  }
});

test("glued edges: the joints hold a panel's edges, so it rings over the hinged plate; a screwed back's don't", () => {
  const d = DEFAULT_PA;
  const panels = (back: BackJointId) =>
    subBoxBracing(d.cDim, 0.5, d.inset, d.portStyle, d.cVent, d.sub, "ribs", undefined, back)
      .panels;
  const bare = (ps: PanelResonance[], id: BracePanelId) =>
    ps.find((p) => p.id === id)?.bareHz ?? NaN;
  const screwed = panels(DEFAULT_BACK_JOINT),
    glued = panels(GLUED_BACK);
  const stock = paPanelStock(0.5);
  const inner = paInner(d.cDim, 0.5, d.inset);
  // the top: glued on all four edges but the back's
  assert.ok(bare(screwed, "top") > plateFirstModeHz(inner.x, inner.z, stock) * 1.1);
  // the back: hinged when screwed (the plate model's own number), held when glued
  assert.ok(Math.abs(bare(screwed, "back") - plateFirstModeHz(inner.x, inner.y, stock)) < 0.5);
  assert.ok(bare(glued, "back") > bare(screwed, "back") * 1.2);
});

test("window rails are beams: a frame's rail along a tall wall holds less than a rigid line would", () => {
  // a deep, tall box where only frames across its depth fit (a part along the left side and across the floor keeps the
  // others off): their rails run up the 31″ sides
  const stock = paPanelStock(0.5);
  const panels = paBoxPanels({ iw: 21, ih: 31, inD: 30, band: 0 }, stock, stock, NO_SUPPORTS);
  const b = braceBox({
    inner: { x: 21, y: 31, z: 30 },
    panels,
    targetHz: 280,
    style: "window",
    braceStock: stock,
    keepOut: {
      driver: [],
      vent: [
        { x: [0, 2], y: [0, 31], z: [10, 12] },
        { x: [0, 21], y: [0, 2], z: [10, 12] },
      ],
    },
  });
  assert.ok(
    b.windows.z.length >= 1 && !b.windows.x.length && !b.windows.y.length,
    JSON.stringify(b.windows),
  );
  const side = panels.find((p) => p.id === "sideL");
  assert.ok(side);
  const hz = b.panels.find((p) => p.id === "sideL")?.hz ?? NaN;
  const bays = baysHz(side, b.windows.z, b.windows.y);
  assert.ok(hz < bays * 0.8, `side ${hz.toFixed(0)} Hz, its bays ${bays.toFixed(0)} Hz`);
});

test("rib rings: with a glued back, the back's rib lines up with the sides' and each clears the target", () => {
  const sub = SUB_OPTIONS.find((s) => s.id === "es18lw2420");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 22, h: 24, d: 22 },
    0.5,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
    undefined,
    GLUED_BACK,
  );
  const at = (id: BracePanelId) => b.ribs.filter((r) => r.panel === id).flatMap((r) => r.at);
  assert.ok(at("back").length >= 1);
  assert.deepEqual(at("back"), at("sideL"));
  assert.deepEqual(at("back"), at("sideR"));
  for (const id of ["back", "sideL", "sideR"] as const)
    assert.ok((b.panels.find((p) => p.id === id)?.hz ?? 0) >= b.targetHz, id);
});

test("short ribs and a short slot: an 18″ driver's basket and a 4″ slot no longer keep ribs off the sides and bottom", () => {
  // ½″ walls, 22 × 32 × 18: the basket ring comes within 2″ of the sides at the baffle, the slot runs 4″ back
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const box = { w: 22, h: 32, d: 18 };
  const b = subBoxBracing(
    box,
    0.5,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
  );
  const keep = subKeepOut(
    box,
    0.5,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
  );
  const ring = keep.driver[0];
  // a side rib at the driver's height starts behind the basket's ring, at most RIB_FREE_END_IN off the baffle
  const side = b.ribs.filter((r) => r.panel === "sideL");
  assert.ok(
    side.some(
      (r) =>
        r.at.some((y) => y > ring.y[0] && y < ring.y[1]) &&
        r.from >= ring.z[1] - 1e-9 &&
        r.from <= RIB_FREE_END_IN,
    ),
    JSON.stringify(side),
  );
  // the floor behind the slot takes ribs that run front to back, with the air, from the end of its clear floor
  const floor = b.ribs.filter((r) => r.panel === "bottom");
  assert.ok(floor.length > 0);
  for (const r of floor) {
    assert.equal(r.across, "x");
    assert.ok(r.from >= keep.vent[0].z[1] - 1e-9, `${r.from} vs ${keep.vent[0].z[1]}`);
  }
  // every panel but the baffle clears the target
  for (const p of b.panels) if (p.id !== "baffle") assert.ok(p.hz >= b.targetHz, `${p.id} ${p.hz}`);
  // the slot's room ends two slot heights behind the duct, not at the back
  const slot = keep.vent[0];
  assert.ok(slot.z[1] < paInner(box, 0.5, DEFAULT_PA.inset).z - 1);
});

test("the back panel setting: a saved choice reads back, anything else is screwed; glued never takes more", () => {
  assert.equal(savedBackJoint(GLUED_BACK), GLUED_BACK);
  assert.equal(savedBackJoint(DEFAULT_BACK_JOINT), DEFAULT_BACK_JOINT);
  assert.equal(savedBackJoint("nailed"), undefined);
  assert.equal(DEFAULT_PA.backJoint, DEFAULT_BACK_JOINT);
  const d = DEFAULT_PA;
  const plan = (back: BackJointId) =>
    subBoxBracing(d.cDim, 0.5, d.inset, d.portStyle, d.cVent, d.sub, "ribs", undefined, back);
  const backHz = (b: BoxBracing) => b.panels.find((p) => p.id === "back")?.bareHz ?? NaN;
  assert.ok(braceWoodIn3(plan(GLUED_BACK)) <= braceWoodIn3(plan(DEFAULT_BACK_JOINT)));
  assert.ok(backHz(plan(GLUED_BACK)) > backHz(plan(DEFAULT_BACK_JOINT)));
});

test("a screwed back: the window braces' rails don't hold it, and no rib ring is glued to it", () => {
  const d = DEFAULT_PA;
  const plan = (back: BackJointId) =>
    subBoxBracing(d.cDim, 0.75, d.inset, d.portStyle, d.cVent, d.sub, "window", undefined, back);
  const back = (b: BoxBracing) => b.panels.find((p) => p.id === "back");
  const screwed = back(plan(DEFAULT_BACK_JOINT)),
    glued = back(plan(GLUED_BACK));
  assert.ok(screwed && glued);
  // the frames stand in the box either way, but only a glued back is held by them
  assert.ok(Math.abs(screwed.hz - screwed.bareHz) < 1e-9, `${screwed.hz} vs ${screwed.bareHz}`);
  assert.ok(glued.hz > glued.bareHz);
});

test("rib depths: a long span takes deeper ribs where they lift it more for the wood", () => {
  // a 30″-wide box in ½″: two 5½″ ribs hold its back, where 2½″ ones need a ring with the sides and more wood
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 30, h: 32, d: 18 },
    0.5,
    DEFAULT_PA.inset,
    "slots",
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
    undefined,
    GLUED_BACK,
  );
  const back = b.ribs.filter((r) => r.panel === "back");
  assert.ok(
    back.length > 0 && back.every((r) => r.depth === RIB_DEPTHS_IN[2]),
    JSON.stringify(back),
  );
  assert.ok((b.panels.find((p) => p.id === "back")?.hz ?? 0) >= b.targetHz);
  // every rib takes one of the offered depths, and the cutlist cuts each to its own
  for (const r of b.ribs) assert.ok(RIB_DEPTHS_IN.some((d) => d === r.depth));
});
