// Room-mode smoothing (lib/pa/coverage coverageFrequencies): in a band view, each band point in the modal range splits
// into sub-points that share its weight, so one point near a room mode doesn't draw a lobe pattern of its own.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  BAND_POINTS,
  COVERAGE_BANDS,
  COVERAGE_GRID_COLS,
  coverageFrequencies,
  coverageGrid,
  levelAtPoint,
  sceneSlots,
} from "../src/lib/pa/coverage";
import { modalTopHz } from "../src/lib/pa/roomAcoustics";
import { MODAL_SUBPOINTS, MODAL_SUBPOINTS_WHOLE_BAND } from "../src/constants/acoustics";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { spaceModel, spaceOutputs } from "../src/lib/speaker/spaceCoverage";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { spacePlacement } from "../src/lib/speaker/specParts";
import type { SpaceDesign } from "../src/types";

/** the room's modal crossovers the tests read, Hz (the map holds it within 80-200 Hz) */
const CROSSOVERS = [80, 120, 200];
const BANDS = ["sub", "kick", "mid", "high"] as const;

const sum = (v: readonly number[]) => v.reduce((a, b) => a + b, 0);

test("modal smoothing: a split keeps each point's weight, and the band's total", () => {
  for (const crossover of CROSSOVERS)
    for (const band of BANDS) {
      const { freqs, shares } = coverageFrequencies(band, 0, crossover);
      assert.equal(freqs.length, shares.length);
      assert.ok(Math.abs(sum(shares) - BAND_POINTS) < 1e-9, `${band} at ${crossover} Hz`);
    }
  // the sub band lies wholly in the modal range of a 200 Hz room: every point splits, M = 2
  const whole = coverageFrequencies("sub", 0, 200);
  assert.equal(whole.freqs.length, BAND_POINTS * MODAL_SUBPOINTS_WHOLE_BAND);
  // the mid band only in its lowest points
  const top = modalTopHz(200);
  const mid = coverageFrequencies("mid", 0, 200);
  const points = coverageFrequencies("mid", 0, null).freqs;
  const below = points.filter((f) => f < top).length;
  assert.ok(below > 0 && below < BAND_POINTS);
  assert.equal(mid.freqs.length, BAND_POINTS - below + below * MODAL_SUBPOINTS);
  // points at or above the modal top stay where they were, with a full weight
  assert.deepEqual(
    mid.freqs.filter((f) => f >= top),
    points.filter((f) => f >= top),
  );
  assert.ok(
    mid.shares.every((s, i) => (mid.freqs[i] >= top ? s === 1 : s === 1 / MODAL_SUBPOINTS)),
  );
});

test("modal smoothing: sub-points are log-spaced across their point's share of the band", () => {
  const band = COVERAGE_BANDS.mid;
  const ratio = Math.pow(band.hi / band.lo, 1 / (BAND_POINTS - 1));
  // an inner point: the first and last points' shares are clamped to the band's edges
  const f0 = coverageFrequencies("mid", 0, null).freqs[1];
  const { freqs } = coverageFrequencies("mid", 0, 200, 4);
  const sub = freqs.slice(4, 8);
  assert.ok(sub.every((f) => f > f0 / Math.sqrt(ratio) && f < f0 * Math.sqrt(ratio)));
  for (let i = 1; i < sub.length; i++)
    assert.ok(Math.abs(sub[i] / sub[i - 1] - Math.pow(ratio, 1 / 4)) < 1e-9);
  // centered on the point
  assert.ok(Math.abs(Math.sqrt(sub[0] * sub[3]) - f0) < 1e-9);
});

test("modal smoothing: one frequency is never split, nor is a band outdoors", () => {
  for (const crossover of CROSSOVERS) {
    const one = coverageFrequencies("one", 63, crossover);
    assert.deepEqual([one.freqs, one.shares, one.coherent], [[63], [1], true]);
  }
  const outdoors = coverageFrequencies("sub", 0, null);
  assert.equal(outdoors.freqs.length, BAND_POINTS);
  assert.ok(outdoors.shares.every((s) => s === 1));
});

/** One sub in the home room (the satellites preset's), `x` ft from the middle of the front wall. */
function subAt(x: number): SpaceDesign {
  const read = presetLayers("paSatellite", { id: "draft", name: "PA satellites" });
  const sub = read.speakers.find((s) => s.id.endsWith("/sub"));
  assert.ok(sub);
  return {
    space: {
      ...read.space,
      placements: [spacePlacement({ x, y: 3 }, { kind: SPACE_ITEM.speaker, id: sub.id }, 0)],
    },
    stacks: [],
    speakers: [sub],
  };
}

/** The map of the sub at `x` in `band`, its band's frequencies split into `subpoints` where they are in the modal range. */
function mapOf(x: number, band: (typeof BANDS)[number], subpoints: number) {
  const design = subAt(x);
  const model = spaceModel(design);
  const { venue } = design.space;
  const { freqs, shares, coherent } = coverageFrequencies(
    band,
    0,
    model.scene.modal?.crossoverHz ?? null,
    subpoints,
  );
  const slots = sceneSlots(model.scene, freqs, coherent, (f) => spaceOutputs(model, f), shares);
  return coverageGrid(model.scene, slots, venue.room, venue.earFt, COVERAGE_GRID_COLS);
}

/** How much each cell of the map changes when the sub moves: the mean and the largest change, dB. */
function moveSpread(band: (typeof BANDS)[number], subpoints: number, feet: number) {
  const a = mapOf(0, band, subpoints).db,
    b = mapOf(feet, band, subpoints).db;
  const change = Array.from(a, (v, i) => Math.abs(v - b[i]));
  return { mean: sum(change) / change.length, max: Math.max(...change) };
}

test("modal smoothing: moving the sub 5 ft changes the mid band's map less than the old sampling does", () => {
  const old = moveSpread("mid", 1, 5);
  const smoothed = moveSpread("mid", MODAL_SUBPOINTS, 5);
  assert.ok(smoothed.mean < old.mean, `mean ${smoothed.mean} dB against ${old.mean} dB`);
  assert.ok(smoothed.max < old.max, `max ${smoothed.max} dB against ${old.max} dB`);
});

test("modal smoothing: the band average stays a power average, by share", () => {
  const design = subAt(0);
  const model = spaceModel(design);
  const f = 150;
  const at = { x: 3, y: 12, z: 1.2 };
  const read = (freqs: number[], shares: number[]) =>
    levelAtPoint(
      model.scene,
      sceneSlots(model.scene, freqs, false, (g) => spaceOutputs(model, g), shares),
      at.x,
      at.y,
      at.z,
    );
  // a point split into the same frequency four times, a quarter each, reads as the point itself
  assert.ok(Math.abs(read([f, f, f, f], [0.25, 0.25, 0.25, 0.25]) - read([f], [1])) < 1e-9);
  // two frequencies by shares: the power-weighted mean of their mean squares
  const [a, b] = [read([100], [1]), read([140], [1])];
  const mean = 10 * Math.log10(0.75 * 10 ** (a / 10) + 0.25 * 10 ** (b / 10));
  assert.ok(Math.abs(read([100, 140], [0.75, 0.25]) - mean) < 1e-9);
});
