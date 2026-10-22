import { PORT_STYLE } from "../src/constants/portStyles";
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  defaultBraceStyle,
  defaultBraceStyleNear,
  baysHz,
  braceBox,
  braceShortfalls,
  WINDOW_RAIL_IN,
  RIB_FREE_END_IN,
  RIB_DEPTH_IN,
  RIB_DEPTHS_IN,
  RIB_MIN_RUN_SHARE,
  ribRunAxis,
  screwSlipModulus,
  gammaFactor,
  jointedTeeBeam,
  teeBeam,
} from "../src/lib/build/bracing";
import { NO_SUPPORTS, paBoxPanels, PA_PANEL_TARGET_HZ } from "../src/lib/build/boxBracing";
import {
  subVentLines,
  paPanelStock,
  subBoxBracing,
  subKeepOut,
  driverKeepOut,
  braceWoodIn3,
  braceParts,
} from "../src/lib/acoustics/boxModels";
import { MID_DEPTH_FALLBACK_IN } from "../src/data/catalog/driver-cutouts";
import {
  RIB_HALF_LAP_NOTE,
  braceUnderNote,
  savedBackJoint,
  GLUED_BACK,
  DEFAULT_BACK_JOINT,
  bracePanelName,
  savedBraceStyle,
} from "../src/constants/bracing";
import { braceNoteLines } from "../src/lib/build/bracingNotes";
import { formatHz } from "../src/lib/format";
import { DEFAULT_PA } from "../src/lib/defaults";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import { close, vent } from "./helpers";
import { configs } from "./pa-configs";
import { paDesign } from "./speaker-cases";
import { paDesignWith, paMidBuild, paSubBox, paSubBuild } from "./pa-build";

/** The box names the brace notes are worded with. */
const BOX_NAMES = { sub: "Sub", mid: "Mid" } as const;
import type {
  BoxAxis,
  BoxBracing,
  BracePanelId,
  BoxKeepOut,
  BraceStyleId,
  BackJointId,
  Dims3,
  PortStyle,
} from "../src/types";

/** A PA box's inside spans on the bracing's axes, by hand: two walls off the width and height, and the inset, the 3/4″
 * baffle and the back off the depth. */
const insideOf = (box: Dims3, t: number, inset: number): Record<BoxAxis, number> => ({
  x: box.w - 2 * t,
  y: box.h - 2 * t,
  z: box.d - inset - 0.75 - t,
});
const STYLES: BraceStyleId[] = ["window", "ribs", "both"];
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

/**
 * Each saved and synthetic PA design's sub box, as its rule braces it, and its mid's chamber (its own box, or the tower's
 * middle chamber) as the Speaker page builds it: the inside, the keep-out and the bracing.
 */
function paBoxes(style: BraceStyleId | undefined) {
  return configs.flatMap((c) => {
    const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
    const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
    const wall = c.wall ?? 0.75,
      inset = c.inset ?? 0.75;
    const midBuild = paMidBuild({ ...paDesign(c), braceStyle: style }, "none").build;
    const { iw, ih, inD } = midBuild.inside;
    const out: { name: string; inner: Record<BoxAxis, number>; keep: BoxKeepOut; b: BoxBracing }[] =
      [
        {
          name: `${c.name} sub`,
          inner: insideOf(c.cDim, wall, inset),
          keep: subKeepOut(c.cDim, wall, inset, c.portStyle, c.cVent, sub),
          b: subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style),
        },
        {
          name: `${c.name} mid`,
          inner: { x: iw, y: ih, z: inD },
          // its driver in the middle of its baffle
          keep: {
            driver: driverKeepOut(
              { x: iw / 2, y: ih / 2 },
              mid.size,
              mid.depthIn ?? MID_DEPTH_FALLBACK_IN[mid.size],
            ),
            vent: [],
          },
          b: midBuild.bracing,
        },
      ];
    return out;
  });
}

