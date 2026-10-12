// The stack model (lib/speaker/stackResponse) against the PA page: a PA design read in as one stack (the sub and the
// top, or the tower) meets the PA page's system chart (each band at its limits) and sums its members as the PA's own
// boxes do, but for the paths to the listening point.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { STACKS, maxDiff, paDesign, paModels } from "./speaker-cases";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { lrFilter } from "../src/lib/speaker/specParts";
import { filterTransfer } from "../src/lib/speaker/bandFilter";
import { abs, add, complex, scale } from "../src/lib/acoustics/complex";
import { hornResponse, subThroughLowpass, ventSpeedLimit } from "../src/lib/pa/calc";
import { CD_OPTIONS, HORN_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { AUTO_DELAY, DRIVER_KIND, SPEAKER_BAND } from "../src/constants/speakerSpec";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import type { BandId, DesignLayers, SpeakerChamber, SpeakerSpec, StackLimits } from "../src/types";

/** The design's speakers with today's net air in the sub and mid chambers (the box models alone, as the PA's). */
function withPaAir(read: DesignLayers, models: ReturnType<typeof paModels>): SpeakerSpec[] {
  const netOf = (chamber: SpeakerChamber) =>
    chamber.drivers.some((d) => d.kind === DRIVER_KIND.sub)
      ? models.s.netL
      : chamber.drivers.some((d) => d.kind === DRIVER_KIND.mid)
        ? models.m.netL
        : chamber.netLiters;
  return read.speakers.map((spec) => ({
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c) => ({ ...c, netLiters: netOf(c) })),
    },
  }));
}

/** A band's curve at its limits in a stack member, found by the band. */
function bandMax(limits: StackLimits, id: BandId) {
  for (const m of limits.members) {
    const band = m?.limits.bands.find((b) => b.id === id);
    if (band) return band.max;
  }
  assert.fail(`a ${id} band`);
}

/**
 * Tolerances against the PA page, with the net air set to today's. Each band at its limits as tests/speaker-limits
 * (the PA's own limit arithmetic, read between its points): PA_SUB_DB on the sub, PA_BAND_DB on the mid and the horn.
 * The sum against the members summed on one axis at one distance: STACK_PATH_DB, the paths to the listening point (the
 * sub stands about a meter below the horn's axis, 4 m out: about 0.25 dB farther, and its phase with it).
 *
 * On the goldens (Oct 2026): the sub within 0.048 dB, the mid 0.001 dB, the horn 0.005 dB, the sum 0.34 dB.
 */
const PA_SUB_DB = 0.06;
const PA_BAND_DB = 0.01;
const STACK_PATH_DB = 0.4;

test("stack model: a PA design's stack meets the PA page's system chart and sums as its boxes do", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, STACKS);
    const models = paModels(cfg);
    const speakers = withPaAir(read, models);
    const response = stackResponse(read.stack, speakers);
    const limits = stackLimits(read.stack, response);
    // each member's input range is its crossover in the stack
    response.members.forEach((m, k) => {
      assert.ok(m, c.name);
      assert.deepEqual(m.speaker.input, read.stack.members[k].crossover, c.name);
    });
    // the PA system chart: the sub through its lowpass, the mid and the horn at their limits
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
    assert.ok(sub && cd?.hf && horn?.hf);
    const subRef = subThroughLowpass(
      models.sub,
      sub.ts,
      models.s.AMP_V,
      ventSpeedLimit(cfg.portStyle, cfg.portMax),
      cfg.xoLo,
      cfg.xoLoOrder,
    );
    const h = hornResponse(cd.hf, horn.hf, cfg.xoHi, cfg.hfAmpW, cfg.xoHiOrder);
    assert.ok(h);
    const feedHighpass = lrFilter(cfg.xoLo, cfg.xoLoOrder);
    const hornRef = h.curve.map((o) => ({
      f: o.f,
      spl:
        o.spl + (tower ? 0 : 20 * Math.log10(abs(filterTransfer(o.f, feedHighpass, "highpass")))),
    }));
    const subDb = maxDiff(bandMax(limits, SPEAKER_BAND.low), subRef);
    const midDb = maxDiff(bandMax(limits, SPEAKER_BAND.mid), models.m.max ?? []);
    const hornDb = maxDiff(bandMax(limits, SPEAKER_BAND.high), hornRef);
    // the sum: the members' bands with their levels, all on one axis at one distance (no paths)
    const coincident = response.sum.map((o, i) => {
      let p = complex(0);
      response.members.forEach((m, k) => {
        for (const b of m?.response.bands ?? [])
          p = add(p, scale(b.pressure[i], 10 ** (read.stack.members[k].levelDb / 20)));
      });
      return { f: o.f, spl: 20 * Math.log10(abs(p)) };
    });
    const sumDb = maxDiff(response.sum, coincident);
    assert.ok(subDb <= PA_SUB_DB, `${c.name}: sub at its limits off by ${subDb.toFixed(3)} dB`);
    assert.ok(midDb <= PA_BAND_DB, `${c.name}: mid at its limits off by ${midDb.toFixed(3)} dB`);
    assert.ok(hornDb <= PA_BAND_DB, `${c.name}: horn at its power off by ${hornDb.toFixed(3)} dB`);
    assert.ok(sumDb <= STACK_PATH_DB, `${c.name}: the sum off by ${sumDb.toFixed(3)} dB`);
  }
});

test("stack model: a member's input range follows its crossover; the model is the speaker's on that range", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "crossover" }, STACKS);
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

test("stack model: an auto delay lines a member up with the latest member that has a delay set", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "delays" }, STACKS);
  const [sub, top] = read.stack.members;
  /** the members' delays and paths with the sub and the top set to these */
  const run = (subDelay: typeof sub.delayMs, topDelay: typeof top.delayMs) =>
    stackResponse(
      {
        members: [
          { ...sub, delayMs: subDelay },
          { ...top, delayMs: topDelay },
        ],
      },
      read.speakers,
    ).members.map((m) => {
      assert.ok(m);
      return { delayMs: m.delayMs, pathM: m.pathM };
    });
  const ms = (pathM: number) => (pathM / SPEED_OF_SOUND) * 1000;
  // the sub stands below the listening axis: farther than the top, so it can't be pulled earlier (never below 0)
  const [s0, t0] = run(AUTO_DELAY, 0);
  assert.ok(s0.pathM > t0.pathM);
  assert.equal(s0.delayMs, 0);
  // with the top held back 2 ms, the sub waits to arrive with it
  const [s1] = run(AUTO_DELAY, 2);
  assert.ok(Math.abs(ms(s1.pathM) + s1.delayMs - (ms(t0.pathM) + 2)) < 1e-9);
  // all auto: lined up with the farthest
  const [s2, t2] = run(AUTO_DELAY, AUTO_DELAY);
  assert.equal(s2.delayMs, 0);
  assert.ok(Math.abs(ms(t2.pathM) + t2.delayMs - ms(s2.pathM)) < 1e-9);
  // a set delay is kept
  assert.equal(run(1.5, 0)[0].delayMs, 1.5);
});

test("stack model: one input for the stack: the sub sets its limit low down, the top up high", () => {
  const cfg = paDesign(configs[0]);
  const read = layersFromPa(cfg, { id: "pa", name: "limits" }, STACKS);
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
