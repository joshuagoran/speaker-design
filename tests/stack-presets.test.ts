// The Stack and Space pages' starts (src/pages/stack/stackPresets): the PA presets in each layout and the Hi-fi pair,
// read in as speakers, a stack and a space. A PA start keeps the PA page's music balance in its band Levels
// (lib/speaker/paBalance), the highest 0 dB, every member and placement at 0 dB; the space plays each band at that
// balance (tests/space-coverage.test.ts). The presets' Levels are saved data (src/data/presets/pa-band-levels.ts).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { STACK_PRESETS, presetLayers } from "../src/pages/stack/stackPresets";
import { type PaBandLevels } from "../src/lib/speaker/paBalance";
import { PA_PRESET_BAND_LEVELS } from "../src/data/presets/pa-band-levels";
import { presetLevels } from "./preset-levels";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { DesignLayers } from "../src/types";

const ID = { id: "draft", name: "Start" };

/** Whether a band is one the PA balance sets. */
const isPaBandId = (id: string): id is keyof PaBandLevels =>
  id === SPEAKER_BAND.low || id === SPEAKER_BAND.mid || id === SPEAKER_BAND.high;

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

test("stack starts: a PA start keeps the music balance in its band Levels, the highest 0 dB", () => {
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
    assert.ok(
      layers.stack.members.every((m) => m.levelDb === 0),
      start,
    );
    assert.ok(
      layers.space.placements.every((p) => p.levelDb === 0),
      start,
    );
  }
});

test("stack starts: a PA preset is the PA design read in with its saved Levels in its bands", () => {
  const read = layersFromPa(defaultPaDesign("satellite"), ID, DEFAULT_COVERAGE_LAYOUT);
  const saved = PA_PRESET_BAND_LEVELS.satellite;
  const layers = presetLayers(STACK_PRESET.paSatellite, ID);
  for (const speaker of layers.speakers)
    for (const band of speaker.bands)
      if (isPaBandId(band.id))
        assert.equal(band.levelDb, saved[band.id], `${speaker.id} ${band.id}`);
  // the rest is the adapter's: the same speakers apart from their Levels, the same members apart from theirs
  const flat = (l: DesignLayers) => ({
    speakers: l.speakers.map((s) => ({ ...s, bands: s.bands.map((b) => ({ ...b, levelDb: 0 })) })),
    members: l.stack.members.map((m) => ({ ...m, levelDb: 0 })),
  });
  assert.deepStrictEqual(flat(layers), flat(read));
});

test("stack starts: the saved preset Levels are what the balance gives now (else run vp run preset-levels)", () => {
  assert.deepStrictEqual(PA_PRESET_BAND_LEVELS, presetLevels());
});

test("stack starts: the Hi-fi pair reads in through its adapter", () => {
  assert.deepStrictEqual(
    presetLayers(STACK_PRESET.hifiPair, ID),
    layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, ID),
  );
});
