// Calculate gains (lib/speaker/autoBalance): band Gains and Pads for any speaker, box Gains for a stack. Each pair of
// bands (or boxes) next to each other meets flat at its crossover, the highest level 0 dB.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  autoBalanceSpeaker,
  autoBalanceStack,
  chainLevels,
  withSpeakerLevels,
  withStackLevels,
  type BalanceBand,
} from "../src/lib/speaker/autoBalance";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { curveLevelAt } from "../src/lib/acoustics/coverage";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { defaultPaDesign, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { AUTO_BALANCE_STATUS } from "../src/constants/autoBalance";
import { HIFI_DRIVE } from "../src/constants/hifiEngine";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { DRIVER_KIND, SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { SpeakerSpec } from "../src/types";

const ID = { id: "p", name: "P" };
/** How close a balanced band sits to the band next to it at their crossover, dB. */
const CLOSE_DB = 1e-6;

/** The speaker's balance, from its own response with its input range. */
const balanceOf = (spec: SpeakerSpec) =>
  autoBalanceSpeaker(spec, speakerResponse(spec, { feed: spec.input }));

/** The speaker's balanced Levels; fails when it doesn't balance. */
function levelsOf(spec: SpeakerSpec) {
  const balance = balanceOf(spec);
  assert.equal(balance.status, AUTO_BALANCE_STATUS.balanced);
  if (balance.status !== AUTO_BALANCE_STATUS.balanced) throw new Error("not balanced");
  return balance.levels;
}

/** Each band's level at `hz` with its Level, from the speaker's response. */
const levelAt = (spec: SpeakerSpec, id: string, hz: number) => {
  const band = speakerResponse(spec, { feed: spec.input }).bands.find((b) => b.id === id);
  const db = band && curveLevelAt(band.curve, hz);
  assert.ok(db !== undefined && db !== null, id);
  return db;
};

/**
 * How far the upper band sits below the lower band at their crossover (the geometric mean of the lower band's lowpass
 * and the upper band's highpass), dB, with these Levels in the speaker.
 */
function stepAt(
  spec: SpeakerSpec,
  levels: Record<string, number>,
  lowerId: string,
  upperId: string,
) {
  const lower = spec.bands.find((b) => b.id === lowerId);
  const upper = spec.bands.find((b) => b.id === upperId);
  const xo = Math.sqrt((lower?.lowpass?.hz ?? 0) * (upper?.highpass?.hz ?? 0));
  assert.ok(xo > 0, `${lowerId} to ${upperId}`);
  const balanced = withSpeakerLevels(spec, levels);
  return levelAt(balanced, lowerId, xo) - levelAt(balanced, upperId, xo);
}

/** 24 dB/oct, as dB per decade. */
const DB_PER_DECADE_24 = 80;

/**
 * A flat curve at `db` with the shape of an ideal band between two corners: 0 inside, falling `perDecade` dB per decade
 * outside (24 dB/oct unless given).
 */
const bandCurve = (
  db: number,
  lo: number | null,
  hi: number | null,
  perDecade = DB_PER_DECADE_24,
) =>
  [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480].map((f) => ({
    f,
    spl:
      db -
      (lo && f < lo ? perDecade * Math.log10(lo / f) : 0) -
      (hi && f > hi ? perDecade * Math.log10(f / hi) : 0),
  }));

/** The Hi-fi two-way with its two bands edited. */
function twoWay(
  edit: (band: SpeakerSpec["bands"][number], i: number) => SpeakerSpec["bands"][number],
  input?: SpeakerSpec["input"],
): SpeakerSpec {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  return { ...spec, input: input ?? spec.input, bands: spec.bands.map(edit) };
}

// a sub, a low mid, a high mid and a tweeter, given out of order, each with its own sensitivity
const FOUR_BANDS: BalanceBand<string>[] = [
  { key: "tweeter", curve: bandCurve(105, 4000, null), lowpassHz: null, highpassHz: 4000 },
  { key: "sub", curve: bandCurve(98, null, 100), lowpassHz: 100, highpassHz: null },
  { key: "highMid", curve: bandCurve(102, 800, 4000), lowpassHz: 4000, highpassHz: 800 },
  { key: "lowMid", curve: bandCurve(96, 100, 800), lowpassHz: 800, highpassHz: 100 },
];

test("auto balance: four bands in any order meet flat at their crossovers, the highest 0 dB", () => {
  const out = chainLevels(FOUR_BANDS);
  assert.ok(out);
  assert.deepStrictEqual(
    out.map((o) => o.key),
    ["sub", "lowMid", "highMid", "tweeter"],
  );
  const by = Object.fromEntries(out.map((o) => [o.key, o.levelDb]));
  // every band comes to the lowest sensitivity, the low mid's (96 dB): it is the one at 0 dB
  assert.ok(Math.abs(by.lowMid) < CLOSE_DB);
  assert.ok(Math.abs(98 + by.sub - 96) < CLOSE_DB);
  assert.ok(Math.abs(102 + by.highMid - 96) < CLOSE_DB);
  assert.ok(Math.abs(105 + by.tweeter - 96) < CLOSE_DB);
});

test("auto balance: bands with no filter between them meet at equal level", () => {
  const out = chainLevels([
    { key: "a", curve: bandCurve(90, null, null), lowpassHz: null, highpassHz: null },
    { key: "b", curve: bandCurve(95, null, null), lowpassHz: null, highpassHz: null },
  ]);
  assert.ok(out);
  const by = Object.fromEntries(out.map((o) => [o.key, o.levelDb]));
  assert.ok(Math.abs(90 + by.a - (95 + by.b)) < CLOSE_DB);
  assert.equal(Math.max(by.a, by.b), 0);
});

test("auto balance: a 2-band speaker (the Hi-fi two-way) meets flat", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  assert.equal(spec.bands.length, 2);
  const [woofer, tweeter] = spec.bands;
  const flat = levelsOf(spec);
  assert.equal(Math.max(...Object.values(flat)), 0);
  const step = stepAt(spec, flat, woofer.id, tweeter.id);
  assert.ok(Math.abs(step) < 1e-3, `${step}`);
});

test("auto balance: a passive band's Pad is 0 dB or less, and a positive Pad loads as 0 dB", () => {
  const spec = twoWay((b) => ({ ...b, drive: HIFI_DRIVE.passive, levelDb: 4 }));
  const levels = levelsOf(spec);
  assert.ok(Object.values(levels).every((db) => db <= 0));
  // the model reads a positive Pad as 0 dB: the same response as at 0 dB
  const at0 = twoWay((b) => ({ ...b, drive: HIFI_DRIVE.passive, levelDb: 0 }));
  const [woofer] = spec.bands;
  assert.equal(levelAt(spec, woofer.id, 1000), levelAt(at0, woofer.id, 1000));
});

test("auto balance: a 3-band speaker (the PA tower) meets flat at both crossovers", () => {
  const [tower] = layersFromPa(defaultPaDesign("tower"), ID, DEFAULT_COVERAGE_LAYOUT).speakers;
  assert.equal(tower.bands.length, 3);
  const levels = levelsOf(tower);
  assert.equal(Math.max(...Object.values(levels)), 0);
  for (const [lower, upper] of [
    [SPEAKER_BAND.low, SPEAKER_BAND.mid],
    [SPEAKER_BAND.mid, SPEAKER_BAND.high],
  ]) {
    const step = stepAt(tower, levels, lower, upper);
    assert.ok(Math.abs(step) < 1e-3, `${lower} to ${upper}: ${step}`);
  }
});

test("auto balance: a 4-band speaker (the PA tower with a tweeter over its horn) meets flat", () => {
  const tower = layersFromPa(defaultPaDesign("tower"), ID, DEFAULT_COVERAGE_LAYOUT).speakers[0];
  const tweeter = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay)
    .cabinet.chambers.flatMap((c) => c.drivers)
    .find((d) => d.kind === DRIVER_KIND.tweeter);
  assert.ok(tweeter);
  const air = "air";
  const airHz = 8000;
  const spec: SpeakerSpec = {
    ...tower,
    cabinet: {
      ...tower.cabinet,
      chambers: tower.cabinet.chambers.map((c, i) =>
        i === 0 ? { ...c, drivers: [...c.drivers, { ...tweeter, bands: [air] }] } : c,
      ),
    },
    bands: [
      ...tower.bands.map((b) =>
        b.id === SPEAKER_BAND.high ? { ...b, lowpass: { hz: airHz, type: "LR24" as const } } : b,
      ),
      {
        ...tower.bands[0],
        id: air,
        name: "Air",
        highpass: { hz: airHz, type: "LR24" },
        lowpass: null,
      },
    ],
  };
  // every crossover meets at the same level
  const flat = levelsOf(spec);
  assert.equal(Object.keys(flat).length, 4);
  for (const [lower, upper] of [
    [SPEAKER_BAND.low, SPEAKER_BAND.mid],
    [SPEAKER_BAND.mid, SPEAKER_BAND.high],
    [SPEAKER_BAND.high, air],
  ]) {
    const step = stepAt(spec, flat, lower, upper);
    assert.ok(Math.abs(step) < 1e-3, `${lower} to ${upper}: ${step}`);
  }
});

