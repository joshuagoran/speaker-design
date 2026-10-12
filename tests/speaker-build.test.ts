// The Designer's build of any speaker spec (lib/speaker/speakerBuild) against the PA and Hi-fi pages: the read
// adapters' specs of the golden designs give the PA page's bracing, net air, cutlist and weights, and the Hi-fi page's
// cutlist and weight; and the general rules (shared walls, one shell, an arched top, a horn-loaded chamber).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { STACKS, hifiCases, paDesign, speakerAndFeed } from "./speaker-cases";
import { systemFromPa } from "../src/lib/speaker/paSpec";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import {
  defaultHornPlacement,
  hornCutoutBox,
  hornFits,
  hornFitsWhereSet,
  slotOpeningsAt,
  speakerLayout,
} from "../src/lib/speaker/speakerLayout";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { DESIGNER_TEMPLATES, templateSpeaker } from "../src/pages/designer/designerTemplates";
import { DESIGNER_TEXT } from "../src/constants/designer";
import { hifiCutParts } from "../src/lib/hifi/cutlist";
import { RADIATOR_PANEL } from "../src/lib/hifi/hifi";
import {
  braceLb,
  braceParts,
  cutParts,
  hornCutoutWords,
  midBoxBracing,
  midHardwarePlan,
  midSystem,
  midWeightLb,
  subBoxBracing,
  subHardwarePlan,
  subSystem,
  subWeightLb,
  towerMidWeightLb,
} from "../src/lib/pa/calc";
import { towerHornCutout, towerMidDims } from "../src/lib/pa/tower";
import { DEFAULT_HARDWARE } from "../src/lib/pa/hardware";
import { PA_PANEL_TARGET_HZ } from "../src/lib/pa/bracing";
import {
  BACK_JOINT_FLUSH_NOTES,
  BACK_JOINT_NAMES,
  BACK_JOINT_PARTITION_NOTES,
  GLUED_BACK,
} from "../src/constants/bracing";
import { hornById, CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, EMPTY_SPEAKER } from "../src/lib/defaults";
import { SHELL_CUT_BOX, chamberCutBox } from "../src/constants/cutParts";
import { keysOf } from "../src/lib/records";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPEAKER_PART,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type {
  CornerJoint,
  CutPart,
  PaPlannerDesign,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerSpec,
} from "../src/types";

/** The PA page's numbers for a design, as derivePaDesign works them out (with the design's back joint and handles). */
function paPage(cfg: PaPlannerDesign, joint: CornerJoint) {
  const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
  const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
  const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
  const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
  assert.ok(sub && mid && cd && horn);
  const tower = cfg.layout === "tower";
  const midDims = tower ? towerMidDims(cfg.cDim) : cfg.mDim;
  const { hardware, braceStyle, backJoint, wall, inset, layout } = cfg;
  const s = subSystem(sub, mid, {
    subBox: cfg.cDim,
    midDims: cfg.mDim,
    wall,
    inset,
    portStyle: cfg.portStyle,
    cVent: cfg.cVent,
    hpf: cfg.hpf,
    hpType: cfg.hpType,
    ampW: cfg.ampW,
    portMax: cfg.portMax,
    layout,
    braceStyle,
    backJoint,
    hardware,
    xoLo: cfg.xoLo,
  });
  const m = midSystem(mid, {
    layout,
    braceStyle,
    backJoint,
    hardware,
    midDims,
    wall,
    inset,
    xoLo: cfg.xoLo,
    xoHi: cfg.xoHi,
    xoLoOrder: cfg.xoLoOrder,
    xoHiOrder: cfg.xoHiOrder,
    mAmpW: cfg.mAmpW,
  });
  const vent = [cfg.cDim, wall, inset, cfg.portStyle, cfg.cVent, sub, braceStyle] as const;
  const subBracing = subBoxBracing(...vent, hardware.sub, backJoint);
  const subHw = subHardwarePlan(...vent, hardware.sub, backJoint);
  const midArgs = [midDims, wall, inset, mid, layout, braceStyle, hardware.mid, backJoint] as const;
  const midBracing = midBoxBracing(...midArgs);
  const midHw = midHardwarePlan(...midArgs);
  return {
    subNetL: s.netL,
    midNetL: m.netL,
    subBracing,
    midBracing,
    /** the loaded sub box, and the top box (or the tower's cabinet over the sub box) with its mid, horn and driver */
    subLb: subWeightLb(cfg.cDim, wall, sub.lb, subBracing, subHw.lb),
    topLb:
      (tower
        ? towerMidWeightLb(cfg.cDim, wall, inset, horn, mid)
        : midWeightLb(midDims, wall, midBracing, midHw?.lb ?? 0)) +
      (mid.lb || 0) +
      (horn.lb || 0) +
      (cd.lb || 0),
    parts: cutParts({
      sub,
      mid,
      subBox: cfg.cDim,
      midDims,
      wall,
      inset,
      joint,
      portStyle: cfg.portStyle,
      cVent: cfg.cVent,
      layout,
      braceStyle,
      backJoint,
      hardware,
      horn,
    }).parts,
  };
}

