import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  channelPower,
  headroomDb,
  hornMax,
  midMax,
  peakPower,
  powerAtTarget,
  subMax,
} from "../src/lib/pa/ampPower";
import { ampVoltage } from "../src/lib/pa/calc";
import { AMP_POWER_TEXT, MUSIC_CREST_DB } from "../src/constants/ampPower";
import { AMP_LIMIT_NAMES } from "../src/constants/limits";
import type { PaMaxPoint } from "../src/types";
import { close } from "./helpers";

test("power at the target: 10 dB under the max is a tenth, 3 dB about half", (t) => {
  close(t, powerAtTarget(800, 10), 80, 1e-9);
  close(t, powerAtTarget(800, 0), 800, 1e-9);
  close(t, powerAtTarget(1000, 3), 501.19, 0.01);
});

test("peaks: the crest factor above the average (10 dB club music: ten times)", (t) => {
  assert.equal(MUSIC_CREST_DB, 10);
  close(t, peakPower(25), 250, 1e-9);
  close(t, peakPower(25, 12), 25 * 10 ** 1.2, 1e-9);
  assert.ok(AMP_POWER_TEXT.crestNote.includes(`${MUSIC_CREST_DB} dB`));
});

test("headroom: the gain and the pad together, never below 0", () => {
  assert.equal(headroomDb(-4, -2), 6);
  assert.equal(headroomDb(0, 0), 0);
  assert.equal(headroomDb(0.5, 0), 0);
});

test("a channel at the target: 13 dB headroom under an amp-limited 800 W sub", (t) => {
  const r = channelPower("sub", subMax({ W: 800, who: "amp" }, ampVoltage(800)), 13);
  close(t, r.ampW, 800, 1e-9);
  close(t, r.avgW, 800 * 10 ** -1.3, 1e-9);
  close(t, r.peakW, 800 * 10 ** -0.3, 1e-9);
  assert.equal(r.clips, false);
});

test("clips on peaks once the peaks need more than the amp", () => {
  const max = subMax({ W: 800, who: "amp" }, ampVoltage(800));
  assert.equal(channelPower("sub", max, 6).clips, true);
  assert.equal(channelPower("sub", max, 10).clips, false);
});

test("the horn: its model's power and the amp's power into its impedance", () => {
  const m = hornMax({ P: 120, pAmp: 200, who: "thermal" });
  assert.deepEqual(m, { wAtMax: 120, ampW: 200, who: "thermal" });
});

test("the mid: the lowest drive between the crossovers sets its max, and names the limit", (t) => {
  const V = ampVoltage(1000);
  const curve = [{ spl: 100 }, { spl: 110 }, { spl: 112 }, { spl: 112 }];
  const max: PaMaxPoint[] = [
    { f: 50, spl: 80, who: "Xmax" }, // below the band: ignored
    { f: 100, spl: 104, who: "Xmax" }, // −6 dB: the lowest in the band
    { f: 500, spl: 109, who: "thermal" },
    { f: 1000, spl: 112, who: "amp" },
  ];
  const m = midMax(max, curve, V, [80, 1200]);
  assert.ok(m);
  assert.equal(m.who, "Xmax");
  close(t, m.ampW, 1000, 1e-9);
  close(t, m.wAtMax, 1000 * 10 ** -0.6, 1e-9);
  assert.equal(midMax(max, curve, V, [2000, 3000]), null);
});

test("limit labels: amp, heat, excursion, port air speed", () => {
  assert.deepEqual(AMP_LIMIT_NAMES, {
    amp: "Amp",
    thermal: "Heat",
    Xmax: "Excursion (Xmax)",
    port: "Port air speed",
  });
});