test("a window brace that ties the sides goes behind the magnet or above or below the driver, never through it", () => {
  for (const { name, inner, keep, b } of paBoxes("window")) {
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
    const a = paBoxes(style),
      again = paBoxes(style);
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

test("a cutout never lifts a bay over the same bay without it; the driver's weight on it lowers it", () => {
  // a bare hole lifts a hinged plate a third (tests/plate-modes.test.ts), but the driver's frame fills it and its
  // stiffness isn't modeled: the bay reads no higher than solid
  const p = { spanU: 21, spanV: 27.5, stock: paPanelStock(0.75) };
  const solid = baysHz(p, [], []);
  const hole = { cx: 10.5, cy: 13.75, r: 8.3 };
  assert.strictEqual(baysHz({ ...p, hole }, [], []), solid);
  assert.ok(baysHz({ ...p, hole: { ...hole, ringKg: 9 } }, [], []) < 0.7 * solid);
});

test("a box whose panels already clear the target takes nothing", () => {
  // a 13″ face: the 10″ mid's weight on its cutout still leaves the baffle over the target (at 15″ it falls under)
  const { bracing: b } = paMidBuild(
    paDesignWith({
      layout: "stack",
      mid: MID_OPTIONS[0].id,
      mDim: { w: 13, h: 13, d: 15 },
      wall: 0.75,
      inset: 0.75,
    }),
    "none",
  ).build;
  assert.strictEqual(b.windowIn3 + b.ribIn3, 0);
  assert.ok(b.panels.every((p) => p.hz === p.bareHz && p.hz >= PA_PANEL_TARGET_HZ));
});

test("the vent's parts count as supports: a slot's shelf lifts the sides, its fins the bottom", () => {
  const box = { w: 24, h: 32, d: 18 },
    cv = vent({ slotH: 3, len: 14 }),
    sub = SUB_OPTIONS[0];
  const hz = (style: PortStyle, id: string) =>
    subBoxBracing(box, 0.75, 0.75, style, cv, sub, "window").panels.find((p) => p.id === id)
      ?.bareHz ?? NaN;
  assert.ok(hz(PORT_STYLE.slot, "sideL") > hz("round2", "sideL"));
  assert.ok(hz(PORT_STYLE.slot, "bottom") > hz("round2", "bottom"));
  assert.ok(hz("vslots", "sideL") > hz("round2", "sideL"));
  assert.ok(hz("vslot1", "sideR") > hz("vslot1", "sideL"), "one duct, on the right");
  // a short slot (under DUCT_SUPPORT_MIN_SHARE of the depth) is left out
  const short = subBoxBracing(
    box,
    0.75,
    0.75,
    PORT_STYLE.slot,
    vent({ slotH: 3, len: 4 }),
    sub,
    "window",
  );
  close(
    { name: "short" },
    short.panels.find((p) => p.id === "sideL")?.bareHz ?? NaN,
    hz("round2", "sideL"),
    1e-9,
  );
});

test("the notes under the Bracing setting name the cabinet and each panel left under the target", () => {
  // a 30″-wide box under Ribs: no rib can cross the driver, so its wide baffle stays bare and under the target
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 30, h: 32, d: 18 },
    0.5,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
  );
  const notes = braceNoteLines(BOX_NAMES.sub, b);
  const under = braceShortfalls(b);
  assert.ok(under.some((p) => p.id === "baffle"));
  assert.deepStrictEqual(
    notes,
    under.map((p) =>
      braceUnderNote(bracePanelName(BOX_NAMES.sub, p.id), formatHz(p.hz), formatHz(b.targetHz)),
    ),
  );
  // a box that needs nothing has no note
  const mid = paMidBuild(paDesignWith({ layout: "stack", wall: 0.75, braceStyle: "ribs" }), "none")
    .build.bracing;
  assert.deepStrictEqual(braceNoteLines(BOX_NAMES.mid, mid), []);
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
    paSubBuild(paDesignWith({ layout: "stack", braceStyle: style }), "none")
      .parts()
      .filter((p) => p.part === "rib")
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

test("ribs: a first pick one way doesn't lock a panel out of the other way when that lifts it more", () => {
  // ⅝″ walls, an 18″ sub in a short, deep box: one rib across the height leaves the sides at 261 Hz and the driver's
  // basket keeps a second off them; one rib up the side (across the depth) clears the target
  const sub = SUB_OPTIONS.find((s) => s.id === "es18lw2420");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 20, h: 24, d: 22 },
    0.625,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
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
    PORT_STYLE.slot,
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

test("short ribs and a short slot: the basket no longer keeps ribs off the sides; the fins hold the floor behind it", () => {
  // ½″ walls, 22 × 32 × 18: the basket ring comes within 2″ of the sides at the baffle, the slot runs 4″ back
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const box = { w: 22, h: 32, d: 18 };
  const b = subBoxBracing(
    box,
    0.5,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
    { ...DEFAULT_PA.cVent, len: 4 },
    sub,
    "ribs",
  );
  const keep = subKeepOut(
    box,
    0.5,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
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
  // the slot's fins run on to the back past its 4″ shelf: they hold the floor, which takes no rib and clears the
  // target, as every other panel but the baffle does
  assert.ok(!b.ribs.some((r) => r.panel === "bottom"));
  for (const p of b.panels) if (p.id !== "baffle") assert.ok(p.hz >= b.targetHz, `${p.id} ${p.hz}`);
  // the slot's room ends two slot heights behind the duct, not at the back
  const slot = keep.vent[0];
  assert.ok(slot.z[1] < insideOf(box, 0.5, DEFAULT_PA.inset).z - 1);
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

test("a screwed back is screwed to the window braces' rear rails: jointed T beams, between bare and glued", () => {
  // the default sub in ¾″ with Window braces: the same two level frames for either back. Glued, their rails work with
  // the back as T beams; screwed, as jointed T beams (Eurocode 5's gamma method), which lift it less
  const d = DEFAULT_PA;
  const plan = (back: BackJointId) =>
    subBoxBracing(d.cDim, 0.75, d.inset, d.portStyle, d.cVent, d.sub, "window", undefined, back);
  const screwedPlan = plan(DEFAULT_BACK_JOINT),
    gluedPlan = plan(GLUED_BACK);
  const back = (b: BoxBracing) => b.panels.find((p) => p.id === "back");
  const screwed = back(screwedPlan),
    glued = back(gluedPlan);
  assert.ok(screwed && glued);
  assert.deepStrictEqual(screwedPlan.windows, gluedPlan.windows);
  assert.strictEqual(screwedPlan.windowIn3, gluedPlan.windowIn3);
  assert.ok(screwed.bareHz < glued.bareHz, "its own edges stay hinged");
  assert.ok(glued.hz > glued.bareHz + 25, `glued: ${glued.hz.toFixed(0)} Hz`);
  assert.ok(
    screwed.hz > screwed.bareHz + 15 && screwed.hz < glued.hz - 30,
    `screwed: ${screwed.hz.toFixed(0)} Hz (bare ${screwed.bareHz.toFixed(0)}, glued ${glued.hz.toFixed(0)})`,
  );
  // with more frames (light block's 30″-wide back) each rail carries less of it, and they lift it further
  const c = configs.find((x) => x.name === "light block");
  assert.ok(c);
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
  const wide = subBoxBracing(c.cDim, 0.75, c.inset ?? 0.75, c.portStyle, c.cVent, sub, "window");
  const wideBack = back(wide);
  assert.ok(
    wideBack && wideBack.hz > wideBack.bareHz + 25,
    `light block: ${wideBack?.hz.toFixed(0)} Hz`,
  );
});

test("a screwed rail by Eurocode 5: the screws' slip modulus, the gamma factor and the jointed T beam", () => {
  // K_ser = ρm^1.5 d / 23 N/mm (Table 7.1): 600 kg/m³, a 4.2 mm screw: 600^1.5 × 4.2 / 23 = 2683.79 N/mm
  close(null, screwSlipModulus(600, 600, 4.2), 2683788.76, 0.01);
  // two densities take their geometric mean
  close(null, screwSlipModulus(400, 900, 4.2), screwSlipModulus(600, 600, 4.2), 1e-6);
  // γ = 1 / (1 + π² E A s / (K L²)): E A = 1e7 N, s = 0.15 m, K = 2.5e6 N/m, L = 0.6 m: 1 / (1 + 16.4493) = 0.0573088
  close(null, gammaFactor(1e7, 0.15, 2.5e6, 0.6), 0.0573088, 1e-6);
  // the default sub's back rail (¾″ birch, 22.5″ span, a 3″ effective flange, #8 screws 6″ apart): ρ = 589.5 kg/m³,
  // K = 2613.7 N/mm, E A = 7.452 GPa × 0.0762 × 0.01905 m² = 1.0817e7 N: γ = 1 / (1 + 19.06) = 0.0498
  const st = paPanelStock(0.75);
  const j = jointedTeeBeam(22.5, 18.35, st, st, WINDOW_RAIL_IN);
  close(null, j.gamma, 0.0498, 5e-4);
  // the jointed beam sits between the bare rail and the glued T section
  const bare = (st.eWeak * (st.t * 0.0254) * (WINDOW_RAIL_IN * 0.0254) ** 3) / 12;
  const glued = teeBeam(22.5, 18.35, st, st, WINDOW_RAIL_IN);
  assert.ok(j.EI > bare && j.EI < glued.EI, `${j.EI} between ${bare} and ${glued.EI}`);
  assert.strictEqual(j.mu, glued.mu);
});

test("rib depths: a long span takes deeper ribs where they lift it more for the wood", () => {
  // a 30″-wide box in ½″: two 5½″ ribs hold its back, where 2½″ ones need a ring with the sides and more wood
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  const b = subBoxBracing(
    { w: 30, h: 32, d: 18 },
    0.5,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
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

test("a rib counts only where it runs most of the panel: none shorter than RIB_MIN_RUN_SHARE of it", () => {
  const sub = SUB_OPTIONS.find((s) => s.id === "bc18nw");
  assert.ok(sub);
  for (const len of [4, 10, 14])
    for (const t of [0.5, 0.625]) {
      const box = { w: 22, h: 32, d: 18 };
      const b = subBoxBracing(
        box,
        t,
        DEFAULT_PA.inset,
        PORT_STYLE.slot,
        { ...DEFAULT_PA.cVent, len },
        sub,
        "ribs",
      );
      const inner = insideOf(box, t, DEFAULT_PA.inset);
      for (const r of b.ribs) {
        const run = ribRunAxis(r.panel, r.across);
        // a rib butting into another in a corner gives up that one's depth there
        assert.ok(
          r.len + 2 * RIB_DEPTHS_IN[2] >= RIB_MIN_RUN_SHARE * inner[run],
          `${len} ${t} ${JSON.stringify(r)}`,
        );
      }
    }
});

test("a straight slot's fins run to the back, and the back's and top's ribs line up on them (C braces)", () => {
  const sub = SUB_OPTIONS.find((s) => s.id === "es18lw2420");
  assert.ok(sub);
  const t = 0.5,
    cVent = { ...DEFAULT_PA.cVent, len: 8 };
  // the fins' lines, in from the left side (subVentLines' bottom)
  const fins = (box: { w: number; h: number; d: number }) =>
    subVentLines(box, t, PORT_STYLE.slot, cVent).bottom;
  const near = (xs: number[], ys: number[]) =>
    xs.length === ys.length && xs.every((x, i) => Math.abs(x - ys[i]) < 1e-9);
  // 30 × 24 × 22: the back's two ribs stand on the fins, up from them
  const wide = { w: 30, h: 24, d: 22 };
  const b = subBoxBracing(wide, t, DEFAULT_PA.inset, PORT_STYLE.slot, cVent, sub, "ribs");
  const back = b.ribs.filter((r) => r.panel === "back");
  assert.ok(back.length === 1 && back[0].across === "x", JSON.stringify(back));
  assert.ok(near(back[0].at, fins(wide)), JSON.stringify(back[0].at));
  assert.ok(Math.abs(back[0].from - cVent.slotH) < 1e-9, `starts ${back[0].from}″ up`);
  // 30 × 34 × 22: the top's two ribs run front to back over the fins
  const tall = { w: 30, h: 34, d: 22 };
  const top = subBoxBracing(
    tall,
    t,
    DEFAULT_PA.inset,
    PORT_STYLE.slot,
    cVent,
    sub,
    "ribs",
  ).ribs.filter((r) => r.panel === "top");
  assert.ok(top.length === 1 && top[0].across === "x", JSON.stringify(top));
  assert.ok(near(top[0].at, fins(tall)), JSON.stringify(top[0].at));
  // and the cutlist's fins run from the front to the back panel
  const fin = paSubBuild(
    paSubBox(wide, PORT_STYLE.slot, cVent, { sub: sub.id, wall: t, inset: DEFAULT_PA.inset }),
    "none",
  )
    .parts()
    .find((p) => p.part === "ductFin");
  assert.equal(fin?.b, wide.d - t);
});
