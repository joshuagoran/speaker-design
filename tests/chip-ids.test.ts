import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import { CHIP_IDS, LIMIT_CHIP_IDS } from "../src/constants/chipIds";
import { designProblems, evaluateDesign } from "../src/lib/pa/optimize";
import { hifiDesignProblems } from "../src/lib/hifi/optimize";
import { fillChips } from "../src/lib/pa/chips";
import { hifiChips, hifiSystem } from "../src/lib/hifi/hifi";
import { HIFI_PASSIVES, HIFI_TWEETERS, HIFI_WOOFERS, MID_BOXES } from "../src/lib/data";
import { DEFAULT_PA } from "../src/lib/defaults";
import { keysOf } from "../src/lib/records";
import type {
  Chip,
  ChipSection,
  Dims3,
  FillChipsInput,
  HifiConfig,
  PaDesignConfig,
  PaEvaluation,
} from "../src/types";

// boundary: the seed file is saved configurations, as the planner stores them (older ones lack mDim)
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as (Omit<PaDesignConfig, "mDim"> & { mDim?: Dims3; midBox?: string })[];
// the fields older saves lack, as the optimizer fills them in
const { xoLo, xoHi, tilt, hfTilt, ampW, mAmpW, hfAmpW, hpType, portMax, wall, inset, layout } =
  DEFAULT_PA;
const filled = {
  xoLo,
  xoHi,
  tilt,
  hfTilt,
  ampW,
  mAmpW,
  hfAmpW,
  hpType,
  portMax,
  wall,
  inset,
  layout,
};
const paDesigns = seeds.flatMap((s) => {
  const c: PaDesignConfig = {
    ...filled,
    ...s,
    mDim: s.mDim ?? (MID_BOXES.find((b) => b.id === s.midBox) || MID_BOXES[0]).box,
  };
  // the seeds as saved, and pushed into more of the checks: a tiny or huge amp, a low or high crossover
  return [
    c,
    { ...c, ampW: 200, mAmpW: 50, hfAmpW: 10 },
    { ...c, ampW: 3000, mAmpW: 2000, hfAmpW: 500 },
    { ...c, xoLo: 300, xoHi: 600 },
    { ...c, xoLo: 80, xoHi: 2500, mDim: { w: 13, h: 13, d: 6 } },
  ];
});
const paEvals = paDesigns
  .map((c) => evaluateDesign(c))
  .filter((m): m is PaEvaluation => m !== null);

const hifiBase: HifiConfig = {
  box: "vented",
  dim: { w: 9, h: 15, d: 11 },
  wall: 0.75,
  port: { n: 1, dia: 2, len: 6 },
  xo: 2000,
  order: 4,
  wAmpW: 100,
  tAmpW: 50,
  bsc: 3,
  place: "free",
  wallFt: 2,
  portMax: 17,
  guide: null,
};
const hifiConfigs: HifiConfig[] = [
  hifiBase,
  { ...hifiBase, xo: 900, port: { n: 1, dia: 2, len: 30 }, tweeterOffsetIn: 9, roundoverIn: 2 },
  { ...hifiBase, box: "sealed", dim: { w: 6, h: 9, d: 6 }, xo: 5000, wAmpW: 500 },
  { ...hifiBase, box: "vented", port: { shape: "slot", n: 1, h: 1, len: 40 } },
  { ...hifiBase, box: "radiator", pr: { drv: HIFI_PASSIVES[0], n: 1, addG: 500 } },
];
const hifiLists = HIFI_WOOFERS.slice(0, 6).flatMap((w) =>
  HIFI_TWEETERS.filter((t) => !t.ownGuide)
    .slice(0, 3)
    .flatMap((t) =>
      hifiConfigs.flatMap((c) => {
        const sys = hifiSystem(w, t, c);
        return sys ? [hifiChips(sys, w, t, c)] : [];
      }),
    ),
);

const fillBase: FillChipsInput = {
  drv: { size: 10 },
  dim: { w: 12, h: 16 },
  Fb: 60,
  Qtc: null,
  hp: 70,
  hpOrder: 4,
  portLimited: true,
  portMax: 20,
  f3: 80,
  hf: { aes: 80 },
  hfLimW: 400,
  ampW: 300,
  pad: 6,
};
const fillLists = [
  fillChips(fillBase),
  fillChips({ ...fillBase, dim: { w: 8, h: 8 }, Fb: 30, f3: 100, hfLimW: 100 }),
  fillChips({ ...fillBase, Fb: null, Qtc: 0.9, hf: null }),
];

const lists: [ChipSection, Chip[][]][] = [
  ["sub", paEvals.map((m) => m.chips.sub)],
  ["mid", paEvals.map((m) => m.chips.mid)],
  ["horn", paEvals.map((m) => m.chips.horn)],
  ["fill", fillLists],
  ["hifi", hifiLists],
];

test("every chip carries an id of its own section, and a list has one chip per check", () => {
  for (const [section, chipLists] of lists) {
    const known = new Set<string>(CHIP_IDS[section]);
    assert.ok(chipLists.length > 0, `${section}: chips to check`);
    for (const chips of chipLists) {
      const ids = chips.map(([, , , id]) => id);
      for (const id of ids) assert.ok(known.has(id), `${section}: ${id} is not in CHIP_IDS`);
      assert.equal(new Set(ids).size, ids.length, `${section}: ${ids.join(", ")}`);
    }
  }
});

test("chip ids are unique across sections, and the limit checks are among them", () => {
  const all = keysOf(CHIP_IDS).flatMap((s) => [...CHIP_IDS[s]]);
  assert.equal(new Set(all).size, all.length);
  for (const id of LIMIT_CHIP_IDS) assert.ok(all.includes(id), id);
});

// renaming every check leaves what fails the same: the problem lists decide on ids, and only report the titles
const renamed = <C extends Chip>(chips: C[]): C[] =>
  chips.map((c): C => {
    const r: C = [...c];
    r[1] = `renamed ${c[3]}`;
    return r;
  });

test("PA problems are decided on ids, not on titles", () => {
  const lim = { maxLb: 1000, budget: 100000 };
  let failing = 0;
  for (const m of paEvals) {
    const before = designProblems(m, lim);
    const after = designProblems(
      {
        ...m,
        chips: {
          sub: renamed(m.chips.sub),
          mid: renamed(m.chips.mid),
          horn: renamed(m.chips.horn),
        },
      },
      lim,
    );
    assert.equal(after.length, before.length, before.join(", "));
    if (before.length) failing++;
  }
  assert.ok(failing > 0, "some designs fail a check");
});

test("Hi-fi problems are decided on ids, not on titles", () => {
  let failing = 0;
  // the system only decides "can't be modelled"; what fails comes from the chips
  const sys = hifiSystem(HIFI_WOOFERS[0], HIFI_TWEETERS[0], hifiBase);
  for (const chips of hifiLists) {
    const before = hifiDesignProblems(sys, chips);
    assert.equal(hifiDesignProblems(sys, renamed(chips)).length, before.length, before.join(", "));
    if (before.length) failing++;
  }
  assert.ok(failing > 0, "some designs fail a check");
});
