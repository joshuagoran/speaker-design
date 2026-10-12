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
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import { OLD_SAVE_COLLECTIONS, OLD_SAVE_KIND } from "../src/constants/speakerSpec";
import { DRAFT_STACK_ID } from "../src/pages/stack/stackSaves";
import { DUCT_DIVIDER_DEFAULT, PLYWOOD_MATERIAL } from "../src/constants/panelSizes";
import { panelIn } from "../src/lib/panel";
import type {
  PaDesignConfig,
  PaLayout,
  PaPlannerDesign,
  SavedConfig,
  SavedHifiConfig,
  StackDesign,
} from "../src/types";

const LAYOUTS: readonly PaLayout[] = ["stack", "pole", "satellite", "tower"];

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

test("old saves: a full PA save opens as the design it holds, in every layout", () => {
  for (const layout of LAYOUTS) {
    const design = startingPa(layout);
    assert.deepStrictEqual(paDesignFromSaved(design), design, layout);
  }
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
    assert.equal(design.stack.name, seed.name);
    assert.equal(design.stack.id, DRAFT_STACK_ID);
    assert.ok(design.stack.members.length > 0, seed.name);
    assert.ok(allModeled(design), seed.name);
  }
});

test("old saves: a PA save opens as layersFromPa reads its design", () => {
  const design = startingPa("satellite");
  const opened = stackFromOldSave({ kind: OLD_SAVE_KIND.pa, doc: doc(design, "Sat") });
  const read = layersFromPa(design, { id: DRAFT_STACK_ID, name: "Sat" }, DEFAULT_COVERAGE_LAYOUT);
  assert.deepStrictEqual(opened, { stack: read.stack, speakers: read.speakers });
});

/** The starting Hi-fi design as the Hi-fi page saves it. */
const hifiSave = (): SavedHifiConfig => {
  const d = DEFAULT_HIFI;
  return {
    woofer: d.woofer.id,
    tweeter: d.tweeter.id,
    box: d.boxType,
    dim: d.boxDims,
    port: d.portSpec,
    pr: d.radiatorSelection,
    wall: 0.75,
    panel: d.wallPanel,
    xo: d.crossoverHz,
    wAmpW: d.wooferAmpWatts,
    tAmpW: d.tweeterAmpWatts,
    guide: d.selectedWaveguide.id,
    mat: d.panelMaterial,
    order: d.crossoverOrder,
    bsc: d.baffleStepCompensationDb,
    place: d.placement,
    wallFt: d.distanceToWallFt,
    spacing: d.speakerSpacingFt,
    toe: d.toeInDeg,
    seat: d.listeningSeat,
    earIn: d.earHeightIn,
    standIn: d.standHeightIn,
    roundover: d.roundoverIn,
    tweeterOffset: d.tweeterOffsetIn,
    cabFinish: DEFAULT_HIFI_LOOK.cabFinish,
    baffleColor: DEFAULT_HIFI_LOOK.baffleColor,
    summary: "",
  };
};

test("old saves: a full Hi-fi save opens as the design it holds; an empty one as the starting design", () => {
  for (const saved of [hifiSave(), {}]) {
    const { state, look } = hifiDesignFromSaved(saved);
    assert.deepStrictEqual(state, DEFAULT_HIFI);
    assert.deepStrictEqual(look, DEFAULT_HIFI_LOOK);
  }
});

test("old saves: a Hi-fi save changes what it holds, and opens as a modeled stack of one", () => {
  const saved = { ...hifiSave(), xo: 2400, toe: 5, woofer: "no-such-woofer" };
  const { state, look } = hifiDesignFromSaved(saved);
  assert.equal(state.crossoverHz, 2400);
  assert.equal(state.toeInDeg, 5);
  assert.equal(state.woofer, DEFAULT_HIFI.woofer);
  const opened = stackFromOldSave({ kind: OLD_SAVE_KIND.hifi, doc: doc(saved, "Den") });
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
