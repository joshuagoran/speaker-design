// The one read adapter for old saves (src/pages/stack/oldSaves): a PA page save (`configs`) or a Hi-fi page save
// (`hifiConfigs`) opens as speakers and a stack. A full save opens as the design it holds; an older save that lacks
// fields takes the pages' starting designs for them; retired values read as the pages read them.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  hifiDesignFromSaved,
  oldSavesOf,
  paDesignFromSaved,
  stackFromOldSave,
} from "../src/pages/stack/oldSaves";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { paBalancedLayers } from "../src/lib/speaker/paBalance";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_PA } from "../src/lib/defaults";
import {
  CD_OPTIONS,
  HIFI_PASSIVES,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_BOXES,
  MID_OPTIONS,
  SUB_OPTIONS,
} from "../src/lib/data";
import { needsWaveguide } from "../src/lib/hifi/hifi";
import { HANDLES } from "../src/data/catalog/cabinet-hardware";
import { HORN_MOUNT_DEFAULT, HORN_MOUNT_PLY } from "../src/constants/hornMount";
import {
  OLD_SAVE_COLLECTIONS,
  OLD_SAVE_KIND,
  type OldSaveKind,
} from "../src/constants/speakerSpec";
import { usePaDesign, type PaDesign } from "../src/pages/pa-stack/hooks/usePaDesign";
import { useHifiPlanner, type HifiPlanner } from "../src/pages/hifi/useHifiPlanner";
import { runSteps } from "./render-steps";
import { DRAFT_STACK_ID } from "../src/pages/stack/stackSaves";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../src/constants/panelSizes";
import { panelIn } from "../src/lib/panel";
import type {
  HifiDesignState,
  PaDesignConfig,
  PaLayout,
  PaPlannerDesign,
  SavedConfig,
  SavedHifiConfig,
  StackDesign,
} from "../src/types";

const LAYOUTS: readonly PaLayout[] = ["stack", "pole", "satellite", "tower"];
/** The name the read-in stacks take in these tests. */
const ID = { id: DRAFT_STACK_ID, name: "Old" };

/** A document as a store hands it over: the save's fields, its id and its name. */
const doc = (fields: object, name = "Old save"): SavedConfig => ({ ...fields, id: "doc1", name });

/** Every member of a stack modeled: each has a response. */
const allModeled = ({ stack, speakers }: StackDesign) =>
  stackResponse(stack, speakers).members.every((m) => m !== null);

/**
 * The PA page's starting design in `layout` as the page holds it: its vent carries the side ducts' dividers at their
 * thickness, as the page's snapshot does.
 */
const startingPa = (layout?: PaLayout): PaPlannerDesign => {
  const design = defaultPaDesign(layout);
  const div = panelIn(DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL, {});
  return { ...design, cVent: { ...design.cVent, div } };
};

/** Another entry than `not` in a catalog table, that `ok` takes. */
function other<T extends { id: string }>(
  list: readonly T[],
  not: string,
  ok: (t: T) => boolean = () => true,
): T {
  const found = list.find((t) => t.id !== not && ok(t));
  if (!found) throw new Error(`no other entry than ${not}`);
  return found;
}

/** The PA save fields the cutlist reads (the speakers don't): the adapter leaves them at the defaults. */
const CUTLIST_KEYS = new Set(["joint", "kerf", "trim", "grain", "waterfall", "offcut", "cuts"]);
/** The fields every PA save holds the same: the one format and cabinet, and no measured thicknesses. */
const FIXED_KEYS = new Set(["format", "cabinet", "exactIn"]);

