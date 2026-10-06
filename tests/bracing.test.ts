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
  regionsOverlap,
  braceFallbacks,
  ribFirstModeHz,
  ribFlangeIn,
  teeSecondMoment,
  WINDOW_RAIL_IN,
} from "../src/lib/bracing";
import {
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
} from "../src/lib/pa/calc";
import { subDriverDepthIn } from "../src/lib/pa/tubes";
import { subWoodIn3 } from "../src/lib/pa/exactSub";
import {
  BRACE_FALLBACK_NOTES,
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
  Dims3,
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
  // it narrows towards the magnet, never widens
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
function checkCutaway(c: CutawayCase, style: BraceStyleId | undefined) {
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
  const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
  const mDim = c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box;
  const wall = c.wall ?? 0.75,
    inset = c.inset ?? 0.75,
    layout = c.layout ?? "stack";
  const subBracing = subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style);
  const midBracing = midBoxBracing(mDim, wall, inset, mid, layout, style);
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
      const b = subBoxBracing(d.cDim, wall, d.inset, d.portStyle, d.cVent, d.sub, style);
      // every style puts ribs in the starting sub (on the back at least)
      assert.ok(b.ribs.length > 0, `${wall} ${style}: ribs`);
      assert.ok(checkCutaway(c, style) > 0);
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

test("the notes under the Bracing setting name the cabinet and the panel, and say where the style gave way", () => {
  const d = DEFAULT_PA;
  const b = subBoxBracing(d.cDim, 0.75, d.inset, d.portStyle, d.cVent, d.sub, "ribs");
  const fallbacks = braceFallbacks(b);
  const notes = braceNoteLines(PA_SETTINGS_TABS.sub, b);
  assert.strictEqual(notes.length, fallbacks.length);
  // the starting sub under Ribs: its baffle takes window braces, which ribs can't do across the driver
  assert.ok(b.windows.y.length > 0);
  assert.ok(fallbacks.some((f) => f.panel === "baffle" && f.kind === "windows"));
  assert.ok(notes.includes(BRACE_FALLBACK_NOTES.windows("Sub baffle")), notes.join("; "));
  for (const p of b.panels)
    if (p.hz < b.targetHz) {
      const name = bracePanelName(PA_SETTINGS_TABS.sub, p.id);
      assert.ok(
        notes.includes(BRACE_FALLBACK_NOTES.under(name, formatHz(p.hz), formatHz(b.targetHz))),
      );
    }
  // and it does put ribs in, on the back
  assert.ok(b.ribs.some((r) => r.panel === "back"));
});

test("braceFallbacks: the panels braced the other way, and those under the target with their first mode", () => {
  const d = DEFAULT_PA;
  const sub = (style: BraceStyleId) =>
    subBoxBracing(d.cDim, 0.75, d.inset, d.portStyle, d.cVent, d.sub, style);
  // Ribs: the baffle takes window braces (a rib can't cross the driver) and stays under the target
  const ribs = sub("ribs");
  const baffleHz = ribs.panels.find((p) => p.id === "baffle")?.hz ?? NaN;
  assert.ok(baffleHz < ribs.targetHz);
  assert.deepStrictEqual(braceFallbacks(ribs), [
    { panel: "baffle", kind: "windows" },
    { panel: "baffle", kind: "under", hz: baffleHz },
  ]);
  // Window braces: each panel that took ribs (here the back)
  const win = sub("window");
  const ribbed = [...new Set(win.ribs.map((r) => r.panel))];
  assert.ok(ribbed.includes("back"));
  assert.deepStrictEqual(
    braceFallbacks(win)
      .filter((f) => f.kind === "ribs")
      .map((f) => f.panel),
    ribbed,
  );
  // Both: only "under", never a fallback
  assert.ok(braceFallbacks(sub("both")).every((f) => f.kind === "under"));
  // a box that needs nothing has none
  const mid = midBoxBracing(d.mDim, 0.75, d.inset, d.mid, "stack", "ribs");
  assert.ok(mid);
  assert.deepStrictEqual(braceFallbacks(mid), []);
  // "under" carries hz, the others don't
  for (const f of braceFallbacks(ribs)) assert.strictEqual(f.hz === undefined, f.kind !== "under");
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
  // ¾″: the baffle's two level window braces already lift the sides past the target; the back takes a rib and clears it
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