/** A cutlist's pieces by part and size, whatever the box, row and note: each part's count at each size. */
function pieces(parts: readonly CutPart[]) {
  const out = new Map<string, number>();
  for (const p of parts) {
    const k = `${p.part} ${p.a.toFixed(4)} × ${p.b.toFixed(4)} × ${p.t.toFixed(4)}`;
    out.set(k, (out.get(k) ?? 0) + p.qty);
  }
  return out;
}
/** Where two cutlists' pieces differ, as words; empty when they match. */
function piecesDiff(a: readonly CutPart[], b: readonly CutPart[]) {
  const pa = pieces(a),
    pb = pieces(b);
  return [...new Set([...pa.keys(), ...pb.keys()])]
    .filter((k) => pa.get(k) !== pb.get(k))
    .map((k) => `${k}: ${pa.get(k) ?? 0} vs ${pb.get(k) ?? 0}`);
}

/** Weights agree to this, lb (the same arithmetic in another order). */
const LB = 1e-9;

test("speaker build: the golden PA designs match the PA page (bracing, net air, cutlist, weights)", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = systemFromPa(cfg, { id: "pa", name: c.name }, STACKS);
    const subSpec = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub).spec;
    const topSpec = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top).spec;
    const subBuild = cabinetBuild(subSpec.cabinet);
    const topBuild = cabinetBuild(topSpec.cabinet);
    const midIndex = tower ? 1 : 0;
    const midBuild = topBuild.chambers[midIndex];
    for (const joint of ["butt", "rabbet", "miter"] as const) {
      const page = paPage(cfg, joint);
      // the sub: its bracing, net air and weight are the PA page's
      assert.deepEqual(subBuild.chambers[0].bracing, page.subBracing, `${c.name}: sub bracing`);
      const subNet = speakerResponse(subSpec).chambers[0].netLiters;
      assert.ok(Math.abs(subNet - page.subNetL) < 1e-9 * page.subNetL, `${c.name}: sub net air`);
      assert.ok(Math.abs(subBuild.chambers[0].lb.total - page.subLb) < LB, `${c.name}: sub lb`);
      // the mid: its own box's bracing is the PA page's; the tower's mid chamber takes the rule's braces, which the PA
      // page leaves out (in its cutlist, its weight and its net air)
      const midBraces = tower ? midBuild.bracing : null;
      if (!tower) assert.deepEqual(midBuild.bracing, page.midBracing, `${c.name}: mid bracing`);
      const midNet = speakerResponse(topSpec).chambers[midIndex].netLiters;
      assert.ok(midNet < page.midNetL, `${c.name}: the mid's cleats (and braces) take air`);
      const topLb = tower ? topBuild.lb - subBuild.chambers[0].lb.total : topBuild.lb;
      assert.ok(
        Math.abs(topLb - page.topLb - braceLb(midBraces, cfg.wall)) < LB,
        `${c.name}: top lb ${topLb} vs ${page.topLb}`,
      );
      // the cutlist: the same pieces, and in the tower the mid chamber's braces as well
      const parts = [
        ...speakerCutParts(subSpec.cabinet, joint).parts,
        ...(tower ? [] : speakerCutParts(topSpec.cabinet, joint).parts),
      ];
      const extra = midBraces
        ? braceParts(
            chamberCutBox(midIndex),
            midBraces,
            {
              x: midBuild.inside.iw,
              y: midBuild.inside.ih,
              z: midBuild.inside.inD,
            },
            cfg.wall,
          )
        : [];
      assert.deepEqual(piecesDiff(parts, [...page.parts, ...extra]), [], `${c.name} (${joint})`);
    }
  }
});

