// The speaker's limits (lib/speaker/speakerLimits) against the PA and Hi-fi pages' own: the golden designs, read
// through the L1 adapters, meet the same limits at the same levels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import {
  STACKS,
  hifiCases,
  levelAt,
  maxDiff,
  paDesign,
  paModels,
  speakerAndFeed,
  withNet,
} from "./speaker-cases";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { bandDriveVolts, speakerLimits } from "../src/lib/speaker/speakerLimits";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { systemFromPa } from "../src/lib/speaker/paSpec";
import { NO_FILTERS, lrFilter } from "../src/lib/speaker/specParts";
import { filterTransfer } from "../src/lib/speaker/bandFilter";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { abs } from "../src/lib/acoustics/complex";
import { ampVoltage, hornResponse, subThroughLowpass, ventSpeedLimit } from "../src/lib/pa/calc";
import { CD_OPTIONS, HORN_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { SPEAKER_BAND, SPEAKER_PART, SPEAKER_RESPONSE_VOLTS } from "../src/constants/speakerSpec";
import type {
  BandId,
  LimitId,
  SpeakerFeed,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../src/types";

/** The spec's response and its limits, with the same feed. */
function modelOf(spec: SpeakerSpec, feed: SpeakerFeed, portMaxMs?: number) {
  const response = speakerResponse(spec, { feed });
  return { response, limits: speakerLimits(spec, response, { feed, portMaxMs }) };
}

/** A band's limits, which the design has. */
function bandOf(limits: SpeakerLimits, id: BandId) {
  const band = limits.bands.find((b) => b.id === id);
  assert.ok(band, `a ${id} band`);
  return band;
}

/** A band's response, which the design has. */
function responseOf(response: SpeakerResponse, id: BandId) {
  const band = response.bands.find((b) => b.id === id);
  assert.ok(band, `a ${id} band`);
  return band;
}

/**
 * A band's drive at each frequency where its first limit gives out, dB against the amp at full power (0 dB): its
 * curve at the limit against its response moved to the full drive.
 */
function scaleDb(spec: SpeakerSpec, model: ReturnType<typeof modelOf>, id: BandId) {
  const band = bandOf(model.limits, id);
  const { curve } = responseOf(model.response, id);
  const toFull =
    20 * Math.log10(band.driveVolts / SPEAKER_RESPONSE_VOLTS) -
    (spec.bands.find((b) => b.id === id)?.levelDb ?? 0);
  return band.max.map((o, i) => ({ f: o.f, spl: o.spl - curve[i].spl - toFull, who: o.who }));
}

/**
 * Tolerances for the PA parity, with the net air set to today's (the box models alone). Every band runs the PA's own
 * limit arithmetic (lib/pa/calc sineLimitAt) on the model's grid, so the curves differ only by reading the PA's between
 * its points: PA_SUB_DB on the sub (its port limit's dip at the tuning is the sharpest corner), PA_BAND_DB on the mid
 * and the horn. The horn's power is the PA's to rounding. The sub's music limit (one drive for the whole band, before
 * its lowpass) is the PA's `subwooferLimits` on a coarser grid: PA_MUSIC_DB, the same limit.
 *
 * On the goldens (Oct 2026): the sub within 0.048 dB, the mid 0.001 dB, the horn 0.005 dB, the music limit 0.015 dB.
 */
const PA_SUB_DB = 0.06;
const PA_BAND_DB = 0.01;
const PA_MUSIC_DB = 0.02;

test("speaker limits: the golden PA designs meet the PA page's limits (sub, mid, horn)", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = systemFromPa(cfg, { id: "pa", name: c.name }, STACKS);
    const models = paModels(cfg);
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
    assert.ok(sub && cd?.hf && horn?.hf);
    const subSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const topSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const subChamber = subSide.spec.cabinet.chambers[0];
    const midChamber = topSide.spec.cabinet.chambers.find((ch) =>
      ch.drivers.some((d) => d.kind === "mid"),
    );
    assert.ok(midChamber, c.name);
    // the boxes with today's net air, the vents at the design's air-speed setting
    const subSpec = withNet(subSide.spec, subChamber, models.s.netL);
    const subModel = modelOf(subSpec, subSide.feed, cfg.portMax);
    const topSpec = withNet(tower ? subSpec : topSide.spec, midChamber, models.m.netL);
    const topModel = modelOf(topSpec, topSide.feed, cfg.portMax);
    // the sub through its lowpass, each frequency at its own limit (the PA system chart's curve)
    const subRef = subThroughLowpass(
      models.sub,
      sub.ts,
      models.s.AMP_V,
      ventSpeedLimit(cfg.portStyle, cfg.portMax),
      cfg.xoLo,
      cfg.xoLoOrder,
    );
    const subDb = maxDiff(bandOf(subModel.limits, SPEAKER_BAND.low).max, subRef);
    assert.ok(subDb <= PA_SUB_DB, `${c.name}: sub at its limits off by ${subDb.toFixed(3)} dB`);
    // the mid at its limits through both crossovers (midSystem's maxOutputCurve)
    const midDb = maxDiff(bandOf(topModel.limits, SPEAKER_BAND.mid).max, models.m.max ?? []);
    assert.ok(midDb <= PA_BAND_DB, `${c.name}: mid at its limits off by ${midDb.toFixed(3)} dB`);
    // the horn at its power through its highpass (and the top's feed outside the tower)
    const h = hornResponse(cd.hf, horn.hf, cfg.xoHi, cfg.hfAmpW, cfg.xoHiOrder);
    assert.ok(h);
    const feedHighpass = lrFilter(cfg.xoLo, cfg.xoLoOrder);
    const hornRef = h.curve.map((o) => ({
      f: o.f,
      spl:
        o.spl + (tower ? 0 : 20 * Math.log10(abs(filterTransfer(o.f, feedHighpass, "highpass")))),
    }));
    const hornDb = maxDiff(bandOf(topModel.limits, SPEAKER_BAND.high).max, hornRef);
    assert.ok(hornDb <= PA_BAND_DB, `${c.name}: horn at its power off by ${hornDb.toFixed(3)} dB`);
    const [power] = topModel.limits.drivers;
    assert.ok(Math.abs(power.watts - h.P) < 1e-9 * h.P, `${c.name}: horn power`);
    assert.equal(power.who, h.who, `${c.name}: what sets the horn's power`);
    // the sub's music limit: the sub box alone (the tower's low band carries its lowpass, which the PA's leaves out)
    if (tower) continue;
    const alone = modelOf(subSpec, NO_FILTERS, cfg.portMax);
    const lim = models.s.lim;
    assert.ok(lim);
    const worst = Math.min(...scaleDb(subSpec, alone, SPEAKER_BAND.low).map((o) => o.spl));
    const musicDb = Math.abs(worst - 20 * Math.log10(lim.V / models.s.AMP_V));
    assert.ok(musicDb <= PA_MUSIC_DB, `${c.name}: music limit off by ${musicDb.toFixed(3)} dB`);
    assert.equal(bandOf(alone.limits, SPEAKER_BAND.low).who, lim.who, `${c.name}: music limit`);
  }
});

