// The dispersion check at a crossover between a speaker's bands (src/lib/speaker/dispersionCheck): on the Speaker page's
// band rows (bandChips) and each Stack member's band rows (stackCheckRows), on hi-fi designs.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { dispersionChecks } from "../src/lib/speaker/dispersionCheck";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackMember } from "../src/lib/speaker/specParts";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { bandChips } from "../src/lib/speaker/speakerChips";
import { stackCheckRows } from "../src/pages/stack/stackChips";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { DRIVER_KIND, SPEAKER_BAND } from "../src/constants/speakerSpec";
import { DISPERSION_TEXT } from "../src/constants/dispersionCheck";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { speakerDispersionMap } from "../src/lib/speaker/stackDispersion";
import { dispersionGrid } from "../src/lib/acoustics/directivity";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import type { HifiDesignState, SpeakerSpec, StackSpec } from "../src/types";

const IDENTITY = { id: "hifi", name: "Hi-fi speaker" };
const hifiSpec = (state: HifiDesignState) => speakerFromHifi(state, DEFAULT_HIFI_LOOK, IDENTITY);

test("the Hi-fi 2-way gives one chip, on its low band, naming the high band", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const checks = dispersionChecks(spec);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].lower, SPEAKER_BAND.low);
  assert.equal(checks[0].upper, SPEAKER_BAND.high);
  const [kind, title] = checks[0].chip;
  assert.equal(kind, "ok");
  assert.equal(title, DISPERSION_TEXT.okTitle("High"));
  const rows = bandChips(spec, speakerLimits(spec, speakerResponse(spec)), speakerResponse(spec));
  const withChip = rows.filter((r) => r.chips.some(([, , , id]) => id === "speakerDispersion"));
  assert.deepEqual(
    withChip.map((r) => r.id),
    [SPEAKER_BAND.low],
  );
});

test("the check's words are the Speaker page's, naming the band", () => {
  assert.equal(DISPERSION_TEXT.warnTitle("High"), "Narrower than High at the crossover");
  assert.equal(
    DISPERSION_TEXT.warnTip(70, "High", DISPERSION_TEXT.coverage.degrees(100), 2000),
    "About 70° against High's 100°: an off-axis dip below 2000 Hz. Use a lower crossover.",
  );
  assert.equal(DISPERSION_TEXT.okTitle("High"), "Matches High at the crossover");
  assert.equal(DISPERSION_TEXT.okTip(157, 2000), "About 157° wide at 2000 Hz.");
});

test("a large woofer at a high crossover warns, and a band's own name is used", () => {
  const state: HifiDesignState = { ...DEFAULT_HIFI, crossoverHz: 6000 };
  const spec = hifiSpec(state);
  const [check] = dispersionChecks({
    ...spec,
    bands: spec.bands.map((b) => (b.id === SPEAKER_BAND.high ? { ...b, name: "Tweeter" } : b)),
  });
  assert.equal(check.chip[0], "warn");
  assert.equal(check.chip[1], DISPERSION_TEXT.warnTitle("Tweeter"));
  assert.match(
    check.chip[2],
    /^About \d+° against Tweeter's wide dome: an off-axis dip below 6000 Hz\./,
  );
});

test("a horn-loaded low chamber gives no chip", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  assert.equal(dispersionChecks(spec).length, 1);
  const horn = templateSpeaker(SPEAKER_TEMPLATE.th18).cabinet.chambers[0].load;
  const loaded: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c) => ({ ...c, load: horn })),
    },
  };
  assert.deepEqual(dispersionChecks(loaded), []);
});

test("one band, or no filter between bands, gives no chip", () => {
  for (const t of [SPEAKER_TEMPLATE.empty, SPEAKER_TEMPLATE.paSubBox, SPEAKER_TEMPLATE.th18]) {
    assert.deepEqual(dispersionChecks(templateSpeaker(t)), [], t);
  }
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const unfiltered: SpeakerSpec = {
    ...spec,
    bands: spec.bands.map((b) => ({ ...b, highpass: null, lowpass: null })),
  };
  assert.deepEqual(dispersionChecks(unfiltered), []);
});

test("a 3-way has one chip per crossover, each on its lower band", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  assert.deepEqual(
    dispersionChecks(spec).map((c) => [c.lower, c.upper]),
    [
      [SPEAKER_BAND.low, SPEAKER_BAND.mid],
      [SPEAKER_BAND.mid, SPEAKER_BAND.high],
    ],
  );
  const mid = templateSpeaker(SPEAKER_TEMPLATE.paMidHighBox);
  assert.deepEqual(
    dispersionChecks(mid).map((c) => [c.lower, c.upper]),
    [[SPEAKER_BAND.mid, SPEAKER_BAND.high]],
  );
});

