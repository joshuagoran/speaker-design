// The Speaker page's price against the Cutlist tab's purchased parts, and a tilted member's height in the Stack page's totals
// (lib/speaker/speakerTotals).
import { describe, expect, test } from "vite-plus/test";
import { priceText, speakerPrice, stackTotals } from "../src/lib/speaker/speakerTotals";
import { speakerPurchasedParts } from "../src/lib/speaker/speakerBuild";
import { speakerBounds } from "../src/lib/speaker/speakerLayout";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { UI_TEXT } from "../src/constants/uiText";
import { RAD } from "../src/constants/units";
import type { SpeakerSpec, StackSpec } from "../src/types";

test("the Speaker page's price is the Cutlist tab's purchased parts total, marked when a part has no price", () => {
  const { speakers } = presetLayers(STACK_PRESET.paStack, { id: "test", name: "test" });
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
  const start = presetLayers(STACK_PRESET.paStack, { id: "test", name: "test" });
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
