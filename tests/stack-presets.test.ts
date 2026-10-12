// The Stack and Space pages' starts (src/pages/stack/stackPresets): the PA presets in each layout, the Hi-fi pair and
// the current PA design read in as speakers, a stack and a space. A PA start keeps the PA page's music balance in its
// band Levels (lib/speaker/paBalance), the highest 0 dB, every member and placement at 0 dB; the space plays each band
// at that balance (tests/space-coverage.test.ts). The presets' Levels are saved data (src/data/presets/pa-band-levels.ts);
// the current PA design's are worked out as it is read in.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { STACK_STARTS, startLayers, paLayers } from "../src/pages/stack/stackPresets";
import { paBalancedLayers, paBandLevels, type PaBandLevels } from "../src/lib/speaker/paBalance";
import { PA_PRESET_BAND_LEVELS } from "../src/data/presets/pa-band-levels";
import { presetLevels } from "./preset-levels";
import { DRIVER_KIND } from "../src/constants/speakerSpec";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { STACK_START } from "../src/constants/stackPresets";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { DesignLayers } from "../src/types";

const ID = { id: "draft", name: "Start" };
/** The current PA design the current-design start reads: the PA page's tower, on the PA floor's starting layout. */
const CURRENT = { pa: defaultPaDesign("tower"), floor: DEFAULT_COVERAGE_LAYOUT };

/** Whether a band is one the PA balance sets. */
const isPaBandId = (id: string): id is keyof PaBandLevels =>
  id === SPEAKER_BAND.low || id === SPEAKER_BAND.mid || id === SPEAKER_BAND.high;

/** Every band Level of the layers' speakers. */
const bandLevels = (layers: DesignLayers) =>
  layers.speakers.flatMap((s) => s.bands.map((b) => b.levelDb));

test("stack starts: every start gives a stack whose members are all modeled, with a music limit", () => {
  for (const start of STACK_STARTS) {
    const layers = startLayers(start, ID, CURRENT);
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
  for (const start of STACK_STARTS) {
    if (start === STACK_START.hifiPair) continue;
    const layers = startLayers(start, ID, CURRENT);
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
  const layers = startLayers(STACK_START.paSatellite, ID, CURRENT);
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

test("stack starts: a design the page can't balance in every band keeps the adapter's Levels in all of them", () => {
  const cfg = defaultPaDesign();
  const read = layersFromPa(cfg, ID, DEFAULT_COVERAGE_LAYOUT);
  // the horn band stays in the spec, but no driver plays it: the stack has no level for it
  const stubbed: DesignLayers = {
    ...read,
    speakers: read.speakers.map((s) => ({
      ...s,
      cabinet: {
        ...s.cabinet,
        chambers: s.cabinet.chambers.map((c) => ({
          ...c,
          drivers: c.drivers.filter((d) => d.kind !== DRIVER_KIND.compression),
        })),
      },
    })),
  };
  assert.equal(paBandLevels(cfg, stubbed), null);
  assert.deepStrictEqual(paBalancedLayers(cfg, stubbed), stubbed);
});

test("stack starts: the current PA design and the Hi-fi pair read in through their adapters", () => {
  assert.deepStrictEqual(
    startLayers(STACK_START.paCurrent, ID, CURRENT),
    paLayers(CURRENT.pa, ID, CURRENT.floor),
  );
  assert.deepStrictEqual(
    startLayers(STACK_START.hifiPair, ID, CURRENT),
    layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, ID),
  );
});
