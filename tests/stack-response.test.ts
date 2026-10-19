// The stack model (lib/speaker/stackResponse): a PA design read in as one stack (the sub and the top, or the tower)
// sums its members as its own boxes do, but for the paths to the listening point.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs, FIFTEEN_MID_CASE } from "./pa-configs";
import { PA_FLOOR, maxDiff, paDesign } from "./speaker-cases";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { SPEAKER_RESPONSE_FREQUENCIES, speakerResponse } from "../src/lib/speaker/speakerResponse";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { lrFilter } from "../src/lib/speaker/specParts";
import { abs, add, complex, multiply, phasor, scale } from "../src/lib/acoustics/complex";
import { AUTO_DELAY } from "../src/constants/speakerSpec";
import type { Complex, StackMember } from "../src/types";

/**
 * Tolerances for the sum against the members summed with their delays on one axis at one distance: STACK_PATH_DB, the
 * paths to the listening point (the sub stands about a meter below the horn's axis, 4 m out: about 0.25 dB farther,
 * and its phase with it). With the drivers' voice-coil inductance (Le) the sum reaches about 0.40 dB: Le's phase lag
 * moves the rectangle sub's auto delay (0.88 to 0.73 ms); the geometry is unchanged. The 15 in mid's design takes its
 * own limit, STACK_PATH_15_MID_DB: the mid's Le (1.5 mH) turns its phase at the 900 Hz crossover with the horn, so the
 * mid and the horn's own paths in the top box move the sum near 750 Hz by about 0.80 dB (0.35 dB without Le).
 */
const STACK_PATH_DB = 0.45;
const STACK_PATH_15_MID_DB = 0.85;

test("stack model: a PA design's stack sums its members as its boxes do", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const response = stackResponse(read.stack, read.speakers);
    // each member's input range is its crossover in the stack
    response.members.forEach((m, k) => {
      assert.ok(m, c.name);
      assert.deepEqual(m.speaker.input, read.stack.members[k].crossover, c.name);
    });
    // the sum: the members' bands with their levels and delays, all on one axis at one distance (no paths)
    const coincident = response.sum.map((o, i) => {
      let p = complex(0);
      response.members.forEach((m, k) => {
        for (const b of m?.response.bands ?? [])
          p = add(
            p,
            multiply(
              scale(b.pressure[i], 10 ** (read.stack.members[k].levelDb / 20)),
              phasor((-2 * Math.PI * o.f * (m?.delayMs ?? 0)) / 1000),
            ),
          );
      });
      return { f: o.f, spl: 20 * Math.log10(abs(p)) };
    });
    const sumDb = maxDiff(response.sum, coincident);
    const pathDb = c.name === FIFTEEN_MID_CASE ? STACK_PATH_15_MID_DB : STACK_PATH_DB;
    assert.ok(sumDb <= pathDb, `${c.name}: the sum off by ${sumDb.toFixed(3)} dB`);
  }
});

test("stack model: a member's input range follows its crossover; the model is the speaker's on that range", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "crossover" }, PA_FLOOR);
  const crossover = { highpass: lrFilter(150, 8), lowpass: null };
  const stack = {
    ...read.stack,
    members: read.stack.members.map((m, k) => (k === 1 ? { ...m, crossover } : m)),
  };
  const response = stackResponse(stack, read.speakers);
  const top = response.members[1];
  assert.ok(top);
  assert.deepEqual(top.speaker.input, crossover);
  const alone = speakerResponse(top.speaker, { feed: crossover });
  assert.deepEqual(
    top.response.sum.map((o) => o.spl),
    alone.sum.map((o) => o.spl),
  );
  // a speaker missing from those given is left out, not guessed
  const missing = stackResponse(stack, read.speakers.slice(1));
  assert.equal(missing.members[0], null);
  assert.ok(missing.members[1]);
});

/**
 * How close the auto delay brings the sub and the top into phase at the crossover, degrees: the alignment reads the
 * bands' phases between grid points and the crossing band alone (the top's horn adds a little there).
 */
const ALIGN_DEG = 3;

/** The sum's level at `f`, read at the grid point nearest it. */
const sumAt = (response: ReturnType<typeof stackResponse>, f: number) =>
  response.sum.reduce((a, b) => (Math.abs(Math.log(b.f / f)) < Math.abs(Math.log(a.f / f)) ? b : a))
    .spl;

