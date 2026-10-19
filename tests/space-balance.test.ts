// The Space page's target across the bands and where it is measured (lib/speaker/spaceBalance) against the PA Coverage
// page (lib/acoustics/coverage balancedTarget, oneMeterSpot): the PA presets' spaces take the page's target in every band.
import { expect, test } from "vite-plus/test";
import { ONE_METER_FT, RESPONSE_FREQS } from "../src/lib/acoustics/coverage";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { oneMeterSpots, spaceCrossoversHz, spaceTargetAt } from "../src/lib/speaker/spaceBalance";
import { expandPlacements } from "../src/lib/speaker/spaceLayout";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { AUTO_BALANCE_MODE } from "../src/constants/autoBalance";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import { RAD } from "../src/constants/units";
import type { PaLayout, SpaceDesign } from "../src/types";

const PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/** A PA preset as a space on the coverage page's default floor. */
function presetSpace(preset: (typeof PRESETS)[number][0]): SpaceDesign {
  const read = presetLayers(preset, { id: "test", name: "test" });
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

test("Space target: flat, the same target in every band", () => {
  const design = presetSpace(STACK_PRESET.paStack);
  const crossovers = spaceCrossoversHz(design);
  for (const f of RESPONSE_FREQS)
    expect(spaceTargetAt(100, f, crossovers, AUTO_BALANCE_MODE.flat)).toBe(100);
});

test("Space levels: a design with no room of its own measures at the audience average, flat", () => {
  const { venue } = layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, {
    id: "h",
    name: "Hi-fi",
  }).space;
  expect(venue.levelRef).toBe(COVERAGE_LEVEL_REF.audience);
  expect(venue.balance).toBe(AUTO_BALANCE_MODE.flat);
});

test("Space levels: 1 m from each box, along its aim (a mirrored pair's boxes mirrored)", () => {
  const design = presetSpace(STACK_PRESET.paStack);
  const spots = oneMeterSpots(design, design.space.venue.room);
  const boxes = expandPlacements(design.space.placements);
  expect(spots).toHaveLength(boxes.length);
  boxes.forEach((p, k) => {
    const a = p.aim.yawDeg * RAD;
    expect(spots[k].x).toBeCloseTo(p.x + Math.sin(a) * ONE_METER_FT, 9);
    expect(spots[k].y).toBeCloseTo(p.y + Math.cos(a) * ONE_METER_FT, 9);
  });
  expect(spots[1].x).toBeCloseTo(-spots[0].x, 9);
});