/** A PA save in `layout` whose every design field differs from the starting design's. */
function changedPa(layout: PaLayout): PaPlannerDesign {
  const d = defaultPaDesign();
  const panel = "1/2";
  const handle = other(HANDLES, DEFAULT_PA.hardware.sub.model).id;
  return {
    ...d,
    sub: other(SUB_OPTIONS, d.sub, (s) => s.size === DEFAULT_PA.sub.size).id,
    mid: other(MID_OPTIONS, d.mid, (m) => m.size === DEFAULT_PA.mid.size).id,
    midBox: other(MID_BOXES, DEFAULT_PA.midBox.id).id,
    cd: other(CD_OPTIONS, d.cd, (c) => c.exit === DEFAULT_PA.cd.exit).id,
    horn: other(HORN_OPTIONS, d.horn, (h) => h.exit === DEFAULT_PA.horn.exit).id,
    portStyle: "round2",
    cDim: { w: 30, h: 38, d: 22 },
    cVent: {
      slotH: 4,
      nt: 3,
      dia: 4,
      throat: 3,
      len: 12,
      div: panelIn("3/4", PLYWOOD_MATERIAL, {}),
    },
    hpf: 27,
    hpType: "LR48",
    ampW: 1200,
    portMax: 20,
    mDim: { w: 17, h: 17, d: 13 },
    wall: panelIn(panel, PLYWOOD_MATERIAL, {}),
    panel,
    divider: "3/4",
    inset: 0.5,
    braceStyle: "window",
    backJoint: "glued",
    xoLo: 100,
    xoHi: 1200,
    xoLoOrder: 8,
    xoHiOrder: 8,
    mAmpW: 600,
    tilt: 4,
    hfAmpW: 150,
    hfTilt: 5,
    layout,
    hardware: {
      sub: { model: handle, upIn: 1, backIn: 1 },
      mid: { model: handle, upIn: 1, backIn: 1 },
    },
    baffleColor: "#123456",
    hornColor: "#654321",
    hornMount: HORN_MOUNT_PLY,
    cabFinish: "walnut",
    spacerH: 36,
  };
}

/** The design the PA page holds, every field set (as the Speaker page reads it, `paPlannerDesign`). */
const pageDesign = (h: PaDesign): PaPlannerDesign => ({
  ...h.snapshot(),
  panel: h.wallPanel,
  hornMount: h.hornMount,
  spacerH: h.spacerHeightIn,
  hardware: h.hardware,
  divider: h.ductDividerPanel,
});

/** A design's speakers and stack, read in under one name. */
const readIn = (design: PaPlannerDesign) => {
  const { stack, speakers } = layersFromPa(design, ID, DEFAULT_COVERAGE_LAYOUT);
  return { stack, speakers };
};

test("old saves: a PA save opens with every design field it holds, in every layout", () => {
  const start = defaultPaDesign();
  for (const layout of LAYOUTS) {
    const saved = changedPa(layout);
    const read = paDesignFromSaved(saved);
    for (const [key, value] of Object.entries(saved)) {
      if (CUTLIST_KEYS.has(key) || FIXED_KEYS.has(key) || key === "summary") continue;
      // the save itself differs from the starting design on this field
      if (layout !== start.layout || key !== "layout")
        assert.notDeepStrictEqual(
          value,
          Reflect.get(start, key),
          `${layout} ${key} is the default`,
        );
      assert.deepStrictEqual(Reflect.get(read, key), value, `${layout} ${key}`);
    }
  }
});

test("old saves: a PA save opens as the PA page's own restore loads it", () => {
  const saves: [string, Partial<PaDesignConfig>][] = [
    ["changed, stack", changedPa("stack")],
    ["changed, tower", changedPa("tower")],
    ["changed, satellite", changedPa("satellite")],
    // an older save that lacks most fields: both take the starting design's
    ["older", { sub: changedPa("pole").sub, cDim: { w: 28, h: 34, d: 20 }, layout: "pole" }],
  ];
  for (const [what, saved] of saves)
    runSteps<PaDesign>(
      () => usePaDesign({ dispersionPlane: "h" }),
      [
        (h) => h.restore(saved),
        (h) =>
          assert.deepStrictEqual(readIn(paDesignFromSaved(saved)), readIn(pageDesign(h)), what),
      ],
    );
});

test("old saves: a PA save that lacks fields takes the PA page's starting design for them", () => {
  assert.deepStrictEqual(paDesignFromSaved({}), startingPa());
  assert.deepStrictEqual(paDesignFromSaved({ layout: "tower" }), startingPa("tower"));
});

test("old saves: retired PA values read as the PA page reads them", () => {
  const old = {
    ...startingPa(),
    // the retired folded port reads as slots, the retired L-bracket as the default mount
    portStyle: "folded",
    hornMount: "bracket",
    // an unknown driver keeps the starting design's
    sub: "no-such-sub",
  };
  const read = paDesignFromSaved(old as Partial<PaDesignConfig>); // boundary: an old document, not today's type
  assert.equal(read.portStyle, "slots");
  assert.equal(read.hornMount, HORN_MOUNT_DEFAULT);
  assert.equal(read.sub, defaultPaDesign().sub);
});

