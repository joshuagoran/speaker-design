// The Stack page's totals (lib/speaker/speakerTotals) against the PA page's (lib/pa/totals) for the PA presets, and the
// Speaker page's price against the Cutlist tab's purchased parts, and a tilted member's height.
import { describe, expect, test } from "vite-plus/test";
import { derivePaDesign, paDesignInputsOf } from "../src/lib/pa/paDesign";
import { PA_HORN_FIXINGS, PA_PLINTH_LB, paTotals } from "../src/lib/pa/totals";
import { priceText, speakerPrice, stackTotals } from "../src/lib/speaker/speakerTotals";
import { cabinetBuild, speakerPurchasedParts } from "../src/lib/speaker/speakerBuild";
import { speakerBounds } from "../src/lib/speaker/speakerLayout";
import { braceLb } from "../src/lib/pa/calc";
import { startLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { PLINTH_HEIGHT_IN } from "../src/constants/paLayouts";
import { UI_TEXT } from "../src/constants/uiText";
import { RAD } from "../src/constants/units";
import type { PaLayout, SpeakerSpec, StackSpec } from "../src/types";

/** The PA layout of each PA preset. */
const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/**
 * What the PA page's totals have that the stack leaves out, lb: the plinth (on the Space page, under the stack) and the
 * horn's fixings (the PA totals' estimate; the speaker build weighs the catalog horn alone).
 */
const PA_ONLY_LB = PA_PLINTH_LB + PA_HORN_FIXINGS.lb;

/** Rounding: the PA page shows whole dollars, pounds and inches. */
const ROUND = 0.5;

describe("Stack totals match the PA page's totals for the PA presets", () => {
  for (const [preset, layout] of PRESETS)
    test(preset, () => {
      const cfg = defaultPaDesign(layout);
      const inputs = paDesignInputsOf(cfg);
      const pa = paTotals({ ...inputs, ...derivePaDesign(inputs), subBox: inputs.subBoxDims });
      const { stack, speakers } = startLayers(
        preset,
        { id: "test", name: "test" },
        { pa: cfg, floor: DEFAULT_COVERAGE_LAYOUT },
      );
      const totals = stackTotals(stack, speakers);
      // the same parts, at the same prices
      expect(Math.abs(totals.dollars - pa.price.sum)).toBeLessThan(ROUND);
      expect(totals.partial ? UI_TEXT.partialPriceMark : "").toBe(pa.price.mark);
      // the same boxes and drivers; the PA page adds the plinth and the horn's fixings, and leaves out the braces of the
      // tower's mid chamber, which the speaker build braces by the rule (tests/speaker-build.test.ts)
      const towerMidBraces =
        layout === "tower"
          ? braceLb(cabinetBuild(speakers[0].cabinet).chambers[1].bracing, cfg.wall)
          : 0;
      expect(Math.abs(totals.lb + PA_ONLY_LB - towerMidBraces - pa.stackLb)).toBeLessThan(ROUND);
      // the stack's base is the plinth's top; the PA page measures from the floor
      expect(Math.abs(totals.heightIn + PLINTH_HEIGHT_IN - pa.stackHeightIn)).toBeLessThan(ROUND);
    });
});

test("the Speaker page's price is the Cutlist tab's purchased parts total, marked when a part has no price", () => {
  const { speakers } = startLayers(
    STACK_PRESET.paStack,
    { id: "test", name: "test" },
    { pa: defaultPaDesign(), floor: DEFAULT_COVERAGE_LAYOUT },
  );
  for (const { cabinet } of speakers) {
    const rows = speakerPurchasedParts(cabinet);
    const price = speakerPrice(cabinet);
    expect(price.dollars).toBeCloseTo(
      rows.reduce((sum, r) => sum + (r.unit ?? 0) * r.count, 0),
      9,
    );
    expect(price.partial).toBe(rows.some((r) => r.unit === null));
  }
  expect(priceText({ dollars: 1234.4, partial: true })).toBe(`$1,234${UI_TEXT.partialPriceMark}`);
  expect(priceText({ dollars: 99.6, partial: false })).toBe("$100");
});

describe("a tilted member's highest point sets the stack's height", () => {
  // the PA stack preset: the top (a 15 in box, its horn on its lid) on the sub
  const start = startLayers(
    STACK_PRESET.paStack,
    { id: "test", name: "test" },
    { pa: defaultPaDesign("stack"), floor: DEFAULT_COVERAGE_LAYOUT },
  );
  const [sub, top] = start.speakers;
  const [horn] = speakerBounds(top.cabinet).topHorns;
  /** the top's bottom: on the sub's lid, its gap above it */
  const base = speakerBounds(sub.cabinet).layout.size.h + start.stack.members[1].pose.yIn;
  /** the stack with the top tilted in the stack and its cabinet kicked back, degrees */
  const tilted = (pitchDeg: number, tiltDeg = 0) => {
    const stack: Pick<StackSpec, "members"> = {
      members: start.stack.members.map((m, k) =>
        k === 1 ? { ...m, pose: { ...m.pose, pitchDeg } } : m,
      ),
    };
    const speakers: SpeakerSpec[] = [sub, { ...top, cabinet: { ...top.cabinet, tiltDeg } }];
    return stackTotals(stack, speakers).heightIn;
  };

  test("the preset stands as built: the horn's top over the top over the sub", () => {
    expect(horn).toBeDefined();
    expect(tilted(0)).toBeCloseTo(base + horn.y + horn.h, 9);
  });

  test("+15 deg: the front turns up about the bottom front edge, the horn's top front corner is highest", () => {
    // turning about the bottom front edge, a point (up y, back z) rises to y cos + z sin(-pitch)
    const p = 15 * RAD;
    expect(tilted(15)).toBeCloseTo(base + (horn.y + horn.h) * Math.cos(p), 9);
    expect(tilted(15)).toBeLessThan(tilted(0));
  });

  test("-10 deg: the back rises, the horn's top back corner is highest", () => {
    const p = 10 * RAD;
    expect(tilted(-10)).toBeCloseTo(
      base + (horn.y + horn.h) * Math.cos(p) + (horn.z + horn.d) * Math.sin(p),
      9,
    );
    expect(tilted(-10)).toBeGreaterThan(tilted(0));
  });

  test("the cabinet's kick-back tilts it as the tilt in the stack does, the two added", () => {
    expect(tilted(0, 15)).toBeCloseTo(tilted(15), 9);
    expect(tilted(-10, 25)).toBeCloseTo(tilted(15), 9);
    expect(tilted(0, -10)).toBeCloseTo(tilted(-10), 9);
  });
});