test("auto balance: one band, or a band the model cannot work out, leaves the Levels as they are", () => {
  const sub = layersFromPa(defaultPaDesign("stack"), ID, DEFAULT_COVERAGE_LAYOUT).speakers[0];
  assert.equal(balanceOf(sub).status, AUTO_BALANCE_STATUS.oneBand);
  // a band no driver plays is left out; with the horn's driver gone, the top has one band to balance
  const top = layersFromPa(defaultPaDesign("stack"), ID, DEFAULT_COVERAGE_LAYOUT).speakers[1];
  const noHorn: SpeakerSpec = {
    ...top,
    cabinet: {
      ...top.cabinet,
      chambers: top.cabinet.chambers.map((c) => ({
        ...c,
        drivers: c.drivers.filter((d) => d.kind !== DRIVER_KIND.compression),
      })),
    },
  };
  assert.equal(balanceOf(noHorn).status, AUTO_BALANCE_STATUS.oneBand);
  // a band whose filter has no valid corner: the model leaves it out, so nothing changes
  const bad: SpeakerSpec = {
    ...top,
    bands: top.bands.map((b) =>
      b.id === SPEAKER_BAND.high ? { ...b, highpass: { hz: 0, type: "LR24" as const } } : b,
    ),
  };
  const balance = balanceOf(bad);
  assert.equal(balance.status, AUTO_BALANCE_STATUS.unmodeled);
  if (balance.status === AUTO_BALANCE_STATUS.unmodeled)
    assert.deepStrictEqual(balance.names, [
      top.bands.find((b) => b.id === SPEAKER_BAND.high)?.name,
    ]);
});