test("speaker build: the Hi-fi designs match the Hi-fi page (cutlist, weight), braced by the rule", () => {
  for (const { name, state } of hifiCases) {
    const spec = speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const design = deriveHifiDesign(state);
    const sys = design.speakerModel?.speakerSystem;
    assert.ok(sys, name);
    const build = cabinetBuild(spec.cabinet);
    const [chamber] = build.chambers;
    // these boxes' panels all clear the PA target unbraced
    assert.equal((chamber.bracing?.windowIn3 ?? 0) + (chamber.bracing?.ribIn3 ?? 0), 0, name);
    assert.equal(chamber.hardware, null, `${name}: no hardware`);
    // the Hi-fi page's weight, and the waveguide's, which it leaves out
    const guide = spec.cabinet.chambers[0].drivers.flatMap((d) =>
      d.horn ? [hornById(d.horn.hornId)?.lb ?? 0] : [],
    );
    const guideLb = guide.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(build.lb - sys.lb - guideLb) < LB, `${name}: ${build.lb} vs ${sys.lb}`);
    for (const joint of ["butt", "rabbet", "miter"] as const) {
      const page = hifiCutParts({
        cfg: design.speakerConfig,
        woofer: state.woofer,
        tweeter: design.tweeterWithWaveguide,
        joint,
        prPanel: RADIATOR_PANEL,
      });
      const ours = speakerCutParts(spec.cabinet, joint);
      assert.deepEqual(piecesDiff(ours.parts, page.parts), [], `${name} (${joint})`);
      assert.deepEqual(ours.also, page.also, `${name}: bought parts`);
    }
  }
});

/** The empty speaker's spec with a cabinet edit. */
const withCabinet = (edit: Partial<SpeakerCabinet>): SpeakerSpec => ({
  id: "test",
  name: "test",
  ...EMPTY_SPEAKER,
  cabinet: { ...EMPTY_SPEAKER.cabinet, ...edit },
});
const [ONE] = EMPTY_SPEAKER.cabinet.chambers;
/** A chamber like the empty speaker's, at `at`, of `dims`. */
const chamberAt = (at: SpeakerChamber["at"], dims: SpeakerChamber["dims"]): SpeakerChamber => ({
  ...ONE,
  at,
  dims,
});

test("speaker build: chambers that fill one box share one shell; a stepped one builds only its own walls", () => {
  const lower = chamberAt({ xIn: 0, yIn: 0 }, { w: 16, h: 20, d: 14 });
  const upper = chamberAt({ xIn: 0, yIn: 20 }, { w: 16, h: 12, d: 14 });
  const one = withCabinet({ chambers: [lower, upper] });
  const shell = speakerCutParts(one.cabinet, "butt").parts;
  assert.ok(
    shell.some((p) => p.box === SHELL_CUT_BOX && p.part === "baffle"),
    "one baffle",
  );
  const partitions = shell.filter((p) => p.part === "partition");
  assert.equal(partitions.length, 1);
  assert.equal(partitions[0].box, chamberCutBox(0), "the lower chamber builds the partition");
  const t = one.cabinet.panel.thicknessIn;
  assert.equal(partitions[0].a, 16 - 2 * t);
  // a narrower upper chamber: a stepped shell, each chamber a box less the floor the lower one gives it
  const stepped = withCabinet({
    chambers: [lower, chamberAt({ xIn: 2, yIn: 20 }, { w: 12, h: 12, d: 14 })],
  });
  const own = speakerCutParts(stepped.cabinet, "butt").parts;
  assert.ok(!own.some((p) => p.box === SHELL_CUT_BOX));
  const tops = (i: number) =>
    own
      .filter((p) => p.box === chamberCutBox(i) && p.part === "topBottom")
      .reduce((a, p) => a + p.qty, 0);
  assert.deepEqual([tops(0), tops(1)], [2, 1], "the upper chamber's floor is the lower one's top");
  // its inside is its clear face: one wall off its height
  const build = cabinetBuild(stepped.cabinet);
  assert.equal(build.chambers[1].inside.ih, 12 - t);
});

