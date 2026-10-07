// Handles and input plates (lib/pa/hardware): the presets' fit checks, the liters their recesses take off the boxes,
// the cutlist's cutout notes and the defaults older saves load with.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { DEFAULT_PA } from "../src/lib/defaults";
import {
  cutParts,
  formatInches,
  hardwareCutNotes,
  hardwarePlace,
  midHardwarePlan,
  midSystem,
  subBoxBracing,
  subDriverCenter,
  subGeometry,
  subHardwarePlan,
  subKeepOut,
  subVentMasses,
} from "../src/lib/pa/calc";
import { subDriverDepthIn } from "../src/lib/pa/tubes";
import {
  boxCenterOfGravity,
  DEFAULT_HARDWARE,
  hardwareFits,
  hardwareLb,
  hardwareLiters,
  handlePart,
  HORN_POSTS_FIT_DEPTH_IN,
  partRecessLiters,
  planBoxHardware,
  savedHardware,
} from "../src/lib/pa/hardware";
import { HANDLES, HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../src/data/catalog/cabinet-hardware";
import { hardwareChip } from "../src/lib/pa/chips";
import { evaluateDesign } from "../src/lib/pa/optimize";
import { HANDLE_AXIS_NAMES, NO_HANDLES, handleOffsetLabel } from "../src/constants/hardware";
import type {
  BoxBracing,
  BoxHandles,
  PaDesignConfig,
  PaHardware,
  PortStyle,
  VentSpec,
} from "../src/types";
import { close } from "./helpers";

const d = DEFAULT_PA;
const t = d.wall;
const vent: VentSpec = { ...d.cVent, div: 0.5 };
const IN3_TO_L = 16.387 / 1000;
const subPlan = (
  handles: BoxHandles = DEFAULT_HARDWARE.sub,
  style: PortStyle = d.portStyle,
  v = vent,
) => subHardwarePlan(d.cDim, t, d.inset, style, v, d.sub, undefined, handles);
const midPlan = (handles: BoxHandles = DEFAULT_HARDWARE.mid) =>
  midHardwarePlan(d.mDim, t, d.inset, d.mid, d.layout, undefined, handles);
const hitsOf = (plan: ReturnType<typeof subPlan>) =>
  plan.parts.map((p) => `${p.panel} ${p.kind}: ${p.hits.join(", ")}`).join(" | ");

test("the default boxes take their handles, dish and posts with nothing in the way", () => {
  const s = subPlan();
  const m = midPlan();
  assert.ok(m, "the stack's mid box has hardware");
  assert.ok(hardwareFits(s), hitsOf(s));
  assert.ok(hardwareFits(m), hitsOf(m));
  // two handles, one each side at the same place, then the dish on the back (and the mid's posts on the lid)
  assert.deepStrictEqual(
    s.parts.map((p) => `${p.panel} ${p.kind}`),
    ["sideL handle", "sideR handle", "back plate"],
  );
  assert.deepStrictEqual(
    m.parts.map((p) => `${p.panel} ${p.kind}`),
    ["sideL handle", "sideR handle", "back plate", "top posts"],
  );
  assert.equal(s.parts[0].u, s.parts[1].u);
  assert.equal(s.parts[0].v, s.parts[1].v);
  // the dish sits low on the back: just over the sub's bottom slot, at the mid's bottom edge clearance
  const band = vent.slotH + t;
  const plate = s.parts[2];
  close(null, plate.v - t, band + INPUT_PLATE.cutout.h / 2, 0.26);
  close(null, plate.u, d.cDim.w / 2, 1e-9);
  assert.equal(hardwareChip(s)[0], "ok");
});

test("handles sit at the center-of-gravity height and move with the offsets", () => {
  const base = subPlan();
  const up = subPlan({ ...DEFAULT_HARDWARE.sub, upIn: 2, backIn: 1 });
  close(null, up.parts[0].v, base.parts[0].v + 2, 1e-9);
  close(null, up.parts[0].u, base.parts[0].u + 1, 1e-9);
  // at the center of gravity's height: the walls, baffle, driver (above the bottom slot) and the slot's own panels
  const cog = boxCenterOfGravity(
    d.cDim,
    t,
    d.inset,
    {
      center: subDriverCenter(d.cDim, t, d.portStyle, vent, d.sub.size),
      lb: d.sub.lb,
      depthIn: subDriverDepthIn(d.sub),
    },
    subVentMasses(d.cDim, t, d.portStyle, vent),
  );
  close(null, base.parts[0].v, cog.y, 1e-9);
});

test("a handle that runs into the vent, an edge, a rib or the driver says so", () => {
  // side ducts run up both side walls: the handles' recesses land in them
  const side = subPlan(DEFAULT_HARDWARE.sub, "vslots", { ...vent, throat: 2 });
  assert.ok(
    side.parts.filter((p) => p.kind === "handle").every((p) => p.hits.includes("vent")),
    hitsOf(side),
  );
  const chip = hardwareChip(side);
  assert.equal(chip[0], "warn");
  assert.ok(chip[2].includes("the vent"), chip[2]);
  // pushed up past the lid: the panel's edge and joint
  const high = subPlan({ ...DEFAULT_HARDWARE.sub, upIn: 8 + d.cDim.h / 2 });
  assert.ok(high.parts[0].hits.includes("edge"), hitsOf(high));
  // a rib on each side across the handles' place
  const inner = { x: d.cDim.w - 2 * t, y: d.cDim.h - 2 * t, z: d.cDim.d - d.inset - 0.75 - t };
  const z = subPlan().parts[0].u - d.inset - 0.75;
  const ribbed: BoxBracing = {
    style: "ribs",
    targetHz: 280,
    windows: { x: [], y: [], z: [] },
    notch: null,
    ribs: (["sideL", "sideR"] as const).map((panel) => ({
      panel,
      across: "z",
      at: [z],
      from: 0,
      len: inner.y,
    })),
    panels: [],
    windowIn3: 0,
    ribIn3: 0,
    meets: true,
    driverOnBaffleHz: null,
  };
  const withRibs = planBoxHardware({
    box: "sub",
    dims: d.cDim,
    t,
    inset: d.inset,
    handles: DEFAULT_HARDWARE.sub,
    driver: { center: { x: inner.x / 2, y: inner.y / 2 }, lb: 0, depthIn: 0 },
    bracing: ribbed,
    keepOut: { driver: [], vent: [] },
  });
  // the parts go first and the bracing around them: a rib laid without the recesses is caught, not dodged
  assert.ok(
    withRibs.parts.filter((p) => p.kind === "handle").every((p) => p.hits.includes("rib")),
    hitsOf(withRibs),
  );
  assert.deepStrictEqual(
    withRibs.parts.map((p) => [p.u, p.v]),
    planBoxHardware({
      box: "sub",
      dims: d.cDim,
      t,
      inset: d.inset,
      handles: DEFAULT_HARDWARE.sub,
      driver: { center: { x: inner.x / 2, y: inner.y / 2 }, lb: 0, depthIn: 0 },
      bracing: null,
      keepOut: { driver: [], vent: [] },
    }).parts.map((p) => [p.u, p.v]),
  );
  // a driver body filling the box: no place for the handles clears it, and they say so
  const full = { x: [0, inner.x], y: [0, inner.y], z: [0, inner.z] } as const;
  const crowded = planBoxHardware({
    box: "mid",
    dims: d.cDim,
    t,
    inset: d.inset,
    handles: DEFAULT_HARDWARE.mid,
    driver: { center: { x: inner.x / 2, y: inner.y / 2 }, lb: 0, depthIn: 0 },
    bracing: null,
    keepOut: { driver: [full], vent: [] },
  });
  assert.ok(crowded.parts[0].hits.includes("driver"), hitsOf(crowded));
});

test("each recess's liters come off the box's net volume, and the tuning follows", () => {
  const h1105 = HANDLES.find((h) => h.id === "H1105");
  assert.ok(h1105);
  // Parts Express's drawing: a 175 × 115 mm cutout, 63 mm deep over the 5 mm flange (58 mm from the panel's face)
  close(
    null,
    partRecessLiters(h1105, t),
    ((175 * 115) / 25.4 ** 2) * (58 / 25.4 - t) * IN3_TO_L,
    1e-12,
  );
  // the dish is shallower than the wall, and the posts' depth isn't listed: neither takes room
  assert.equal(partRecessLiters(INPUT_PLATE, t), 0);
  assert.equal(partRecessLiters(HORN_POSTS, t), 0);
  assert.equal(partRecessLiters(INPUT_JACK, t), 0);
  const cfg = {
    subBox: d.cDim,
    midDims: d.mDim,
    wall: t,
    inset: d.inset,
    portStyle: d.portStyle,
    cVent: vent,
    layout: d.layout,
  };
  const bare = subGeometry(d.sub, d.mid, cfg),
    fitted = subGeometry(d.sub, d.mid, { ...cfg, hardware: DEFAULT_HARDWARE });
  const liters = hardwareLiters(DEFAULT_HARDWARE, "sub", t, d.layout);
  const handle = handlePart(DEFAULT_HARDWARE.sub.model);
  assert.ok(handle);
  close(null, liters, 2 * partRecessLiters(handle, t), 1e-12);
  close(null, fitted.recessL, liters, 1e-12);
  close(null, bare.netL - fitted.netL, liters, 1e-9);
  assert.ok(fitted.Fb > bare.Fb, "a smaller box tunes higher on the same vent");
  // the planner's plan counts the same liters
  close(null, subPlan().liters, liters, 1e-12);
  const mcfg = {
    midDims: d.mDim,
    wall: t,
    inset: d.inset,
    xoLo: d.xoLo,
    xoHi: d.xoHi,
    xoLoOrder: d.xoLoOrder,
    xoHiOrder: d.xoHiOrder,
    mAmpW: d.mAmpW,
    layout: d.layout,
  };
  const m0 = midSystem(d.mid, mcfg),
    m1 = midSystem(d.mid, { ...mcfg, hardware: DEFAULT_HARDWARE });
  close(null, m0.netL - m1.netL, hardwareLiters(DEFAULT_HARDWARE, "mid", t, d.layout), 1e-9);
  // no handles: only the dish, which takes none; the tower's mid chamber has no hardware of its own
  const none: PaHardware = {
    ...DEFAULT_HARDWARE,
    sub: { ...DEFAULT_HARDWARE.sub, model: NO_HANDLES },
  };
  assert.equal(hardwareLiters(none, "sub", t, d.layout), 0);
  assert.equal(hardwareLiters(DEFAULT_HARDWARE, "mid", t, "tower"), 0);
  assert.equal(hardwareLb(DEFAULT_HARDWARE, "mid", "tower"), 0);
  close(null, hardwareLb(none, "sub", d.layout), INPUT_PLATE.lb + 2 * INPUT_JACK.lb, 1e-12);
});

test("the cutlist notes each cutout on its panel, from a named edge", () => {
  const cfg = {
    sub: d.sub,
    mid: d.mid,
    subBox: d.cDim,
    midDims: d.mDim,
    wall: t,
    inset: d.inset,
    joint: d.joint,
    portStyle: d.portStyle,
    cVent: vent,
    layout: d.layout,
  };
  const row = (parts: ReturnType<typeof cutParts>["parts"], box: string, part: string) => {
    const r = parts.find((p) => p.box === box && p.part === part);
    assert.ok(r, `${box} ${part}`);
    return r.note;
  };
  const plain = cutParts(cfg).parts;
  const fitted = cutParts({ ...cfg, hardware: DEFAULT_HARDWARE }).parts;
  for (const box of ["sub", "mid"])
    for (const part of ["side", "topBottom", "back"])
      assert.ok(
        !row(plain, box, part).includes("cutout for"),
        `${box} ${part}: no hardware, no note`,
      );
  const s = subPlan(),
    m = midPlan();
  assert.ok(m);
  const side = row(fitted, "sub", "side");
  const handle = handlePart(DEFAULT_HARDWARE.sub.model);
  assert.ok(handle?.cutout);
  assert.ok(side.startsWith(row(plain, "sub", "side")), "the joint's note stays first");
  assert.ok(
    side.includes(
      `${formatInches(handle.cutout.w)}″ wide × ${formatInches(handle.cutout.h)}″ high cutout for the ${handle.name} handle, both sides, center ${formatInches(s.parts[0].u)}″ from the front edge and ${formatInches(s.parts[0].v)}″ from the bottom edge`,
    ),
    side,
  );
  const back = row(fitted, "sub", "back");
  assert.ok(
    back.includes(
      `4″ wide × 2 1/2″ high cutout for the ${INPUT_PLATE.name} input dish, back, centered side to side, center ${formatInches(s.parts[2].v - t / 2)}″ from the bottom edge; 2 × ${INPUT_JACK.name}`,
    ),
    back,
  );
  // the horn's posts on the mid's top only; the sub's top takes none
  assert.ok(!row(fitted, "sub", "topBottom").includes("cutout for"));
  const top = row(fitted, "mid", "topBottom");
  assert.ok(
    top.includes(
      `2 7/8″ wide × 2 1/8″ front to back cutout for the ${HORN_POSTS.name} horn binding posts, top only, centered side to side, center ${formatInches(d.mDim.d - m.parts[3].v)}″ from the rear edge`,
    ),
    top,
  );
});

test("each handle is mounted as its catalog entry says: the H1105 tall, the 30769 wide", () => {
  const h1105 = HANDLES.find((h) => h.id === "H1105");
  assert.ok(h1105);
  // the default sub is deep enough for the H1105's 220 mm flange lying either way; it stands tall now
  const plan = subPlan({ ...DEFAULT_HARDWARE.sub, model: "H1105" });
  const side = plan.parts[0];
  const tall = side.recess.y[1] - side.recess.y[0],
    wide = side.recess.z[1] - side.recess.z[0];
  assert.ok(tall > wide, `${tall} × ${wide}`);
  close(null, tall, h1105.cutout.w, 1e-9);
  close(null, wide, h1105.cutout.h, 1e-9);
  // the cutlist note gives it the same way round
  const fitted = cutParts({
    sub: d.sub,
    mid: d.mid,
    subBox: d.cDim,
    midDims: d.mDim,
    wall: t,
    inset: d.inset,
    joint: d.joint,
    portStyle: d.portStyle,
    cVent: vent,
    layout: d.layout,
    hardware: { ...DEFAULT_HARDWARE, sub: { ...DEFAULT_HARDWARE.sub, model: "H1105" } },
  }).parts;
  const note = fitted.find((p) => p.box === "sub" && p.part === "side")?.note ?? "";
  // 115 × 175 mm, to the nearest 1/16″
  assert.ok(note.includes(`4 1/2″ wide × 6 7/8″ high cutout for the ${h1105.name}`), note);
  // the 30769 lies wide: its 5 1/4″ side runs front to back
  const compact = subPlan().parts[0];
  assert.ok(compact.recess.z[1] - compact.recess.z[0] > compact.recess.y[1] - compact.recess.y[0]);
  // on a box only 9″ deep the tall H1105 still fits the depth, where lying wide it couldn't
  const shallow = { ...d.cDim, d: 9 };
  const inShallow = subHardwarePlan(shallow, t, d.inset, "round2", vent, d.sub, undefined, {
    ...DEFAULT_HARDWARE.sub,
    model: "H1105",
  });
  assert.ok(!inShallow.parts[0].hits.includes("edge"), hitsOf(inShallow));
});

test("a bottom slot's shelf, fins and folded rear wall pull the sub's handles down", () => {
  const plan = (masses: boolean, v: VentSpec) =>
    planBoxHardware({
      box: "sub",
      dims: d.cDim,
      t,
      inset: d.inset,
      handles: DEFAULT_HARDWARE.sub,
      driver: {
        center: subDriverCenter(d.cDim, t, "slots", v, d.sub.size),
        lb: d.sub.lb,
        depthIn: subDriverDepthIn(d.sub),
      },
      bracing: subBoxBracing(d.cDim, t, d.inset, "slots", v, d.sub, undefined),
      keepOut: subKeepOut(d.cDim, t, d.inset, "slots", v, d.sub, undefined, true),
      ventMasses: masses ? subVentMasses(d.cDim, t, "slots", v) : [],
    });
  const slot = { ...vent, len: 12 };
  // the planner's plan counts the vent: the same as the plan given its panels
  assert.deepStrictEqual(subPlan(DEFAULT_HARDWARE.sub, "slots", slot), plan(true, slot));
  assert.ok(
    plan(true, slot).parts[0].v < plan(false, slot).parts[0].v,
    "lower with the shelf and fins",
  );
  // a folded slot adds its rear wall: three panels, and the handles still sit lower than without the vent
  const folded = { ...vent, len: d.cDim.d + 4 };
  assert.equal(subVentMasses(d.cDim, t, "slots", folded).length, 3);
  assert.ok(plan(true, folded).parts[0].v < plan(false, folded).parts[0].v);
  // a side duct's wall and dividers sit at mid-height; round tubes count none
  assert.equal(subVentMasses(d.cDim, t, "vslots", vent).length, 2);
  assert.deepStrictEqual(subVentMasses(d.cDim, t, "round2", vent), []);
});

test("the horn posts' fit check takes an assumed depth, their volume none", () => {
  assert.equal(HORN_POSTS.depthIn, null);
  const m = midPlan();
  assert.ok(m);
  const posts = m.parts[3];
  assert.equal(posts.liters, 0);
  // a window brace an inch under the lid, under the posts: the posts reach it only with the assumed depth
  const inner = { x: d.mDim.w - 2 * t, y: d.mDim.h - 2 * t, z: d.mDim.d - d.inset - 0.75 - t };
  const under = HORN_POSTS_FIT_DEPTH_IN - t;
  const block = {
    x: [0, inner.x],
    y: [inner.y - under + 0.05, inner.y - 0.11],
    z: [0, inner.z],
  } as const;
  const withBlock = planBoxHardware({
    box: "mid",
    dims: d.mDim,
    t,
    inset: d.inset,
    handles: { ...DEFAULT_HARDWARE.mid, model: NO_HANDLES },
    driver: { center: { x: inner.x / 2, y: inner.y / 2 }, lb: 0, depthIn: 0 },
    bracing: null,
    keepOut: { driver: [block], vent: [] },
  });
  const p = withBlock.parts.find((x) => x.kind === "posts");
  assert.ok(p?.hits.includes("driver"), hitsOf(withBlock));
});

test("a design saved before the hardware loads with the default handles, and reads as the planner has it", () => {
  assert.deepStrictEqual(savedHardware(undefined), DEFAULT_HARDWARE);
  assert.deepStrictEqual(savedHardware(null), DEFAULT_HARDWARE);
  assert.deepStrictEqual(savedHardware("H1105"), DEFAULT_HARDWARE);
  // a box missing, a stale model, or an offset that isn't a number: each falls back alone
  assert.deepStrictEqual(
    savedHardware({
      sub: { model: "30769", upIn: 1.5, backIn: -2 },
      mid: { model: "gone", upIn: "x" },
    }),
    {
      sub: { model: "30769", upIn: 1.5, backIn: -2 },
      mid: { model: DEFAULT_HARDWARE.mid.model, upIn: 0, backIn: 0 },
    },
  );
  assert.deepStrictEqual(savedHardware({ sub: { model: NO_HANDLES } }), {
    sub: { model: NO_HANDLES, upIn: 0, backIn: 0 },
    mid: DEFAULT_HARDWARE.mid,
  });
  // the defaults are what the planner starts on
  assert.deepStrictEqual(DEFAULT_PA.hardware, DEFAULT_HARDWARE);
  // the optimizers disregard the hardware: an old save, the defaults and no handles all evaluate alike
  const { hardware: _drop, ...old } = DEFAULT_PA;
  void _drop;
  const c: PaDesignConfig = {
    ...old,
    sub: d.sub.id,
    mid: d.mid.id,
    cd: d.cd.id,
    horn: d.horn.id,
    format: d.format.id,
    cabinet: d.cabinet.id,
    midBox: d.midBox.id,
    cVent: vent,
  };
  const a = evaluateDesign(c),
    b = evaluateDesign({ ...c, hardware: DEFAULT_HARDWARE }),
    none = evaluateDesign({
      ...c,
      hardware: { sub: { ...DEFAULT_HARDWARE.sub, model: NO_HANDLES }, mid: DEFAULT_HARDWARE.mid },
    });
  assert.ok(a && b && none);
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a, none);
});

test("placement messages share one pattern: the sliders differ by the axis word, the cutlist and Details by nothing", () => {
  const strip = (axis: keyof typeof HANDLE_AXIS_NAMES, s: string) =>
    s.replace(HANDLE_AXIS_NAMES[axis], "AXIS");
  assert.equal(
    strip("upIn", handleOffsetLabel("upIn")),
    strip("backIn", handleOffsetLabel("backIn")),
  );
  // the cutlist's notes carry the same place words Details shows, for every part
  const s = subPlan({ model: "H1105", upIn: 1, backIn: -1 });
  const notes = hardwareCutNotes(s, d.cDim, t);
  for (const p of s.parts)
    assert.ok(
      Object.values(notes).some((n) => n.includes(hardwarePlace(p, d.cDim, t))),
      `${p.panel} ${p.kind}`,
    );
  // the chip agrees with the fit check, for a fitting plan and a clashing one
  assert.equal(hardwareChip(s)[0] === "ok", hardwareFits(s));
  const high = subPlan({ ...DEFAULT_HARDWARE.sub, upIn: 8 + d.cDim.h / 2 });
  assert.equal(hardwareChip(high)[0] === "ok", hardwareFits(high));
  assert.ok(!hardwareFits(high));
});
