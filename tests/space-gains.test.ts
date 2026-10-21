// Calculate gains' pure steps (lib/speaker/spaceGains): each main's Gain from its levels at the reference, keeping the
// balance, and the System gain that keeps every driver band under its limit.
import { expect, test } from "vite-plus/test";
import {
  bandTotals,
  leastHeadroom,
  mainGains,
  systemGainFor,
  type BandHeadroom,
  type MainAtReference,
} from "../src/lib/speaker/spaceGains";
import { keysOf } from "../src/lib/records";

/** Each band's target: the More bass steps above the sub band, dB. */
const TARGETS = { sub: 110, kick: 110, mid: 104, high: 101 };

/** A sub pair: loud low, nothing much above it, at Gain 0. */
const SUBS: MainAtReference = { gainDb: 0, levels: { sub: 112, kick: 109, mid: 86, high: 55 } };
/** A top pair far too low: Gain −30 dB, a mid/high box (its mid louder than its high). */
const TOPS: MainAtReference = { gainDb: -30, levels: { sub: 62, kick: 72, mid: 76, high: 70 } };

test("a sub pair and a top pair that starts far too low: the push brings Mid to its target", () => {
  const gains = mainGains([SUBS, TOPS], TARGETS);
  const totals = bandTotals([SUBS, TOPS], gains);
  expect(totals.mid).toBeCloseTo(TARGETS.mid, 1);
  // the subs' first band meets its target
  expect(totals.sub).toBeCloseTo(TARGETS.sub, 1);
  // one Gain for the top's two bands: High stays short, and no band goes past its target
  expect(totals.high).toBeLessThan(TARGETS.high);
  for (const band of keysOf(TARGETS))
    expect(totals[band] ?? -Infinity, band).toBeLessThanOrEqual(TARGETS[band] + 0.05);
});

test("two mains alike share the bands: each gets the same Gain", () => {
  const one: MainAtReference = { gainDb: 0, levels: { sub: 100, kick: 100, mid: 100, high: 100 } };
  const [a, b] = mainGains([one, one], TARGETS);
  expect(a).toBeCloseTo(b ?? NaN, 5);
  expect(bandTotals([one, one], [a ?? 0, b ?? 0]).high).toBeCloseTo(TARGETS.high, 1);
});

test("a main that reaches no band keeps its Gain", () => {
  expect(mainGains([{ gainDb: -4, levels: {} }], TARGETS)).toEqual([-4]);
});

test("System gain: lowered by the band furthest past its limit, never raised past 0", () => {
  const band = (headroomDb: number, name: string): BandHeadroom => ({
    placement: 0,
    box: 0,
    member: 0,
    band: name,
    headroomDb,
  });
  const bands = [band(2, "low"), band(-4, "mid"), band(-1, "high")];
  expect(systemGainFor(bands)).toBe(-4);
  expect(leastHeadroom(bands)?.band).toBe("mid");
  expect(systemGainFor([band(3, "low")])).toBe(0);
  expect(systemGainFor([])).toBe(0);
});