/** One chamber's rows of a part. */
const rowsOf = (parts: readonly CutPart[], i: number, part: CutPart["part"]) =>
  parts.filter((p) => p.box === chamberCutBox(i) && p.part === part && p.qty > 0);

test("speaker build: a chamber beside or on another is sized to itself, for every joint and construction", () => {
  const lower = chamberAt({ xIn: 0, yIn: 0 }, { w: 16, h: 20, d: 14 });
  const upper = chamberAt({ xIn: 2, yIn: 20 }, { w: 12, h: 12, d: 14 });
  const left = chamberAt({ xIn: 0, yIn: 0 }, { w: 10, h: 20, d: 14 });
  const right = chamberAt({ xIn: 10, yIn: 0 }, { w: 12, h: 16, d: 14 });
  for (const construction of [CABINET_CONSTRUCTION.flushBox, CABINET_CONSTRUCTION.frameInset])
    for (const joint of ["butt", "rabbet", "miter"] as const) {
      const at = `${construction}, ${joint}`;
      const stepped = withCabinet({ chambers: [lower, upper], construction, insetIn: 0.75 });
      const stack = speakerCutParts(stepped.cabinet, joint).parts;
      // the sides run each chamber's own height, the upper one's standing on the lower one's top
      for (const [i, c] of [lower, upper].entries())
        for (const side of rowsOf(stack, i, "side"))
          assert.equal(side.b, c.dims.h, `${at}: side ${i}`);
      // its joints only where it has its own walls: no bottom edge on the upper chamber's sides, no left end on the top
      for (const side of rowsOf(stack, 1, "side"))
        assert.ok(!/bottom/.test(side.note), `${at}: ${side.note}`);
      const beside = withCabinet({ chambers: [left, right], construction, insetIn: 0.75 });
      const row = speakerCutParts(beside.cabinet, joint).parts;
      assert.deepEqual(
        [0, 1].map((i) => rowsOf(row, i, "side").reduce((a, p) => a + p.qty, 0)),
        [2, 1],
        `${at}: the right chamber's left side is the left one's right side`,
      );
      for (const [i, c] of [left, right].entries())
        for (const side of rowsOf(row, i, "side"))
          assert.equal(side.b, c.dims.h, `${at}: side ${i}`);
      for (const top of rowsOf(row, 1, "topBottom"))
        assert.ok(!/both ends/.test(top.note), `${at}: ${top.note}`);
      if (construction === CABINET_CONSTRUCTION.flushBox && joint === "butt") {
        // a butt-jointed flush box's fronts cover the cabinet's front, edge to edge, and no more
        const front = (parts: readonly CutPart[], i: number) => rowsOf(parts, i, "baffle")[0];
        assert.equal(front(stack, 0).b + front(stack, 1).b, 32, "the fronts stack to the cabinet");
        assert.equal(front(stack, 1).a, upper.dims.w);
        assert.equal(
          front(row, 0).a + front(row, 1).a,
          22,
          "the fronts side by side make its width",
        );
        assert.equal(rowsOf(row, 1, "back")[0].a, right.dims.w);
      }
      if (construction === CABINET_CONSTRUCTION.frameInset) {
        // a frame's back stops at the neighbor's wall: the clear face and the one rabbet left
        const t = beside.cabinet.panel.thicknessIn;
        assert.equal(rowsOf(row, 1, "back")[0].a, right.dims.w - t + t / 2, `${at}: back`);
        assert.equal(rowsOf(row, 1, "baffle")[0].a, right.dims.w - t, `${at}: baffle`);
      }
    }
});