test("auto balance: a stack sets only its members' Gains, box against box, flat", () => {
  const layers = layersFromPa(defaultPaDesign("stack"), ID, DEFAULT_COVERAGE_LAYOUT);
  const moved = {
    ...layers,
    stack: { ...layers.stack, members: layers.stack.members.map((m) => ({ ...m, levelDb: -5 })) },
  };
  const balance = autoBalanceStack(moved, stackResponse(moved.stack, moved.speakers));
  assert.equal(balance.status, AUTO_BALANCE_STATUS.balanced);
  if (balance.status !== AUTO_BALANCE_STATUS.balanced) return;
  // one Gain per member, the highest 0 dB
  assert.equal(balance.levels.length, 2);
  assert.equal(Math.max(...balance.levels), 0);
  const out = withStackLevels(moved, balance.levels);
  assert.deepStrictEqual(
    out.stack.members.map((m) => m.levelDb),
    balance.levels,
  );
  // the speakers' bands stay as they are
  assert.strictEqual(out.speakers, moved.speakers);
  // the members meet at the same level at their crossover
  const run = stackResponse(out.stack, out.speakers);
  const xo = layers.stack.members[1].crossover.highpass?.hz ?? 0;
  const [sub, top] = run.members.map((m, k) => {
    const db = m && curveLevelAt(m.response.sum, xo);
    assert.ok(typeof db === "number", `member ${k}`);
    return db + balance.levels[k];
  });
  assert.ok(Math.abs(sub - top) < CLOSE_DB, `${sub} against ${top}`);
  // one member alone: nothing to balance
  const one = { ...layers, stack: { ...layers.stack, members: layers.stack.members.slice(0, 1) } };
  assert.equal(
    autoBalanceStack(one, stackResponse(one.stack, one.speakers)).status,
    AUTO_BALANCE_STATUS.oneBand,
  );
});