test("old saves: every seed design opens as a stack whose members are all modeled", () => {
  // boundary: the seed file is saved PA configurations, as the PA page stores them
  const seeds = JSON.parse(
    fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
  ) as SavedConfig[];
  assert.ok(seeds.length > 0);
  for (const seed of seeds) {
    const design = stackFromOldSave({ kind: OLD_SAVE_KIND.pa, doc: seed });
    assert.ok(design, seed.name);
    assert.equal(design.stack.name, seed.name);
    assert.equal(design.stack.id, DRAFT_STACK_ID);
    assert.ok(design.stack.members.length > 0, seed.name);
    assert.ok(allModeled(design), seed.name);
  }
});

test("old saves: a PA save opens as layersFromPa reads its design, with its music balance", () => {
  const design = startingPa("satellite");
  const opened = stackFromOldSave({ kind: OLD_SAVE_KIND.pa, doc: doc(design, "Sat") });
  const identity = { id: DRAFT_STACK_ID, name: "Sat" };
  const read = paBalancedLayers(design, layersFromPa(design, identity, DEFAULT_COVERAGE_LAYOUT));
  assert.deepStrictEqual(opened, { stack: read.stack, speakers: read.speakers });
  // the balance moved the Levels off the adapter's own (the horn well under the sub)
  const levels = opened?.speakers.flatMap((s) => s.bands.map((b) => b.levelDb)) ?? [];
  assert.ok(Math.min(...levels) < -10, String(levels));
});

test("old saves: a save that doesn't read as its page's opens as nothing, not a broken stack", () => {
  const bad: [OldSaveKind, object][] = [
    [OLD_SAVE_KIND.pa, { layout: "bogus" }],
    [OLD_SAVE_KIND.pa, { cDim: { w: "wide", h: 30, d: 18 } }],
    [OLD_SAVE_KIND.pa, { mDim: null }],
    [OLD_SAVE_KIND.hifi, { box: "bogus" }],
    [OLD_SAVE_KIND.hifi, { dim: { w: 10, h: Number.NaN, d: 12 } }],
  ];
  for (const [kind, fields] of bad)
    assert.equal(stackFromOldSave({ kind, doc: doc(fields) }), null, JSON.stringify(fields));
});

/** A Hi-fi save whose every field differs from the starting design's. */
function changedHifi(): SavedHifiConfig {
  const d = DEFAULT_HIFI;
  const mat = "mdf";
  return {
    woofer: other(HIFI_WOOFERS, d.woofer.id, (w) => w.size === d.woofer.size && !!w.ts).id,
    tweeter: other(
      HIFI_TWEETERS,
      d.tweeter.id,
      (t) => needsWaveguide(t) === needsWaveguide(d.tweeter),
    ).id,
    box: "radiator",
    dim: { w: 11, h: 18, d: 13 },
    port: { n: 2, dia: 2.5, len: 7 },
    pr: { id: other(HIFI_PASSIVES, d.radiatorSelection.id).id, n: 1, addG: 10 },
    wall: panelIn("1/2", mat, {}),
    panel: "1/2",
    xo: 2400,
    wAmpW: 150,
    tAmpW: 80,
    guide: other(HIFI_WAVEGUIDES, d.selectedWaveguide.id).id,
    mat,
    order: 8,
    bsc: 2,
    place: "wall",
    wallFt: 3,
    spacing: 8,
    toe: 10,
    seat: { x: 1, y: 9 },
    earIn: 40,
    standIn: 26,
    roundover: 0.5,
    tweeterOffset: 1,
    cabFinish: "walnut",
    baffleColor: "#123456",
    summary: "",
  };
}

/** The Hi-fi design the Hi-fi page holds: its state fields, as the Speaker page reads them. */
const hifiPageState = (h: HifiPlanner): HifiDesignState => {
  const state: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_HIFI)) state[key] = Reflect.get(h, key);
  return state as unknown as HifiDesignState; // boundary: every HifiDesignState key copied from the planner just above
};

