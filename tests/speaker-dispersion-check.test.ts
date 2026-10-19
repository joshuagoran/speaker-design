// The dispersion check at a crossover between a speaker's bands (src/lib/speaker/dispersionCheck): on the Speaker page's
// band rows (bandChips) and the Stack page's lists (stackDispersionChips), against the Hi-fi page's check on the same design.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { dispersionChecks } from "../src/lib/speaker/dispersionCheck";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { stackMember } from "../src/lib/speaker/specParts";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { bandChips } from "../src/pages/speaker/speakerChips";
import { stackDispersionChips } from "../src/pages/stack/stackChips";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import { DISPERSION_TEXT } from "../src/constants/dispersionCheck";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { deriveHifiDesign } from "../src/lib/hifi/hifiDesign";
import { hifiChips, hifiSystem } from "../src/lib/hifi/hifi";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import type { HifiDesignState, SpeakerSpec } from "../src/types";

const IDENTITY = { id: "hifi", name: "Hi-fi speaker" };
const hifiSpec = (state: HifiDesignState) => speakerFromHifi(state, DEFAULT_HIFI_LOOK, IDENTITY);

/** The Hi-fi page's own dispersion check on a design, as its chips give it. */
function hifiPageCheck(state: HifiDesignState) {
  const d = deriveHifiDesign(state);
  const sys = hifiSystem(state.woofer, d.tweeterWithWaveguide, d.speakerConfig);
  assert.ok(sys);
  const chip = hifiChips(sys, state.woofer, d.tweeterWithWaveguide, d.speakerConfig).find(
    ([, , , id]) => id === "hifiDispersion",
  );
  assert.ok(chip);
  return chip;
}

/** The degrees a chip's detail names first ("About 157° ..."). */
const degreesIn = (detail: string) => Number(/[Aa]bout (\d+)°/.exec(detail)?.[1]);

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
    DISPERSION_TEXT.warnTip(70, "High", DISPERSION_TEXT.coverage.rated(100), 2000),
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

test("the Hi-fi page's check is unchanged, and the Speaker page agrees with it on the same design", () => {
  const page = hifiPageCheck(DEFAULT_HIFI);
  assert.deepEqual(page.slice(0, 2), ["ok", "Dispersion matches at the crossover"]);
  assert.match(page[2], /^The woofer is about \d+° wide at 2000 Hz\.$/);
  const wide = hifiPageCheck({ ...DEFAULT_HIFI, crossoverHz: 6000 });
  assert.equal(wide[0], "warn");
  assert.equal(wide[1], "Woofer narrower than the tweeter at the crossover");
  assert.match(wide[2], /an off-axis dip below 6000 Hz\. Use a lower crossover\.$/);
  for (const state of [DEFAULT_HIFI, { ...DEFAULT_HIFI, crossoverHz: 6000 }]) {
    const [ours] = dispersionChecks(hifiSpec(state));
    const theirs = hifiPageCheck(state);
    assert.equal(ours.chip[0], theirs[0]);
    assert.equal(degreesIn(ours.chip[2]), degreesIn(theirs[2]));
  }
});

test("the Stack page lists each member speaker's own crossings, under the member's name", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const stack = { members: [stackMember(spec.id, spec.input), stackMember(spec.id, spec.input)] };
  const lists = stackDispersionChips(stack, [spec], ["1. Box", "2. Box"]);
  assert.equal(lists.length, 2);
  assert.equal(lists[0].heading, "1. Box: Low to High");
  assert.equal(lists[0].chips[0][3], "stackDispersion");
  assert.equal(lists[0].chips[0][1], DISPERSION_TEXT.okTitle("High"));
  // a speaker with one band has no crossing inside it, and none is checked between members
  const sub = { ...templateSpeaker(SPEAKER_TEMPLATE.paSubBox), id: "sub" };
  assert.deepEqual(
    stackDispersionChips(
      { members: [stackMember(spec.id, spec.input), stackMember(sub.id, sub.input)] },
      [spec, sub],
      ["1. Box", "2. Sub"],
    ).map((l) => l.heading),
    ["1. Box: Low to High"],
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
