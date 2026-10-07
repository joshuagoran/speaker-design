// The bracing around the hardware (no rib or window brace over a handle's, the dish's or the posts' recess, so a panel
// with a handle still takes its ribs beside it), and each bracing style giving its own braces, as the 3D view draws them.
import { test } from "vite-plus/test";
import assert from "node:assert";
import * as THREE from "three";
import { bracingRegions, regionsOverlap } from "../src/lib/bracing";
import { PA_PANEL_TARGET_HZ } from "../src/lib/pa/bracing";
import {
  ductFlagsOf,
  midBoxBracing,
  midHardwarePlan,
  paInner,
  subBoxBracing,
  subHardwarePlan,
} from "../src/lib/pa/calc";
import { HANDLE_CHOICES } from "../src/lib/pa/hardware";
import { DEFAULT_PA } from "../src/lib/defaults";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES } from "../src/lib/data";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import { BRACE_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { configs } from "./golden-configs";
import { scenePropsOf } from "./scene-cases";
import type { BoxBracing, BoxHandles, BoxHardwarePlan, BraceStyleId, Dims3 } from "../src/types";

const STYLES: readonly BraceStyleId[] = ["window", "ribs", "both"];
/** Every default design: the golden configs (the saved seeds and the synthetic ones) and the planner's default. */
const designs = [
  ...configs,
  {
    name: "default PA",
    sub: DEFAULT_PA.sub.id,
    mid: DEFAULT_PA.mid.id,
    horn: DEFAULT_PA.horn.id,
    midBox: DEFAULT_PA.midBox.id,
    portStyle: DEFAULT_PA.portStyle,
    cDim: DEFAULT_PA.cDim,
    cVent: DEFAULT_PA.cVent,
    mDim: DEFAULT_PA.mDim,
    wall: DEFAULT_PA.wall,
    inset: DEFAULT_PA.inset,
    layout: DEFAULT_PA.layout,
  },
];
const partsOf = (c: (typeof designs)[number]) => ({
  sub: SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0],
  mid: MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0],
  mDim: c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box,
  wall: c.wall ?? 0.75,
  inset: c.inset ?? 0.75,
  layout: c.layout ?? "stack",
});

/** The braces' and ribs' regions that overlap a part's recess (its fit region), in words. */
function clashes(b: BoxBracing, plan: BoxHardwarePlan, box: Dims3, wall: number, inset: number) {
  const regions = bracingRegions(b, paInner(box, wall, inset), wall);
  return plan.parts.flatMap((p) =>
    regions.some((r) => regionsOverlap(r, p.fit)) ? [`${p.panel} ${p.kind}`] : [],
  );
}

test("no rib or window brace overlaps a handle's, the dish's or the posts' recess, in any default design", () => {
  for (const c of designs) {
    const { sub, mid, mDim, wall, inset, layout } = partsOf(c);
    for (const model of HANDLE_CHOICES)
      for (const style of STYLES) {
        const handles: BoxHandles = { model, upIn: 0, backIn: 0 };
        const tag = `${c.name}, ${model}, ${style}`;
        const sb = subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style, handles);
        const sp = subHardwarePlan(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style, handles);
        assert.deepStrictEqual(clashes(sb, sp, c.cDim, wall, inset), [], `${tag}: sub`);
        // the fit check reads the same bracing and finds nothing in the way
        for (const p of sp.parts)
          assert.ok(!p.hits.some((h) => h === "rib" || h === "window"), `${tag}: sub ${p.kind}`);
        const mb = midBoxBracing(mDim, wall, inset, mid, layout, style, handles);
        const mp = midHardwarePlan(mDim, wall, inset, mid, layout, style, handles);
        if (!mb || !mp) continue;
        assert.deepStrictEqual(clashes(mb, mp, mDim, wall, inset), [], `${tag}: mid`);
      }
  }
});

test("a side panel with a handle still takes ribs, beside the recess, and meets the target", () => {
  // ½″ walls under Ribs: the sub's sides need a rib, and the even place for it crosses the handles' height
  const d = DEFAULT_PA,
    wall = 0.469;
  const bare = subBoxBracing(d.cDim, wall, d.inset, d.portStyle, d.cVent, d.sub, "ribs");
  for (const model of ["H1105", "30769"] as const) {
    const handles: BoxHandles = { model, upIn: 0, backIn: 0 };
    const b = subBoxBracing(d.cDim, wall, d.inset, d.portStyle, d.cVent, d.sub, "ribs", handles);
    const plan = subHardwarePlan(
      d.cDim,
      wall,
      d.inset,
      d.portStyle,
      d.cVent,
      d.sub,
      "ribs",
      handles,
    );
    for (const side of ["sideL", "sideR"] as const) {
      const ribs = b.ribs.filter((r) => r.panel === side);
      assert.ok(ribs.length > 0, `${model}: ${side} keeps its ribs`);
      const hz = b.panels.find((p) => p.id === side)?.hz ?? 0;
      assert.ok(hz >= PA_PANEL_TARGET_HZ, `${model}: ${side} at ${hz.toFixed(0)} Hz`);
    }
    assert.deepStrictEqual(clashes(b, plan, d.cDim, wall, d.inset), [], model);
    // the bare box's rib (no hardware) is where the handles go: the rule moved it, not dropped it
    const bareSide = bare.ribs.filter((r) => r.panel === "sideL").flatMap((r) => r.at);
    const sideAt = b.ribs.filter((r) => r.panel === "sideL").flatMap((r) => r.at);
    assert.notDeepStrictEqual(sideAt, bareSide, model);
  }
});

/** The window braces and the ribs of a plan, counted. */
const windowsOf = (b: BoxBracing) => b.windows.x.length + b.windows.y.length + b.windows.z.length;