test("speaker build: every slot of a chamber is cut and takes its air", () => {
  const slotted = (n: number) =>
    withCabinet({
      chambers: [
        {
          ...chamberAt({ xIn: 0, yIn: 0 }, { w: 14, h: 20, d: 14 }),
          vent: {
            kind: VENT_KIND.vented,
            port: { shape: PORT_SHAPE.slot, n, h: 1, w: 10, len: 6 },
            maxSpeedMs: 17,
          },
        },
      ],
    });
  const [one, two] = [1, 2].map((n) => slotted(n));
  const shelves = speakerCutParts(two.cabinet, "butt").parts.filter((p) => p.part === "slotShelf");
  assert.deepEqual(
    shelves.map((p) => p.qty),
    [2],
  );
  assert.ok(
    speakerCutParts(two.cabinet, "butt").parts.some(
      (p) => p.part === "baffle" && /2 × slot/.test(p.note),
    ),
  );
  // stacked from the floor, a slot and a shelf apart, as the cutlist, the 3D view and the front drawing all take them
  const [placed] = speakerLayout(two.cabinet).chambers;
  const port = { n: 2, h: 1, w: 10 };
  const tw = two.cabinet.panel.thicknessIn;
  assert.deepEqual(
    slotOpeningsAt(placed, port, tw).map((o) => o.y - (placed.clear.y - placed.y0)),
    [0, 1 + tw],
  );
  assert.ok(shelves[0].note.includes("undersides 1″"), shelves[0].note);
  const [b1] = cabinetBuild(one.cabinet).chambers;
  const [b2] = cabinetBuild(two.cabinet).chambers;
  const t = one.cabinet.panel.thicknessIn;
  const L = 16.387 / 1000;
  assert.ok(Math.abs(b2.ventL - 2 * b1.ventL) < 1e-9, "both slots' air");
  assert.ok(Math.abs(b2.woodL - b1.woodL - 10 * 6 * t * L) < 1e-9, "both shelves' wood");
});

test("speaker build: a horn sits in the baffle or on the top wherever it fits, whatever its catalog shape", () => {
  const round = HORN_OPTIONS.find((h) => !h.rect && h.size.w <= 10);
  const rect = HORN_OPTIONS.find((h) => h.rect);
  assert.ok(round && rect);
  const lower = chamberAt({ xIn: 0, yIn: 0 }, { w: 20, h: 24, d: 16 });
  const upper = chamberAt({ xIn: 0, yIn: 24 }, { w: 20, h: 16, d: 16 });
  const [low, high] = speakerLayout(withCabinet({ chambers: [lower, upper] }).cabinet).chambers;
  // a small round horn fits both places on the top chamber; the catalog's shape only sets the first choice
  assert.ok(
    hornFits(round, high, HORN_PLACEMENT.baffle) && hornFits(round, high, HORN_PLACEMENT.top),
  );
  assert.equal(defaultHornPlacement(round, high), HORN_PLACEMENT.top);
  assert.equal(defaultHornPlacement(rect, high), HORN_PLACEMENT.baffle);
  // nothing stands on a chamber with another on it
  assert.ok(!hornFits(round, low, HORN_PLACEMENT.top));
  assert.equal(defaultHornPlacement(round, low), HORN_PLACEMENT.baffle);
});

test("speaker build: a horn that no longer fits where it is mounted is left out, and said so", () => {
  // every read adapter's and template's horn fits where it is set
  const specs = [
    ...DESIGNER_TEMPLATES.map(templateSpeaker),
    ...configs.flatMap(
      (c) => systemFromPa(paDesign(c), { id: "pa", name: c.name }, STACKS).speakers,
    ),
  ];
  for (const spec of specs)
    for (const placed of speakerLayout(spec.cabinet).chambers)
      for (const d of placed.chamber.drivers) assert.ok(hornFitsWhereSet(placed, d), spec.name);
  // the PA top box with a chamber stacked on its lid: its horn can't stand there any more
  const cfg = paDesign(configs[0]);
  const top = speakerAndFeed(
    systemFromPa(cfg, { id: "pa", name: "pa" }, STACKS),
    SPEAKER_PART.top,
  ).spec;
  const [mid] = top.cabinet.chambers;
  const stacked: SpeakerCabinet = {
    ...top.cabinet,
    chambers: [mid, { ...mid, at: { xIn: 0, yIn: mid.dims.h }, drivers: [] }],
  };
  const [low] = speakerLayout(stacked).chambers;
  const hornDriver = mid.drivers.find((d) => d.horn);
  assert.ok(hornDriver && !hornFitsWhereSet(low, hornDriver));
  const baffle = speakerCutParts(stacked, "butt").parts.find((p) => p.part === "baffle");
  assert.ok(baffle && baffle.note.includes(DESIGNER_TEXT.hornNoFitNote));
  // no binding posts for a horn that isn't there
  const plan = cabinetBuild(stacked).chambers[0].hardware;
  assert.ok(plan && !plan.parts.some((p) => p.kind === "posts"));
});

