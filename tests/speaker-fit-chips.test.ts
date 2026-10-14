// The Speaker page's chamber fit checks (src/lib/speaker/fitChips chamberFitChips) against the PA page's: on every
// golden PA design, the sub chamber's duct and tube checks are the sub section's, and each box's hardware check reads
// as the PA page's (the same severity; the Speaker page names the chamber, the PA page the box).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { evaluateDesign } from "../src/lib/pa/optimize";
import { hardwareChip } from "../src/lib/pa/chips";
import { midHardwarePlan, subHardwarePlan } from "../src/lib/pa/calc";
import { towerMidDims } from "../src/lib/pa/tower";
import { MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { cabinetBuild } from "../src/lib/speaker/speakerBuild";
import { chamberFitChips } from "../src/lib/speaker/fitChips";
import { SPEAKER_PART } from "../src/constants/speakerSpec";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign, speakerAndFeed } from "./speaker-cases";
import type { Chip, PaPlannerDesign } from "../src/types";

/** Each PA check id and the Speaker page's id for the same check. */
const SAME_CHECK = [
  ["subDuctFit", "speakerDuctFit"],
  ["subTubeFit", "speakerTubeFit"],
] as const;

/** A check's severity and detail, by id, from a list. */
const byId = (chips: readonly Chip[], id: string) =>
  chips.filter((c) => c[3] === id).map(([severity, title, detail]) => [severity, title, detail]);

/** The design's sub chamber and top box fit checks, as the Speaker page shows them. */
function speakerFits(cfg: PaPlannerDesign, name: string) {
  const tower = cfg.layout === "tower";
  const read = layersFromPa(cfg, { id: "pa", name }, PA_FLOOR);
  const sub = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub).spec;
  const top = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top).spec;
  return {
    sub: chamberFitChips(sub.cabinet, cabinetBuild(sub.cabinet))[0],
    top: tower ? null : chamberFitChips(top.cabinet, cabinetBuild(top.cabinet))[0],
  };
}

test("speaker fit chips: the golden PA designs' duct, tube and hardware checks match the PA page", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const page = evaluateDesign(cfg);
    assert.ok(page, c.name);
    const fits = speakerFits(cfg, c.name);
    for (const [pa, speaker] of SAME_CHECK)
      assert.deepEqual(byId(fits.sub, speaker), byId(page.chips.sub, pa), `${c.name}: ${pa}`);
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
    assert.ok(sub && mid);
    const { wall, inset, braceStyle, backJoint, hardware, layout } = cfg;
    const subPlan = subHardwarePlan(
      cfg.cDim,
      wall,
      inset,
      cfg.portStyle,
      cfg.cVent,
      sub,
      braceStyle,
      hardware.sub,
      backJoint,
    );
    const severity = (chips: readonly Chip[] | null) =>
      chips?.find((ch) => ch[3] === "speakerHardwareFit")?.[0] ?? null;
    assert.equal(severity(fits.sub), hardwareChip(subPlan)[0], `${c.name}: sub hardware`);
    const midDims = layout === "tower" ? towerMidDims(cfg.cDim) : cfg.mDim;
    const midPlan = midHardwarePlan(
      midDims,
      wall,
      inset,
      mid,
      layout,
      braceStyle,
      hardware.mid,
      backJoint,
    );
    if (midPlan) assert.equal(severity(fits.top), hardwareChip(midPlan)[0], `${c.name}: mid hw`);
  }
});

test("speaker fit chips: a duct longer than the chamber holds fails its check, as on the PA page", () => {
  const cfg = paDesign(configs[0]);
  const long = { ...cfg, cVent: { ...cfg.cVent, len: 200 } };
  const fits = speakerFits(long, "long duct");
  const page = evaluateDesign(long);
  assert.ok(page);
  const duct = byId(fits.sub, "speakerDuctFit");
  assert.equal(duct.length, 1);
  assert.equal(duct[0][0], "bad");
  assert.deepEqual(duct, byId(page.chips.sub, "subDuctFit"));
});