test("stack model: an auto delay puts the sub in phase with the mid at the crossover; the tops wait where it leads", () => {
  for (const c of configs.filter((g) => g.layout !== "tower")) {
    const cfg = paDesign(c);
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const [sub, top] = read.stack.members;
    assert.equal(sub.delayMs, AUTO_DELAY, c.name);
    const auto = stackResponse(read.stack, read.speakers);
    const [s, t] = auto.members;
    assert.ok(s && t, c.name);
    // never below 0, and one of the two plays straight away
    assert.ok(s.delayMs >= 0 && t.delayMs >= 0 && Math.min(s.delayMs, t.delayMs) === 0, c.name);
    // in phase at the crossover, at the listening point
    const f0 = cfg.xoLo;
    const i = SPEAKER_RESPONSE_FREQUENCIES.findIndex((f) => f >= f0);
    const phaseAt = (p: readonly Complex[]) => {
      // read between the grid points, as the alignment does
      const k =
        Math.log(f0 / SPEAKER_RESPONSE_FREQUENCIES[i - 1]) /
        Math.log(SPEAKER_RESPONSE_FREQUENCIES[i] / SPEAKER_RESPONSE_FREQUENCIES[i - 1]);
      const a = Math.atan2(p[i - 1].im, p[i - 1].re),
        b = Math.atan2(p[i].im, p[i].re);
      const d = b - a - 2 * Math.PI * Math.round((b - a) / (2 * Math.PI));
      return a + k * d;
    };
    const diff = phaseAt(s.pressure) - phaseAt(t.pressure);
    const deg = (Math.abs(diff - 2 * Math.PI * Math.round(diff / (2 * Math.PI))) * 180) / Math.PI;
    assert.ok(deg <= ALIGN_DEG, `${c.name}: ${deg.toFixed(2)}° apart at the crossover`);
    // the sum at the crossover holds or improves on no delay (the old rule's 0 ms: the sub is the farther one)
    const none = stackResponse(
      {
        members: [
          { ...sub, delayMs: 0 },
          { ...top, delayMs: 0 },
        ],
      },
      read.speakers,
    );
    assert.ok(sumAt(auto, f0) >= sumAt(none, f0) - 1e-9, `${c.name}: the sum at the crossover`);
  }
});

test("stack model: a set delay is kept; an auto member that crosses no member takes 0", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "delays" }, PA_FLOOR);
  const [sub, top] = read.stack.members;
  const delays = (members: StackMember[]) =>
    stackResponse({ members }, read.speakers).members.map((m) => m?.delayMs);
  assert.deepEqual(delays([{ ...sub, delayMs: 1.5 }, top]), [1.5, 0]);
  // no crossover between them: nothing to align, so no delay
  const open = { highpass: null, lowpass: null };
  assert.deepEqual(
    delays([
      { ...sub, crossover: open },
      { ...top, crossover: open },
    ]),
    [0, 0],
  );
  // both auto: the first starts at 0 and the other aligns to it (the same pair of delays as the sub alone on auto)
  const one = delays([sub, top]);
  const both = delays([sub, { ...top, delayMs: AUTO_DELAY }]);
  assert.ok(one.every((d, k) => Math.abs((d ?? NaN) - (both[k] ?? NaN)) < 1e-9));
});

test("stack model: one input for the stack: the sub sets its limit low down, the top up high", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "limits" }, PA_FLOOR);
  const response = stackResponse(read.stack, read.speakers);
  const limits = stackLimits(read.stack, response);
  assert.equal(limits.sum.length, response.sum.length);
  const at = (f: number) => {
    const point = limits.sum.find((o) => o.f >= f);
    assert.ok(point);
    return point;
  };
  assert.equal(at(50).member, 0, "the sub at 50 Hz");
  assert.equal(at(3000).member, 1, "the top at 3 kHz");
  // the top's amp isn't held to the sub's: in the stack the crossover is ahead of the amps
  for (const o of limits.sum.filter((p) => p.f > 4 * cfg.xoLo)) assert.equal(o.member, 1);
  // every member at the stack's limit sums to it
  limits.sum.forEach((o, i) => {
    let p = complex(0);
    response.members.forEach((m, k) => {
      const room = 10 ** ((o.spl - response.sum[i].spl) / 20);
      if (m && limits.members[k]) p = add(p, scale(m.pressure[i], room));
    });
    assert.ok(Math.abs(20 * Math.log10(abs(p)) - o.spl) < 1e-9);
  });
  assert.ok(limits.musicDb !== null && limits.member !== null && limits.band !== null);
});