test("the Stack page shows each member speaker's own crossings, in the member's band rows", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const sub = { ...templateSpeaker(SPEAKER_TEMPLATE.paSubBox), id: "sub" };
  /** the dispersion chips of a stack's rows, by row label */
  const dispersionRows = (
    stack: Pick<StackSpec, "members">,
    speakers: SpeakerSpec[],
    names: string[],
  ) => {
    const response = stackResponse(stack, speakers);
    return stackCheckRows(stack, response, stackLimits(stack, response), names).flatMap((r) =>
      r.chips.filter((c) => c[3] === "speakerDispersion").map((c) => [r.row, c[1]]),
    );
  };
  assert.deepEqual(
    dispersionRows(
      { members: [stackMember(spec.id, spec.input), stackMember(spec.id, spec.input)] },
      [spec],
      ["1. Box", "2. Box"],
    ),
    [
      ["1. Box: Low band", DISPERSION_TEXT.okTitle("High")],
      ["2. Box: Low band", DISPERSION_TEXT.okTitle("High")],
    ],
  );
  // a speaker with one band has no crossing inside it, and none is checked between members
  assert.deepEqual(
    dispersionRows(
      { members: [stackMember(spec.id, spec.input), stackMember(sub.id, sub.input)] },
      [spec, sub],
      ["1. Box", "2. Sub"],
    ).map(([row]) => row),
    ["1. Box: Low band"],
  );
});

test("a cone over the crossover covers its own beam there, not a dome's", () => {
  for (const id of [SPEAKER_TEMPLATE.paTowerBaffleHorn, SPEAKER_TEMPLATE.paTowerTopHorn]) {
    const checks = dispersionChecks(templateSpeaker(id));
    assert.ok(checks.length > 0, `${id}: has a crossing`);
    for (const k of checks)
      assert.ok(!k.chip[2].includes(DISPERSION_TEXT.coverage.dome), `${id}: ${k.chip[2]}`);
  }
});

test("a horn-loaded cone beside a direct woofer on the same band leaves the check on the direct one", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const horn = templateSpeaker(SPEAKER_TEMPLATE.th18).cabinet.chambers[0];
  const woofer = spec.cabinet.chambers.find((c) =>
    c.drivers.some((d) => d.bands[0] === SPEAKER_BAND.low),
  );
  assert.ok(horn && woofer, "the templates have the chambers");
  const extra = { ...horn, drivers: woofer.drivers.filter((d) => d.bands[0] === SPEAKER_BAND.low) };
  const mixed: SpeakerSpec = {
    ...spec,
    cabinet: { ...spec.cabinet, chambers: [...spec.cabinet.chambers, extra] },
  };
  assert.deepEqual(
    dispersionChecks(mixed).map((k) => k.chip[1]),
    dispersionChecks(spec).map((k) => k.chip[1]),
  );
});

test("a cone's beam in the chip is the width the dispersion map shows for that cone at that frequency", () => {
  const { freqs } = dispersionGrid();
  const i = freqs.findIndex((f) => f >= 4000);
  const spec = hifiSpec({ ...DEFAULT_HIFI, crossoverHz: freqs[i] });
  const [check] = dispersionChecks(spec);
  const chipDeg = Number(/^About (\d+)°/.exec(check.chip[2])?.[1]);
  // the same speaker with its woofer alone, so the map shows that cone's own beam
  const woofer: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c) => ({
        ...c,
        drivers: c.drivers.filter(
          (d) => d.bands[0] === SPEAKER_BAND.low && d.kind !== DRIVER_KIND.tweeter,
        ),
      })),
    },
  };
  const map = speakerDispersionMap(woofer, speakerResponse(woofer, { feed: woofer.input }), "h");
  // the first angle off the axis where the map falls 6 dB, between its grid angles in pressure
  const pressure = (row: number) => 10 ** (map.rows[row][i] / 20);
  const zero = map.angles.indexOf(0);
  const past = map.angles.findIndex((deg, row) => deg > 0 && pressure(row) < 0.5);
  assert.ok(past > zero, "the map narrows past 6 dB inside 90°");
  const share = (pressure(past - 1) - 0.5) / (pressure(past - 1) - pressure(past));
  const mapDeg = 2 * (map.angles[past - 1] + share * (map.angles[past] - map.angles[past - 1]));
  assert.ok(chipDeg < 180, `the cone narrows at ${freqs[i]} Hz`);
  assert.ok(Math.abs(chipDeg - mapDeg) <= 2, `chip ${chipDeg}°, map ${mapDeg.toFixed(1)}°`);
});
