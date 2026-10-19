// The speaker's limits (lib/speaker/speakerLimits) against the box models' own: the Hi-fi and PA designs, read
// through the L1 adapters, meet the same limits at the same levels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./pa-configs";
import {
  PA_FLOOR,
  hifiCases,
  paDesign,
  paSubModel,
  speakerAndFeed,
  withNet,
} from "./speaker-cases";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { bandDriveVolts, speakerLimits } from "../src/lib/speaker/speakerLimits";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { NO_FILTERS, lrFilter } from "../src/lib/speaker/specParts";
import { ampVoltage, hornPower } from "../src/lib/acoustics/boxModels";
import { CD_OPTIONS } from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK, DEFAULT_SPEAKER_BAND } from "../src/lib/defaults";
import { settledCabinet } from "../src/lib/speaker/speakerLayout";
import { newBandId } from "../src/pages/speaker/useSpeakerPage";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { PALETTES, bandLine } from "../src/styles/palette";
import {
  DRIVER_KIND,
  SPEAKER_BAND,
  SPEAKER_PART,
  SPEAKER_RESPONSE_VOLTS,
} from "../src/constants/speakerSpec";
import { INPUT_RANGE_LIMIT, LIMIT_NAMES, PER_FREQUENCY_LIMITS } from "../src/constants/limits";
import type {
  BandId,
  PaDesign,
  SpeakerFeed,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../src/types";

/** An 8 Ω load: the amp power's watts into it (lib/power). */
const EIGHT_OHM = { imp: 8 };

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
 * Tolerance for the PA sub's music limit (one drive for the whole band, before its lowpass): the PA sub box model's
 * `subwooferLimits` on a coarser grid, PA_MUSIC_DB, the same limit.
 */
const PA_MUSIC_DB = 0.02;

test("speaker limits: the PA designs meet the PA box models' horn power and sub music limit", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const tower = cfg.layout === "tower";
    const read = layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR);
    const models = paSubModel(cfg);
    const cd = CD_OPTIONS.find((o) => o.id === cfg.cd);
    assert.ok(cd?.hf);
    const subSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.sub);
    const topSide = speakerAndFeed(read, tower ? SPEAKER_PART.tower : SPEAKER_PART.top);
    const subChamber = subSide.spec.cabinet.chambers[0];
    // each speaker's input range is its source's filters, and the Speaker page models it with that range
    assert.deepEqual(subSide.spec.input, subSide.feed, `${c.name}: the sub's input range`);
    assert.deepEqual(topSide.spec.input, topSide.feed, `${c.name}: the top's input range`);
    // the sub box with the box model's net air
    const subSpec = withNet(subSide.spec, subChamber, models.s.netL);
    const topSpec = tower ? subSpec : topSide.spec;
    const topModel = modelOf(topSpec, topSpec.input);
    // the horn's power: the amp's or the driver's program rating, the lower
    const h = hornPower(cd.hf, cfg.xoHi, cfg.hfAmpW);
    const [power] = topModel.limits.drivers;
    assert.ok(Math.abs(power.watts - h.P) < 1e-9 * h.P, `${c.name}: horn power`);
    assert.equal(power.who, h.who, `${c.name}: what sets the horn's power`);
    // the sub's music limit: the sub box alone (the tower's low band carries its lowpass, which the box model leaves out)
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

test("speaker limits: a band-wide limit (the amp) names no frequency; a cone or vent limit names its own", () => {
  // the sub bin with a stronger driver on a 1500 W amp: the amp sets every frequency of the band alike
  const template = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
  const spec: SpeakerSpec = {
    ...template,
    cabinet: {
      ...template.cabinet,
      chambers: template.cabinet.chambers.map((c) => ({
        ...c,
        drivers: c.drivers.map((d) => ({ ...d, driverId: "by18qlex1600" })),
      })),
    },
    bands: template.bands.map((b) => ({ ...b, ampW: 1500 })),
  };
  const { limits } = modelOf(spec, spec.input);
  const [band] = limits.bands;
  assert.equal(band.who, LIMIT_NAMES.amp);
  assert.equal(band.whoHz, null, "the amp holds across the band: no first frequency");
  // a cone or vent limit: the band's maximum meets that limit at the frequency it names
  for (const name of ["DEFAULT_HIFI", "radiator"]) {
    const hifi = modelOf(hifiCase(name), NO_FILTERS).limits;
    for (const b of hifi.bands) {
      if (!PER_FREQUENCY_LIMITS.has(b.who)) {
        assert.equal(b.whoHz, null, `${name} ${b.id}`);
        continue;
      }
      const at = b.max.find((o) => o.f === b.whoHz);
      assert.ok(at, `${name} ${b.id}: a frequency of the grid`);
      assert.equal(at.who, b.who, `${name} ${b.id} at ${at.f.toFixed(0)} Hz`);
    }
  }
});

test("speaker limits: a passive speaker's shared amp limits the sum before the network, the same for every band", () => {
  const spec = hifiCase("passive");
  const { limits, room } = sumRooms(spec);
  const low = spec.bands.find((b) => b.id === SPEAKER_BAND.low);
  assert.ok(low);
  // the channel's ceiling: its full voltage on the input, which no network filter lifts
  const channel = 20 * Math.log10(ampVoltage(low.ampW, EIGHT_OHM) / SPEAKER_RESPONSE_VOLTS);
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
    Math.abs(
      bandDriveVolts(high, EIGHT_OHM) -
        ampVoltage(high.ampW, EIGHT_OHM) * 10 ** (high.levelDb / 20),
    ) < 1e-12,
  );
  // a network can't add gain: a band set above its channel gets the channel's full voltage
  assert.equal(
    bandDriveVolts({ ...high, levelDb: 3 }, EIGHT_OHM),
    ampVoltage(high.ampW, EIGHT_OHM),
  );
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

/** A PA design's speaker by part, read in through the PA adapter, its drivers settled on their baffles. */
function paSpeaker(pa: PaDesign, part: (typeof SPEAKER_PART)[keyof typeof SPEAKER_PART]) {
  const { spec } = speakerAndFeed(layersFromPa(pa, { id: "pa", name: "PA" }, PA_FLOOR), part);
  return { ...spec, cabinet: settledCabinet(spec.cabinet) };
}

test("speaker limits: a PA speaker brings its input range (the top above the sub crossover, the sub below it)", () => {
  for (const c of configs.filter((g) => g.layout !== "tower")) {
    const pa = paDesign(c);
    // the top: the mid meets its amp or rating below its band, not Xmax (the input range's highpass protects it)
    const top = paSpeaker(pa, SPEAKER_PART.top);
    assert.deepEqual(top.input.highpass, lrFilter(pa.xoLo, pa.xoLoOrder), c.name);
    const mid = bandOf(modelOf(top, top.input).limits, SPEAKER_BAND.mid);
    for (const o of mid.max.filter((p) => p.f >= 38 && p.f <= 52))
      assert.notEqual(o.who, LIMIT_NAMES.Xmax, `${c.name}: the mid at ${o.f.toFixed(0)} Hz`);
    assert.notEqual(mid.who, LIMIT_NAMES.Xmax, `${c.name}: the mid's music limit`);
    // the sub: the sum stops above the crossover (its own subsonic stays in its band)
    const sub = paSpeaker(pa, SPEAKER_PART.sub);
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
  const spec = paSpeaker(paDesign(tower), SPEAKER_PART.tower);
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