test("each bracing style gives only its own braces: ribs under Ribs, frames under Window braces", () => {
  for (const c of designs) {
    const { sub, mid, mDim, wall, inset, layout } = partsOf(c);
    for (const hw of [undefined, DEFAULT_PA.hardware]) {
      const plans = (style: BraceStyleId) => [
        subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style, hw?.sub),
        midBoxBracing(mDim, wall, inset, mid, layout, style, hw?.mid),
      ];
      const byStyle = Object.fromEntries(STYLES.map((s) => [s, plans(s)]));
      STYLES.forEach((style) =>
        byStyle[style].forEach((b, i) => {
          if (!b) return;
          const tag = `${c.name}, ${style}, ${i ? "mid" : "sub"}${hw ? ", hardware" : ""}`;
          assert.strictEqual(b.style, style, tag);
          if (style === "window") assert.deepStrictEqual(b.ribs, [], tag);
          if (style === "ribs") assert.strictEqual(windowsOf(b), 0, tag);
          if (style === "both") {
            // never leaves the baffle lower than Ribs does: it takes the frames the baffle needs before any rib
            const hz = (x: BoxBracing | null) => x?.panels.find((p) => p.id === "baffle")?.hz ?? 0;
            assert.ok(hz(b) >= hz(byStyle.ribs[i]) - 1e-6, `${tag}: baffle ${hz(b).toFixed(0)} Hz`);
          }
        }),
      );
    }
  }
});

test("the cutout lifts a baffle: the rectangle sub's clears the target without a frame (155 Hz read whole)", () => {
  const c = configs.find((x) => x.name === "rectangle sub");
  assert.ok(c, "the seed is there");
  const { sub, wall, inset } = partsOf(c);
  for (const style of STYLES) {
    const b = subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style);
    const baffle = b.panels.find((p) => p.id === "baffle");
    assert.ok(baffle && baffle.hz >= b.targetHz, `${style}: baffle at ${baffle?.hz.toFixed(0)} Hz`);
  }
});

test("the 3D view draws the plan of the style chosen, every brace and rib of it", () => {
  for (const c of designs.filter((x) => x.name === "rectangle sub" || x.name === "default PA")) {
    const { sub, mid, mDim, wall, inset, layout } = partsOf(c);
    const handles: BoxHandles = { model: "H1105", upIn: 0, backIn: 0 };
    const counts = STYLES.map((style) => {
      const subBracing = subBoxBracing(
        c.cDim,
        wall,
        inset,
        c.portStyle,
        c.cVent,
        sub,
        style,
        handles,
      );
      const midBracing = midBoxBracing(mDim, wall, inset, mid, layout, style, handles);
      let n = 0;
      buildStackScene({
        ...scenePropsOf({ ...c, cutaway: true }),
        subBracing,
        midBracing,
      }).traverse((o) => {
        if (o instanceof THREE.Mesh && o.name === BRACE_MESH_NAME) n++;
      });
      const regions =
        bracingRegions(subBracing, paInner(c.cDim, wall, inset), wall).length +
        (midBracing ? bracingRegions(midBracing, paInner(mDim, wall, inset), wall).length : 0);
      assert.strictEqual(n, regions, `${c.name}, ${style}`);
      return n;
    });
    assert.ok(
      counts.every((n) => n > 0),
      c.name,
    );
  }
});

test("a folded slot's rear channel wall holds the sides where it rises far enough, and side ribs stop on it", () => {
  const sub = DEFAULT_PA.sub,
    t = 0.5,
    inset = 0.75,
    box = { w: 24, h: 40, d: 26 };
  const handles: BoxHandles = { model: "H1105", upIn: 0, backIn: 0 };
  // a slot folded up the back: its wall rising 2/3 of the inside height or more, then the least rise (1″)
  const tall = { ...DEFAULT_PA.cVent, slotH: 3.5, len: box.d - t + 0.75 * (box.h - 2 * t) };
  const low = { ...tall, len: box.d - t + 1 };
  const flags = (v: typeof tall) => ductFlagsOf(box, t, inset, "slots", v, sub);
  assert.ok(flags(tall).folds && flags(tall).wallHolds);
  assert.ok(flags(low).folds && !flags(low).wallHolds);
  const b = subBoxBracing(box, t, inset, "slots", tall, sub, "ribs", handles);
  const plan = subHardwarePlan(box, t, inset, "slots", tall, sub, "ribs", handles);
  // the sides' ribs run back from the baffle and end on the wall, clear of the handles' recesses
  const wallAt = paInner(box, t, inset).z - (tall.slotH + t);
  for (const side of ["sideL", "sideR"] as const) {
    const ribs = b.ribs.filter((r) => r.panel === side);
    assert.ok(ribs.length > 0, side);
    for (const r of ribs)
      assert.ok(Math.abs(r.from + r.len - wallAt) < 1e-9, `${side} rib ends at ${r.from + r.len}`);
    const hz = b.panels.find((p) => p.id === side)?.hz ?? 0;
    assert.ok(hz >= PA_PANEL_TARGET_HZ - 1e-9, `${side} at ${hz.toFixed(0)} Hz`);
  }
  assert.deepStrictEqual(clashes(b, plan, box, t, inset), []);
  // the low wall neither holds the sides nor takes a rib's end: the sides read lower
  const lowB = subBoxBracing(box, t, inset, "slots", low, sub, "ribs", handles);
  const side = (x: BoxBracing) => x.panels.find((p) => p.id === "sideL")?.hz ?? 0;
  assert.ok(side(lowB) < side(b), `${side(lowB).toFixed(0)} vs ${side(b).toFixed(0)} Hz`);
});
