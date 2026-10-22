// Handles and input plates (lib/build/hardware): the presets' fit checks, the liters their recesses take off the boxes,
// the cutlist's cutout notes and the defaults older saves load with.
import { PORT_STYLE } from "../src/constants/portStyles";
import { test } from "vite-plus/test";
import assert from "node:assert";
import { DEFAULT_PA } from "../src/lib/defaults";
import {
  formatInches,
  subBoxBracing,
  subDriverCenter,
  subHardwarePlan,
  subKeepOut,
  subVentMasses,
} from "../src/lib/acoustics/boxModels";
import { subDriverDepthIn } from "../src/lib/build/tubes";
import { portOfEffectiveLength, ventTuningHz } from "../src/lib/acoustics/hornModel";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import {
  boxCenterOfGravity,
  DEFAULT_HARDWARE,
  handlePart,
  HORN_POSTS_FIT_DEPTH_IN,
  partRecessLiters,
  planBoxHardware,
} from "../src/lib/build/hardware";
import { HANDLES, HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../src/data/catalog/cabinet-hardware";
import { NO_HANDLES } from "../src/constants/hardware";
import type { BoxHandles, CutPart, CutPartId, PaHardware, PortStyle, VentSpec } from "../src/types";
import { close } from "./helpers";
import { paDesignWith, paMidBuild, paSubBuild, type PaBuildHardware } from "./pa-build";

const d = DEFAULT_PA;
const t = d.wall;
const vent: VentSpec = { ...d.cVent, div: 0.5 };
const IN3_TO_L = 16.387 / 1000;
const subPlan = (
  handles: BoxHandles = DEFAULT_HARDWARE.sub,
  style: PortStyle = d.portStyle,
  v = vent,
) => subHardwarePlan(d.cDim, t, d.inset, style, v, d.sub, undefined, handles);
/** The default design with the test's vent and `hardware` (the default handles on both boxes when absent). */
const design = (hardware: PaHardware = DEFAULT_HARDWARE) => paDesignWith({ cVent: vent, hardware });
/** The mid box's hardware plan in the Speaker build. */
const midPlan = () => paMidBuild(design(), "design").build.hardware;
const hitsOf = (plan: ReturnType<typeof subPlan>) =>
  plan.parts.map((p) => `${p.panel} ${p.kind}: ${p.hits.join(", ")}`).join(" | ");

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
  const bare = paSubBuild(design(), "none"),
    fitted = paSubBuild(design(), "design");
  const handle = handlePart(DEFAULT_HARDWARE.sub.model);
  assert.ok(handle);
  // the two handles take room; the dish, the jacks and the posts none
  const liters = 2 * partRecessLiters(handle, t);
  close(null, fitted.build.recessL, liters, 1e-12);
  close(null, bare.netL - fitted.netL, liters, 1e-9);
  /** a build's tuning, Hz: its net air with its vent (the engine's duct by the vent's effective length) */
  const fbOf = (g: typeof bare) =>
    (g.vent &&
      ventTuningHz(
        g.netL,
        portOfEffectiveLength(
          g.vent.areaIn2 * CM2_PER_IN2,
          (g.vent.lenIn + g.vent.endCorrectionIn) * CM_PER_IN,
        ),
      )) ??
    NaN;
  assert.ok(fbOf(fitted) > fbOf(bare), "a smaller box tunes higher on the same vent");
  // the box's hardware plan counts the same liters
  close(null, subPlan().liters, liters, 1e-12);
  // no handles: only the dish, which takes none; the tower's mid chamber has no hardware of its own
  const none: PaHardware = {
    ...DEFAULT_HARDWARE,
    sub: { ...DEFAULT_HARDWARE.sub, model: NO_HANDLES },
  };
  assert.equal(paSubBuild(design(none), "design").build.recessL, 0);
  const towerMid = paMidBuild(
    paDesignWith({ layout: "tower", hardware: DEFAULT_HARDWARE }),
    "design",
  );
  assert.equal(towerMid.build.hardware, null);
  assert.equal(towerMid.build.recessL, 0);
});

test("the cutlist notes each cutout on its panel, from a named edge", () => {
  /** the sub's and the mid's cutlists in the Speaker build, with the hardware or with none */
  const cut = (hardware: PaBuildHardware) => ({
    sub: paSubBuild(design(), hardware).parts(d.joint),
    mid: paMidBuild(design(), hardware).parts(d.joint),
  });
  const row = (parts: CutPart[], part: CutPartId) => {
    const r = parts.find((p) => p.part === part);
    assert.ok(r, part);
    return r.note;
  };
  const plain = cut("none");
  const fitted = cut("design");
  for (const box of ["sub", "mid"] as const)
    for (const part of ["side", "topBottom", "back"] as const)
      assert.ok(
        !row(plain[box], part).includes("cutout for"),
        `${box} ${part}: no hardware, no note`,
      );
  const s = subPlan(),
    m = midPlan();
  assert.ok(m);
  const side = row(fitted.sub, "side");
  const handle = handlePart(DEFAULT_HARDWARE.sub.model);
  assert.ok(handle?.cutout);
  assert.ok(side.startsWith(row(plain.sub, "side")), "the joint's note stays first");
  assert.ok(
    side.includes(
      `${formatInches(handle.cutout.w)}″ wide × ${formatInches(handle.cutout.h)}″ high cutout for the ${handle.name} handle, both sides, center ${formatInches(s.parts[0].u)}″ from the front edge and ${formatInches(s.parts[0].v)}″ from the bottom edge`,
    ),
    side,
  );
  const back = row(fitted.sub, "back");
  assert.ok(
    back.includes(
      `4″ wide × 2 1/2″ high cutout for the ${INPUT_PLATE.name} input dish, back, centered side to side, center ${formatInches(s.parts[2].v - t / 2)}″ from the bottom edge; 2 × ${INPUT_JACK.name}`,
    ),
    back,
  );
  // the horn's posts on the mid's top only; the sub's top takes none
  assert.ok(!row(fitted.sub, "topBottom").includes("cutout for"));
  const top = row(fitted.mid, "topBottom");
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
  const fitted = paSubBuild(
    design({ ...DEFAULT_HARDWARE, sub: { ...DEFAULT_HARDWARE.sub, model: "H1105" } }),
    "design",
  ).parts(d.joint);
  const note = fitted.find((p) => p.part === "side")?.note ?? "";
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
        center: subDriverCenter(d.cDim, t, PORT_STYLE.slot, v, d.sub.size),
        lb: d.sub.lb,
        depthIn: subDriverDepthIn(d.sub),
      },
      bracing: subBoxBracing(d.cDim, t, d.inset, PORT_STYLE.slot, v, d.sub, undefined),
      keepOut: subKeepOut(d.cDim, t, d.inset, PORT_STYLE.slot, v, d.sub, undefined, true),
      ventMasses: masses ? subVentMasses(d.cDim, t, PORT_STYLE.slot, v) : [],
    });
  const slot = { ...vent, len: 12 };
  // the box's hardware plan counts the vent: the same as the plan given its panels
  assert.deepStrictEqual(subPlan(DEFAULT_HARDWARE.sub, PORT_STYLE.slot, slot), plan(true, slot));
  assert.ok(
    plan(true, slot).parts[0].v < plan(false, slot).parts[0].v,
    "lower with the shelf and fins",
  );
  // a folded slot adds its rear wall: three panels, and the handles still sit lower than without the vent
  const folded = { ...vent, len: d.cDim.d + 4 };
  assert.equal(subVentMasses(d.cDim, t, PORT_STYLE.slot, folded).length, 3);
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
