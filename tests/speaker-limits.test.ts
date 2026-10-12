// The speaker's limits (lib/speaker/speakerLimits) against the PA and Hi-fi pages' own: the golden designs, read
// through the L1 adapters, meet the same limits at the same levels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import {
  PA_FLOOR,
  hifiCases,
  levelAt,
  maxDiff,
  paDesign,
  paModels,
  speakerAndFeed,
  withHifiNet,
  withNet,
} from "./speaker-cases";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { bandDriveVolts, speakerLimits } from "../src/lib/speaker/speakerLimits";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { NO_FILTERS, lrFilter } from "../src/lib/speaker/specParts";
import { filterTransfer } from "../src/lib/speaker/bandFilter";
import { deriveHifiDesign } from "../src/pages/hifi/hifiDesign";
import { abs } from "../src/lib/acoustics/complex";
import { ampVoltage, hornResponse, subThroughLowpass, ventSpeedLimit } from "../src/lib/pa/calc";
import { CD_OPTIONS, HORN_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_SPEAKER_BAND } from "../src/lib/defaults";
import { startSpeaker } from "../src/pages/speaker/speakerStarts";
import { newBandId } from "../src/pages/speaker/useSpeakerPage";
import { PALETTES, bandLine } from "../src/styles/palette";
import { SPEAKER_START } from "../src/constants/speakerStarts";
import {
  DRIVER_KIND,
  SPEAKER_BAND,
  SPEAKER_PART,
  SPEAKER_RESPONSE_VOLTS,
} from "../src/constants/speakerSpec";
import { INPUT_RANGE_LIMIT, LIMIT_NAMES, PER_FREQUENCY_LIMITS } from "../src/constants/limits";
import type {
  BandId,
  LimitId,
  SpeakerFeed,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../src/types";

/** The spec's response and its limits, with the same feed. */
function modelOf(spec: SpeakerSpec, feed: SpeakerFeed) {
  const response = speakerResponse(spec, { feed });
  return { response, limits: speakerLimits(spec, response, { feed }) };
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
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const models = paModels(cfg);
    const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    const horn = HORN_OPTIONS.find((o) => o.id === cfg.horn);
    assert.ok(sub && cd?.hf && horn?.hf);
    const subSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const topSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const subChamber = subSide.spec.cabinet.chambers[0];
    const midChamber = topSide.spec.cabinet.chambers.find((ch) =>
      ch.drivers.some((d) => d.kind === DRIVER_KIND.mid),
    );
    assert.ok(midChamber, c.name);
    // the boxes with today's net air, the vents at the design's air-speed setting
    // each speaker's input range is its source's filters, and the Speaker page models it with that range
    assert.deepEqual(subSide.spec.input, subSide.feed, `${c.name}: the sub's input range`);
    assert.deepEqual(topSide.spec.input, topSide.feed, `${c.name}: the top's input range`);
    const subSpec = withNet(subSide.spec, subChamber, models.s.netL);
    const subModel = modelOf(subSpec, subSpec.input);
    const topSpec = withNet(tower ? subSpec : topSide.spec, midChamber, models.m.netL);
    const topModel = modelOf(topSpec, topSpec.input);
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
    const alone = modelOf(subSpec, NO_FILTERS);
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
  a === b ||
  (Math.abs(scale) < 1e-9 &&
    [a, b].every((w) => w === LIMIT_NAMES.amp || w === LIMIT_NAMES.thermal));

test("speaker limits: the Hi-fi designs meet the Hi-fi page's limits (woofer, tweeter)", () => {
  for (const { name, state: given } of hifiCases) {
    const state = { ...given, baffleStepCompensationDb: 0 };
    // on the Hi-fi engine's net air (its 3% allowance for bracing and damping: tests/speaker-response.test.ts)
    const spec = withHifiNet(
      speakerFromHifi(state, DEFAULT_HIFI_LOOK, { id: "hifi", name }),
      state,
    );
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

/** The sum's headroom over the response at each point, dB, and its band's own (the band alone, whole-drive ceilings). */
function sumRooms(spec: SpeakerSpec) {
  const { response, limits } = modelOf(spec, NO_FILTERS);
  const own = (id: BandId, i: number) =>
    bandOf(limits, id).max[i].spl - responseOf(response, id).curve[i].spl;
  return { response, limits, own, room: (i: number) => limits.sum[i].spl - response.sum[i].spl };
}

/** A Hi-fi case by name. */
const hifiCase = (name: string) => {
  const found = hifiCases.find((c) => c.name === name);
  assert.ok(found, name);
  return speakerFromHifi(found.state, DEFAULT_HIFI_LOOK, { id: "hifi", name });
};

test("speaker limits: a band limits the sum only where it carries signal (a compression driver up top)", () => {
  // active: the woofer's program rating and amp take its lowpassed drive, so above the crossover the tweeter sets the sum
  const spec = hifiCase("compression driver on a round waveguide");
  const { limits, own, room } = sumRooms(spec);
  const top = limits.sum.filter((o) => o.f >= 3000 && o.f <= 8000);
  assert.ok(top.length > 5);
  for (const o of top)
    assert.equal(o.band, SPEAKER_BAND.high, `the tweeter sets the sum at ${o.f.toFixed(0)} Hz`);
  // an octave and more above the crossover the highpass passes the drive whole: the sum reaches the tweeter's own ceiling
  limits.sum.forEach((o, i) => {
    if (o.f < 8000) return;
    assert.ok(
      Math.abs(room(i) - own(SPEAKER_BAND.high, i)) < 0.05,
      `the tweeter's ceiling at ${o.f.toFixed(0)} Hz`,
    );
  });
});

test("speaker limits: the sum is never below a band's own ceiling, and a cone or vent limit is the same in both", () => {
  for (const name of ["DEFAULT_HIFI", "radiator", "compression driver on a round waveguide"]) {
    const { limits, own, room } = sumRooms(hifiCase(name));
    limits.sum.forEach((o, i) => {
      const least = Math.min(...limits.bands.map((b) => own(b.id, i)));
      assert.ok(
        room(i) >= least - 1e-9,
        `${name} at ${o.f.toFixed(0)} Hz: dividing the ceilings only raises them`,
      );
      const { who } = bandOf(limits, o.band).max[i];
      if (PER_FREQUENCY_LIMITS.has(who))
        assert.ok(
          Math.abs(room(i) - own(o.band, i)) < 1e-9,
          `${name} at ${o.f.toFixed(0)} Hz: ${o.who}`,
        );
    });
    // for music: the band whose music limit leaves the least headroom over its passband, on the sum's
    const { response } = modelOf(hifiCase(name), NO_FILTERS);
    const musicRoom = limits.bands.map((b) => b.musicDb - responseOf(response, b.id).passbandDb);
    assert.equal(limits.band, limits.bands[musicRoom.indexOf(Math.min(...musicRoom))].id, name);
  }
});

test("speaker limits: a passive speaker's shared amp limits the sum before the network, the same for every band", () => {
  const spec = hifiCase("passive");
  const { limits, room } = sumRooms(spec);
  const low = spec.bands.find((b) => b.id === SPEAKER_BAND.low);
  assert.ok(low);
  // the channel's ceiling: its full voltage on the input, which no network filter lifts
  const channel = 20 * Math.log10(ampVoltage(low.ampW) / SPEAKER_RESPONSE_VOLTS);
  limits.sum.forEach((o, i) =>
    assert.ok(room(i) <= channel + 1e-9, `${o.f.toFixed(0)} Hz: ${room(i)} over ${channel} dB`),
  );
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

test("speaker limits: a PA start brings its input range (the top above the sub crossover, the sub below it)", () => {
  for (const c of configs.filter((g) => g.layout !== "tower")) {
    const pa = paDesign(c);
    const sources = { pa, hifi: DEFAULT_HIFI, hifiLook: DEFAULT_HIFI_LOOK };
    // the top: the mid meets its amp or rating below its band, not Xmax (the input range's highpass protects it)
    const top = startSpeaker(SPEAKER_START.paTop, sources);
    assert.deepEqual(top.input.highpass, lrFilter(pa.xoLo, pa.xoLoOrder), c.name);
    const mid = bandOf(modelOf(top, top.input).limits, SPEAKER_BAND.mid);
    for (const o of mid.max.filter((p) => p.f >= 38 && p.f <= 52))
      assert.notEqual(o.who, LIMIT_NAMES.Xmax, `${c.name}: the mid at ${o.f.toFixed(0)} Hz`);
    assert.notEqual(mid.who, LIMIT_NAMES.Xmax, `${c.name}: the mid's music limit`);
    // the sub: the sum stops above the crossover (its own subsonic stays in its band)
    const sub = startSpeaker(SPEAKER_START.paSub, sources);
    assert.deepEqual(sub.input.lowpass, lrFilter(pa.xoLo, pa.xoLoOrder), c.name);
    const { limits } = modelOf(sub, sub.input);
    const peak = Math.max(...limits.sum.map((o) => o.spl));
    const above = limits.sum.filter((o) => o.f >= 4 * pa.xoLo);
    assert.ok(
      above.length > 0 && above.every((o) => o.spl < peak - 30),
      `${c.name}: the sub's sum`,
    );
    // there the input range, not the amp or the program rating, sets it
    assert.ok(
      above.every((o) => o.who === INPUT_RANGE_LIMIT || PER_FREQUENCY_LIMITS.has(o.who)),
      `${c.name}: the input range names it`,
    );
  }
});

test("speaker limits: bands are a free list: a 4-way box, with a band the user names", () => {
  const tower = configs.find((g) => g.layout === "tower");
  assert.ok(tower);
  const spec = startSpeaker(SPEAKER_START.paTower, {
    pa: paDesign(tower),
    hifi: DEFAULT_HIFI,
    hifiLook: DEFAULT_HIFI_LOOK,
  });
  // a super tweeter on a band of its own, above the horn, in the horn section
  const id = newBandId(spec.bands);
  const four: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c, i, all) =>
        i === all.length - 1
          ? {
              ...c,
              drivers: [
                ...c.drivers,
                {
                  kind: DRIVER_KIND.tweeter,
                  driverId: DEFAULT_HIFI.tweeter.id,
                  count: 1,
                  position: { xIn: 0, yIn: 2 },
                  bands: [id],
                  horn: null,
                },
              ],
            }
          : c,
      ),
    },
    bands: [
      ...spec.bands,
      {
        id,
        name: "Air",
        ...DEFAULT_SPEAKER_BAND,
        highpass: lrFilter(12000, 4),
        levelDb: -6,
      },
    ],
  };
  assert.ok(!spec.bands.some((b) => b.id === id), "a new id");
  const { response, limits } = modelOf(four, four.input);
  assert.deepEqual(
    response.bands.map((b) => b.id),
    four.bands.map((b) => b.id),
  );
  assert.equal(limits.bands.length, 4);
  assert.ok(limits.sum.every((o) => Number.isFinite(o.spl)));
  assert.ok(
    limits.drivers.some((d) => d.band === id),
    "the super tweeter's power",
  );
  // each band its own line on the charts
  const lines = four.bands.map((_, i) => JSON.stringify(bandLine(PALETTES.light, i, 4)));
  assert.equal(new Set(lines).size, 4);
});
