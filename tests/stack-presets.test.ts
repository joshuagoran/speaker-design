// The Stack and Space pages' starts (src/pages/stack/stackPresets): the PA presets in each layout and the Hi-fi pair,
// read in as speakers, a stack and a space. A PA start takes its band Gains from the Speaker's Calculate gains, flat,
// the highest 0 dB in each speaker, and its box Gains from the Stack's Calculate gains, flat; every placement at 0 dB.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { STACK_PRESETS, presetLayers } from "../src/pages/stack/stackPresets";
import {
  autoBalanceStack,
  withCalculatedBandGains,
  withStackLevels,
} from "../src/lib/speaker/autoBalance";
import { AUTO_BALANCE_STATUS } from "../src/constants/autoBalance";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { DesignLayers } from "../src/types";

const ID = { id: "draft", name: "Start" };

/** Every band Level of the layers' speakers. */
const bandLevels = (layers: DesignLayers) =>
  layers.speakers.flatMap((s) => s.bands.map((b) => b.levelDb));

test("stack starts: every start gives a stack whose members are all modeled, with a music limit", () => {
  for (const start of STACK_PRESETS) {
    const layers = presetLayers(start, ID);
    assert.equal(layers.stack.id, ID.id, start);
    assert.ok(layers.stack.members.length > 0, start);
    const response = stackResponse(layers.stack, layers.speakers);
    assert.ok(
      response.members.every((m) => m !== null),
      start,
    );
    assert.notEqual(stackLimits(layers.stack, response).musicDb, null, start);
    assert.ok(layers.space.placements.length > 0, start);
  }
});

test("stack starts: a PA start has its calculated band Gains, the highest 0 dB", () => {
  for (const start of STACK_PRESETS) {
    if (start === STACK_PRESET.hifiPair) continue;
    const layers = presetLayers(start, ID);
    const levels = bandLevels(layers);
    assert.ok(
      levels.every((db) => db <= 0),
      `${start}: ${levels.join(", ")}`,
    );
    assert.ok(
      levels.some((db) => db === 0),
      `${start}: ${levels.join(", ")}`,
    );
    // the horn is far more sensitive than the cones: the balance pads it hardest
    const horn = layers.speakers
      .flatMap((s) => s.bands)
      .find((b) => b.id === SPEAKER_BAND.high)?.levelDb;
    assert.ok(horn !== undefined && horn === Math.min(...levels), `${start}: horn ${horn}`);
    // the boxes balanced flat: the loudest box at 0 dB, the others at or under it
    const boxes = layers.stack.members.map((m) => m.levelDb);
    assert.equal(Math.max(...boxes), 0, start);
    assert.ok(
      layers.space.placements.every((p) => p.levelDb === 0),
      start,
    );
  }
});

test("stack starts: a PA preset is the PA design read in, its speakers and boxes at their calculated Gains", () => {
  const read = layersFromPa(defaultPaDesign("satellite"), ID, DEFAULT_COVERAGE_LAYOUT);
  const layers = presetLayers(STACK_PRESET.paSatellite, ID);
  const speakers = read.speakers.map(withCalculatedBandGains);
  assert.deepStrictEqual(layers.speakers, speakers);
  const boxes = autoBalanceStack({ stack: read.stack }, stackResponse(read.stack, speakers));
  assert.equal(boxes.status, AUTO_BALANCE_STATUS.balanced);
  if (boxes.status !== AUTO_BALANCE_STATUS.balanced) return;
  assert.deepStrictEqual(layers.stack, withStackLevels({ stack: read.stack }, boxes.levels).stack);
  // the sub and the top start at different Gains: the flat balance moved one
  assert.notDeepStrictEqual(boxes.levels, [0, 0]);
  assert.deepStrictEqual(layers.space, read.space);
});

test("stack starts: the Hi-fi pair reads in through its adapter", () => {
  assert.deepStrictEqual(
    presetLayers(STACK_PRESET.hifiPair, ID),
    layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, ID),
  );
});