/**
 * Tolerances for the Hi-fi parity, with no baffle-step EQ (the model has no baffle step to make up for). The woofer's
 * drive at its limit (`WooferMaxPoint.s`), from 30 Hz to a third of the crossover: HIFI_WOOFER_DB, from reading the Hi-fi
 * curve between its points where the limit changes (a corner in the curve); 0.03 dB elsewhere. The two engines differ
 * above that: the Hi-fi divides the coil's rating by the lowpass, the PA (and the model) take it on the whole drive.
 * What sets it is the same at every point, but where the amp's power equals the woofer's program rating (the PA names
 * it thermal, the Hi-fi amp) and at a corner between two limits. The tweeter's power is the Hi-fi's to rounding.
 *
 * On these designs (Oct 2026): the woofer within 0.18 dB.
 */
const HIFI_WOOFER_DB = 0.2;

/** Whether two limits are the same, or both a ceiling on the whole drive met at the amp's full power (a tie). */
const sameLimit = (a: LimitId, b: LimitId, scale: number) =>
  a === b || (Math.abs(scale) < 1e-9 && [a, b].every((w) => w === "amp" || w === "thermal"));

test("speaker limits: the Hi-fi designs meet the Hi-fi page's limits (woofer, tweeter)", () => {
  for (const { name, state: given } of hifiCases) {
    const state = { ...given, baffleStepCompensationDb: 0 };
    const spec = speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
    const model = modelOf(spec, NO_FILTERS);
    const sys = deriveHifiDesign(state).speakerModel?.speakerSystem;
    assert.ok(sys, name);
    const ref = sys.wMax.map((o) => ({ f: o.f, spl: 20 * Math.log10(o.s) }));
    const scale = scaleDb(spec, model, SPEAKER_BAND.low).filter(
      (o) => o.f >= 30 && o.f <= state.crossoverHz / 3,
    );
    assert.ok(scale.length > 50, name);
    for (const o of scale) {
      const r = levelAt(ref, o.f);
      assert.ok(r !== null, name);
      const at = `${name} at ${o.f.toFixed(1)} Hz`;
      assert.ok(Math.abs(o.spl - r) <= HIFI_WOOFER_DB, `${at}: ${o.spl} vs ${r} dB`);
      // what sets it, away from a corner between two limits (the Hi-fi points on either side agree)
      const i = sys.wMax.findIndex((p) => p.f >= o.f);
      const prev = sys.wMax.at(i - 1),
        next = sys.wMax.at(i);
      if (i > 0 && prev && next && prev.who === next.who)
        assert.ok(sameLimit(o.who, next.who, o.spl), `${at}: ${o.who} vs ${next.who}`);
    }
    const tweeter = model.limits.drivers.find((d) => d.band === SPEAKER_BAND.high);
    assert.ok(tweeter && Math.abs(tweeter.watts - sys.pMax) < 1e-9 * sys.pMax, `${name}: tweeter`);
    assert.equal(tweeter.derate, sys.derate, `${name}: tweeter derating`);
  }
});