test("old saves: a Hi-fi save opens with every field it holds", () => {
  const saved = changedHifi();
  const { state, look } = hifiDesignFromSaved(saved);
  const d = DEFAULT_HIFI;
  const held: [keyof HifiDesignState, unknown, unknown][] = [
    ["woofer", state.woofer.id, saved.woofer],
    ["tweeter", state.tweeter.id, saved.tweeter],
    ["selectedWaveguide", state.selectedWaveguide.id, saved.guide],
    ["boxType", state.boxType, saved.box],
    ["boxDims", state.boxDims, saved.dim],
    ["portSpec", state.portSpec, saved.port],
    ["radiatorSelection", state.radiatorSelection, saved.pr],
    ["wallPanel", state.wallPanel, saved.panel],
    ["panelMaterial", state.panelMaterial, saved.mat],
    ["crossoverHz", state.crossoverHz, saved.xo],
    ["crossoverOrder", state.crossoverOrder, saved.order],
    ["wooferAmpWatts", state.wooferAmpWatts, saved.wAmpW],
    ["tweeterAmpWatts", state.tweeterAmpWatts, saved.tAmpW],
    ["baffleStepCompensationDb", state.baffleStepCompensationDb, saved.bsc],
    ["placement", state.placement, saved.place],
    ["distanceToWallFt", state.distanceToWallFt, saved.wallFt],
    ["speakerSpacingFt", state.speakerSpacingFt, saved.spacing],
    ["toeInDeg", state.toeInDeg, saved.toe],
    ["listeningSeat", state.listeningSeat, saved.seat],
    ["earHeightIn", state.earHeightIn, saved.earIn],
    ["standHeightIn", state.standHeightIn, saved.standIn],
    ["roundoverIn", state.roundoverIn, saved.roundover],
    ["tweeterOffsetIn", state.tweeterOffsetIn, saved.tweeterOffset],
  ];
  for (const [key, read, value] of held) {
    assert.notDeepStrictEqual(read, Reflect.get(d, key), `${key} is the default`);
    assert.deepStrictEqual(read, value, key);
  }
  assert.deepStrictEqual(look, { cabFinish: saved.cabFinish, baffleColor: saved.baffleColor });
});

test("old saves: a Hi-fi save opens as the Hi-fi page's own restoreSavedConfig loads it", () => {
  const saves: [string, Partial<SavedHifiConfig>][] = [
    ["changed", changedHifi()],
    ["older", { xo: 2400, toe: 5 }],
  ];
  for (const [what, saved] of saves)
    runSteps<HifiPlanner>(useHifiPlanner, [
      (h) => h.restoreSavedConfig(saved),
      (h) => {
        const { state, look } = hifiDesignFromSaved(saved);
        const page = layersFromHifi(
          hifiPageState(h),
          { cabFinish: h.cabinetFinish, baffleColor: h.baffleColor },
          ID,
        );
        assert.deepStrictEqual(layersFromHifi(state, look, ID), page, what);
      },
    ]);
});

test("old saves: an empty Hi-fi save opens as the starting design", () => {
  const { state, look } = hifiDesignFromSaved({});
  assert.deepStrictEqual(state, DEFAULT_HIFI);
  assert.deepStrictEqual(look, DEFAULT_HIFI_LOOK);
});

test("old saves: a Hi-fi save opens as a modeled stack of one, an unknown driver as the starting one", () => {
  const saved = { ...changedHifi(), woofer: "no-such-woofer" };
  const { state, look } = hifiDesignFromSaved(saved);
  assert.equal(state.woofer, DEFAULT_HIFI.woofer);
  const opened = stackFromOldSave({ kind: OLD_SAVE_KIND.hifi, doc: doc(saved, "Den") });
  assert.ok(opened);
  const read = layersFromHifi(state, look, { id: DRAFT_STACK_ID, name: "Den" });
  assert.deepStrictEqual(opened, { stack: read.stack, speakers: read.speakers });
  assert.equal(opened.stack.members.length, 1);
  assert.ok(allModeled(opened));
});

test("old saves: the list keys each save by its collection, so the two pages' ids never clash", () => {
  const pa = oldSavesOf(OLD_SAVE_KIND.pa, [doc({})]);
  const hifi = oldSavesOf(OLD_SAVE_KIND.hifi, [doc({})]);
  assert.equal(pa[0].id, `${OLD_SAVE_COLLECTIONS.pa}/doc1`);
  assert.equal(hifi[0].id, `${OLD_SAVE_COLLECTIONS.hifi}/doc1`);
  assert.notEqual(pa[0].id, hifi[0].id);
});