test("speaker build: a baffle horn's cutout is one size in the cutlist, the weight and the views", () => {
  const rect = HORN_OPTIONS.find((h) => h.rect);
  const cd = CD_OPTIONS[0];
  assert.ok(rect && cd);
  const left = chamberAt({ xIn: 0, yIn: 0 }, { w: 14, h: 24, d: 16 });
  const right: SpeakerChamber = {
    // taller than its neighbor: a stepped shell, each chamber a box of its own
    ...chamberAt({ xIn: 14, yIn: 0 }, { w: 20, h: 26, d: 16 }),
    drivers: [
      {
        kind: "compression",
        driverId: cd.id,
        count: 1,
        position: { xIn: 0, yIn: 12 },
        bands: [EMPTY_SPEAKER.bands[0].id],
        horn: { hornId: rect.id, placement: HORN_PLACEMENT.baffle, mount: null },
      },
    ],
  };
  const spec = withCabinet({ chambers: [left, right] });
  const t = spec.cabinet.panel.thicknessIn;
  const placed = speakerLayout(spec.cabinet).chambers[1];
  // the chamber beside another cuts within its own clear face (one wall off its width, not two)
  assert.equal(hornCutoutBox(placed, t).w, right.dims.w - t + 2 * t);
  const cut = towerHornCutout(hornCutoutBox(placed, t), t, rect);
  const baffle = speakerCutParts(spec.cabinet, "butt").parts.find(
    (p) => p.box === chamberCutBox(1) && p.part === "baffle",
  );
  assert.ok(baffle, "a baffle");
  assert.ok(baffle.note.includes(`horn cutout ${hornCutoutWords(cut)}`), baffle.note);
});

test("speaker build: one shell's cutlist notes the hardware of the chamber that takes it", () => {
  // listed right then left: the lowest, then leftmost chamber takes the handles and the dish
  const right = chamberAt({ xIn: 12, yIn: 0 }, { w: 12, h: 24, d: 16 });
  const left = chamberAt({ xIn: 0, yIn: 0 }, { w: 12, h: 24, d: 16 });
  const spec = withCabinet({
    chambers: [right, left],
    construction: CABINET_CONSTRUCTION.frameInset,
    insetIn: 0.75,
    hardware: DEFAULT_HARDWARE.sub,
  });
  const build = cabinetBuild(spec.cabinet);
  assert.deepEqual(
    build.chambers.map((c) => c.hardware !== null),
    [false, true],
  );
  const parts = speakerCutParts(spec.cabinet, "butt").parts;
  const side = parts.find((p) => p.box === SHELL_CUT_BOX && p.part === "side");
  const back = parts.find((p) => p.box === SHELL_CUT_BOX && p.part === "back");
  assert.ok(side && /handle/.test(side.note), "the handles' cutouts on the sides");
  assert.ok(back && /input dish/.test(back.note), "the dish's cutout on the back");
});

test("speaker build: an arched top cuts on a frame only, and a horn-loaded chamber's walls are braced", () => {
  const lower = chamberAt({ xIn: 0, yIn: 0 }, { w: 20, h: 24, d: 16 });
  const top = chamberAt({ xIn: 0, yIn: 24 }, { w: 20, h: 14, d: 16 });
  const arched = { chambers: [lower, top], top: CABINET_TOP.arched };
  const frame = withCabinet({
    ...arched,
    construction: CABINET_CONSTRUCTION.frameInset,
    insetIn: 0.75,
  });
  const flush = withCabinet({ ...arched, construction: CABINET_CONSTRUCTION.flushBox });
  assert.ok(speakerCutParts(frame.cabinet, "butt").parts.some((p) => p.part === "archTop"));
  assert.ok(!speakerCutParts(flush.cabinet, "butt").parts.some((p) => p.part === "archTop"));
  // the arch takes the top chamber's square corners off its weight's panels
  const flat = withCabinet({
    chambers: [lower, top],
    construction: CABINET_CONSTRUCTION.frameInset,
  });
  assert.ok(
    cabinetBuild(frame.cabinet).chambers[1].lb.wood <
      cabinetBuild(flat.cabinet).chambers[1].lb.wood,
  );
  const horn = withCabinet({
    chambers: [
      {
        ...chamberAt({ xIn: 0, yIn: 0 }, { w: 24, h: 30, d: 24 }),
        netLiters: 60,
        load: {
          kind: CHAMBER_LOAD.horn,
          horn: {
            throatChamber: 0,
            segments: [{ s1: 400, s2: 2000, length: 50, profile: HORN_PROFILE.exponential }],
            portOffset: 0,
            drive: { kind: HORN_DRIVE.front },
            path: HORN_PATH.straight,
          },
        },
      },
    ],
  });
  // the rear chamber's walls round the flare are braced to the target; the flare holds itself
  const braced = cabinetBuild(horn.cabinet).chambers[0].bracing;
  assert.equal(braced.targetHz, horn.cabinet.braceTargetHz);
  // the keep-out tapers from the mouth to the throat, so braces fit round a small horn in a big box
  assert.ok(braced.windowIn3 + braced.ribIn3 > 0, "braced round its flare");
});