test("speaker limits: one input for every band, the band with the least headroom sets the sum", () => {
  const spec = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "hifi", name: "sum" });
  const { response, limits } = modelOf(spec, NO_FILTERS);
  const headroom = (id: BandId, i: number) =>
    bandOf(limits, id).max[i].spl - responseOf(response, id).curve[i].spl;
  response.sum.forEach((o, i) => {
    const room = Math.min(...limits.bands.map((b) => headroom(b.id, i)));
    const point = limits.sum[i];
    assert.ok(Math.abs(point.spl - o.spl - room) < 1e-9, `sum at ${o.f.toFixed(0)} Hz`);
    assert.ok(Math.abs(headroom(point.band, i) - room) < 1e-9, "the band that sets it");
  });
  // for music: the band whose music limit leaves the least headroom over its passband, on the sum's
  const musicRoom = limits.bands.map((b) => b.musicDb - responseOf(response, b.id).passbandDb);
  const band = limits.bands[musicRoom.indexOf(Math.min(...musicRoom))];
  assert.equal(limits.band, band.id);
  assert.ok(limits.musicDb !== null);
});

test("speaker limits: a passive band rides its channel through its pad; a band with no amp has no limits", () => {
  const passive = speakerFromHifi({ ...DEFAULT_HIFI, drive: "passive" }, DEFAULT_HIFI_LOOK, {
    id: "hifi",
    name: "passive",
  });
  const high = passive.bands.find((b) => b.id === SPEAKER_BAND.high);
  assert.ok(high && high.levelDb < 0, "the tweeter is padded");
  assert.ok(
    Math.abs(bandDriveVolts(high) - ampVoltage(high.ampW) * 10 ** (high.levelDb / 20)) < 1e-12,
  );
  // a network can't add gain: a band set above its channel gets the channel's full voltage
  assert.equal(bandDriveVolts({ ...high, levelDb: 3 }), ampVoltage(high.ampW));
  const silent: SpeakerSpec = {
    ...passive,
    bands: passive.bands.map((b) => (b.id === SPEAKER_BAND.high ? { ...b, ampW: 0 } : b)),
  };
  const { limits } = modelOf(silent, NO_FILTERS);
  assert.deepEqual(
    limits.bands.map((b) => b.id),
    [SPEAKER_BAND.low],
  );
  assert.deepEqual(limits.drivers, []);
});