test("auto balance: a protective input highpass is not a crossover; the bands meet at the woofer's lowpass", () => {
  // the tweeter's highpass removed, the woofer's lowpass at 2 kHz, a 30 Hz highpass on the input (on every band)
  const xoHz = 2000;
  const spec = twoWay(
    (b, i) => (i === 0 ? { ...b, lowpass: { hz: xoHz, type: "LR24" } } : { ...b, highpass: null }),
    { highpass: { hz: 30, type: "LR24" }, lowpass: null },
  );
  const [woofer, tweeter] = spec.bands;
  const balanced = withSpeakerLevels(spec, levelsOf(spec));
  const step = levelAt(balanced, woofer.id, xoHz) - levelAt(balanced, tweeter.id, xoHz);
  assert.ok(Math.abs(step) < 1e-3, `${step}`);
});

test("auto balance: a feed filter counts as a crossover where it cuts into the band next to it", () => {
  // two stack members crossing over at 160 Hz on their feeds (the members' crossovers) only
  const xoHz = 160;
  const bands: BalanceBand<string>[] = [
    {
      key: "sub",
      curve: bandCurve(98, null, xoHz),
      lowpassHz: null,
      highpassHz: null,
      feedLowpassHz: xoHz,
    },
    {
      key: "top",
      curve: bandCurve(96, xoHz, null),
      lowpassHz: null,
      highpassHz: null,
      feedHighpassHz: xoHz,
    },
  ];
  const flat = chainLevels(bands);
  assert.ok(flat);
  const by = Object.fromEntries(flat.map((o) => [o.key, o.levelDb]));
  assert.ok(Math.abs(98 + by.sub - (96 + by.top)) < CLOSE_DB);
});

test("auto balance: a gapped crossover reads each band at its own corner, not between them", () => {
  // the lower band falls 24 dB/oct above 320 Hz, the upper 12 dB/oct below 2560 Hz: at the mean they'd read unequal
  const lowHz = 320,
    highHz = 2560;
  const out = chainLevels([
    { key: "lower", curve: bandCurve(90, null, lowHz), lowpassHz: lowHz, highpassHz: null },
    {
      key: "upper",
      curve: bandCurve(100, highHz, null, DB_PER_DECADE_24 / 2),
      lowpassHz: null,
      highpassHz: highHz,
    },
  ]);
  assert.ok(out);
  const by = Object.fromEntries(out.map((o) => [o.key, o.levelDb]));
  assert.ok(Math.abs(90 + by.lower - (100 + by.upper)) < CLOSE_DB);
  // the Hi-fi two-way with its woofer's lowpass at 400 Hz and its tweeter's highpass at 3 kHz
  const wooferHz = 400,
    tweeterHz = 3000;
  const spec = twoWay((b, i) =>
    i === 0
      ? { ...b, lowpass: { hz: wooferHz, type: "LR24" } }
      : { ...b, highpass: { hz: tweeterHz, type: "LR24" } },
  );
  const [woofer, tweeter] = spec.bands;
  const balanced = withSpeakerLevels(spec, levelsOf(spec));
  const step = levelAt(balanced, woofer.id, wooferHz) - levelAt(balanced, tweeter.id, tweeterHz);
  assert.ok(Math.abs(step) < 1e-3, `${step}`);
});

test("auto balance: a crossover outside the model's frequency range leaves the Levels, with its own status", () => {
  const spec = twoWay((b, i) => (i === 0 ? b : { ...b, highpass: { hz: 22000, type: "LR24" } }));
  assert.equal(balanceOf(spec).status, AUTO_BALANCE_STATUS.outOfRange);
});
