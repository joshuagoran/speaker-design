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
import {
  AMP_POWER_TEXT,
  MUSIC_CREST_DB,
  PAST_LIMIT_ON_PEAKS,
  SINE_CREST_DB,
} from "../src/constants/ampPower";
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
  close(t, r.peakHeadroomDb, 13 - (MUSIC_CREST_DB - SINE_CREST_DB), 1e-9);
  assert.equal(r.pastLimit, false);
});

test("peak headroom: the headroom less the crest's lead over a sine's (about 7 dB)", (t) => {
  close(t, MUSIC_CREST_DB - SINE_CREST_DB, 6.99, 0.01);
  const max = subMax({ W: 800, who: "amp" }, ampVoltage(800));
  close(t, channelPower("sub", max, 10).peakHeadroomDb, SINE_CREST_DB, 1e-9);
  close(t, channelPower("sub", max, 4).peakHeadroomDb, 4 - 10 + SINE_CREST_DB, 1e-9);
});

test("the owner's screenshot: an Xmax-limited sub at 7.0 dB, peaks right at Xmax", (t) => {
  // 644 W sine at Xmax: the peaks (1,288 W) reach Xmax's peaks (twice 644 W) at 7.0 dB, and pass them below
  const max = subMax({ W: 644, who: "Xmax" }, ampVoltage(800));
  const at7 = channelPower("sub", max, 7);
  close(t, at7.peakHeadroomDb, 0, 0.05);
  assert.equal(at7.pastLimit, false);
  const at5 = channelPower("sub", max, 5);
  close(t, at5.peakHeadroomDb, -2, 0.02);
  assert.equal(at5.pastLimit, true);
  assert.equal(at5.who, "Xmax");
  assert.equal(PAST_LIMIT_ON_PEAKS[at5.who], "Past Xmax on peaks");
});

test("max peak: twice the amp's rating amp-limited, twice the model's watts at another limit", (t) => {
  close(
    t,
    channelPower("sub", subMax({ W: 800, who: "amp" }, ampVoltage(800)), 9).maxPeakW,
    1600,
    1e-9,
  );
  const xmax = channelPower("sub", subMax({ W: 642, who: "Xmax" }, ampVoltage(800)), 9);
  close(t, xmax.maxPeakW, 1284, 1e-9);
  close(t, xmax.ampW, 800, 1e-9);
  close(
    t,
    channelPower("horn", hornMax({ P: 70, pAmp: 50, who: "thermal" }), 9).maxPeakW,
    140,
    1e-9,
  );
});

test("peak headroom reads off the two peak columns, and equals the headroom less about 7 dB", (t) => {
  // the owner's case: an Xmax-limited sub at 114 W average, 1,140 W peak
  const max = subMax({ W: 642, who: "Xmax" }, ampVoltage(800));
  for (const h of [0, 4.5, 7.5, 12]) {
    const r = channelPower("sub", max, h);
    close(t, r.peakHeadroomDb, 10 * Math.log10(r.maxPeakW / r.peakW), 1e-9);
    close(t, r.peakHeadroomDb, h - (MUSIC_CREST_DB - SINE_CREST_DB), 1e-9);
  }
  const owner = channelPower("sub", max, 10 * Math.log10(642 / 114));
  close(t, owner.peakW, 1140, 1e-6);
  close(t, owner.peakHeadroomDb, 0.5, 0.05);
});

test("past the limit only once the peak headroom reads below 0.0 dB", () => {
  const max = subMax({ W: 800, who: "amp" }, ampVoltage(800));
  const edge = MUSIC_CREST_DB - SINE_CREST_DB;
  assert.equal(channelPower("sub", max, edge).pastLimit, false);
  assert.equal(channelPower("sub", max, edge - 0.04).pastLimit, false);
  assert.equal(channelPower("sub", max, edge - 0.06).pastLimit, true);
});

test("every limit has its own flag", () => {
  assert.equal(new Set(Object.values(PAST_LIMIT_ON_PEAKS)).size, 4);
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