test("speaker build: the back joint sets the bracing and the back's and partitions' notes", () => {
  const lower = chamberAt({ xIn: 0, yIn: 0 }, { w: 16, h: 20, d: 14 });
  const upper = chamberAt({ xIn: 0, yIn: 20 }, { w: 16, h: 12, d: 14 });
  assert.equal(EMPTY_SPEAKER.cabinet.backJoint, GLUED_BACK, "a flush box starts glued");
  for (const backJoint of keysOf(BACK_JOINT_NAMES)) {
    const spec = withCabinet({ chambers: [lower, upper], backJoint });
    const parts = speakerCutParts(spec.cabinet, "butt").parts;
    const back = parts.find((p) => p.part === "back");
    const partition = parts.find((p) => p.part === "partition");
    assert.ok(back && partition);
    assert.ok(back.note.includes(BACK_JOINT_FLUSH_NOTES[backJoint]), backJoint);
    assert.ok(partition.note.includes(BACK_JOINT_PARTITION_NOTES[backJoint]), backJoint);
    assert.ok(!/cleats/.test(partition.note), "a flush box has no baffle cleats");
    assert.equal(cabinetBuild(spec.cabinet).chambers[0].bracing.panels.length, 6);
  }
});

test("speaker build: the bracing target sets how hard the rule braces; the PA's is the default", () => {
  const box = (braceTargetHz: number) =>
    withCabinet({
      chambers: [chamberAt({ xIn: 0, yIn: 0 }, { w: 30, h: 40, d: 30 })],
      braceTargetHz,
    });
  assert.equal(EMPTY_SPEAKER.cabinet.braceTargetHz, PA_PANEL_TARGET_HZ);
  const wood = (hz: number) => {
    const [c] = cabinetBuild(box(hz).cabinet).chambers;
    assert.equal(c.bracing.targetHz, hz);
    return c.bracing.windowIn3 + c.bracing.ribIn3;
  };
  assert.ok(wood(150) < wood(PA_PANEL_TARGET_HZ), "a lower target takes less wood");
  assert.ok(wood(PA_PANEL_TARGET_HZ) < wood(400), "a higher one more");
});

test("speaker build: the net air counts the braces; the build is worked out once per cabinet", () => {
  const big = withCabinet({ chambers: [chamberAt({ xIn: 0, yIn: 0 }, { w: 30, h: 40, d: 30 })] });
  const build = cabinetBuild(big.cabinet);
  assert.equal(cabinetBuild(big.cabinet), build, "remembered");
  const [c] = build.chambers;
  assert.ok(c.bracing.windowIn3 + c.bracing.ribIn3 > 0, "a big box takes braces");
  assert.ok(c.woodL > 0);
  const net = speakerResponse(big).chambers;
  assert.equal(net.length, 1);
  assert.ok(
    Math.abs(c.clearL - c.woodL - c.ventL - c.recessL - net[0].netLiters) < 2,
    "less its drivers too",
  );
  // the default Hi-fi box needs none
  const hifi = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "hifi", name: "hifi" });
  assert.equal(cabinetBuild(hifi.cabinet).chambers[0].woodL, 0);
});
