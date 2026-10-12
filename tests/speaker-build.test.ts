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
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { hifiCutParts } from "../src/lib/hifi/cutlist";
import { RADIATOR_PANEL } from "../src/lib/hifi/hifi";
import {
  braceLb,
  braceParts,
  cutParts,
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
import { towerMidDims } from "../src/lib/pa/tower";
import { hornById, CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, EMPTY_SPEAKER } from "../src/lib/defaults";
import { SHELL_CUT_BOX, chamberCutBox } from "../src/constants/cutParts";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_PATH,
  SPEAKER_PART,
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

test("speaker build: an arched top cuts on a frame only, and a horn-loaded chamber takes no braces", () => {
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
  assert.equal(cabinetBuild(horn.cabinet).chambers[0].bracing, null);
});

test("speaker build: the net air counts the braces; the build is worked out once per cabinet", () => {
  const big = withCabinet({ chambers: [chamberAt({ xIn: 0, yIn: 0 }, { w: 30, h: 40, d: 30 })] });
  const build = cabinetBuild(big.cabinet);
  assert.equal(cabinetBuild(big.cabinet), build, "remembered");
  const [c] = build.chambers;
  assert.ok(c.bracing && c.bracing.windowIn3 + c.bracing.ribIn3 > 0, "a big box takes braces");
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
