// A horn radiates only from its mouth: one source per horn, its pattern plane by plane from the mouth's size and walls.
import { expect, test } from "vite-plus/test";
import assert from "node:assert";
import { driverSpotsIn } from "../src/lib/speaker/stackLayout";
import { driverPattern } from "../src/lib/speaker/spaceCoverage";
import { beamHalfAngles } from "../src/lib/speaker/spaceBeams";
import { dispersionModeled } from "../src/lib/speaker/stackDispersion";
import { keeleFrequency } from "../src/lib/acoustics/boxModels";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, FOLD_WALL } from "../src/constants/speakerSpec";
import { BEAM_EDGE_DB, DRIVER_PART } from "../src/constants/space";
import { RAD } from "../src/constants/units";
import type { CoveragePattern } from "../src/lib/acoustics/coverage";

/** A pattern's −6 dB half angles at `f`, degrees: across and up. */
const halfDeg = (pattern: CoveragePattern, f: number) =>
  beamHalfAngles(pattern, f, BEAM_EDGE_DB).map((a) => a / RAD);

/** The one mouth spot of a template's horn, and its pattern. */
function mouthOf(template: (typeof SPEAKER_TEMPLATE)[keyof typeof SPEAKER_TEMPLATE]) {
  const spots = driverSpotsIn(templateSpeaker(template));
  expect(spots).toHaveLength(1);
  const [spot] = spots;
  assert(spot.mouth, "the horn's spot is its mouth");
  return { spot, mouth: spot.mouth, pattern: driverPattern({ ...spot, part: DRIVER_PART.cone }) };
}

test("TH18 has one source, its drawn mouth on the baffle, with the driver board as its upper wall", () => {
  const { spot, mouth } = mouthOf(SPEAKER_TEMPLATE.th18);
  expect(spot.points).toHaveLength(1);
  expect(spot.facing).toBe(FOLD_WALL.baffle);
  // the mouth runs from the inside bottom to the driver board: 508 mm, the chamber's clear width across
  expect(mouth.h).toBeCloseTo(20, 3);
  expect(mouth.wallDeg.h).toBeNull();
  // the driver board falls 24.2° from the mouth's top; the bottom is square to the baffle
  expect(mouth.wallDeg.v).toBeCloseTo(24.2, 0);
  expect(dispersionModeled([templateSpeaker(SPEAKER_TEMPLATE.th18)])).toBe(true);
});

test("a straight horn with a wide, short mouth is narrower vertically than horizontally", () => {
  const { mouth, pattern } = mouthOf(SPEAKER_TEMPLATE.paV2SubBinOne);
  expect(mouth.w).toBeGreaterThan(mouth.h);
  // the side walls flare; the top and bottom are parallel
  assert(mouth.wallDeg.h !== null);
  expect(mouth.wallDeg.v).toBeNull();
  for (const f of [2000, 4000]) {
    const [h, v] = halfDeg(pattern, f);
    expect(v).toBeLessThan(h);
  }
});

test("a horn's −6 dB half angle stops narrowing above its control frequency", () => {
  const pattern: CoveragePattern = { mouth: { wIn: 20, hIn: 20, wallH: 60, wallV: 60 } };
  const control = keeleFrequency(60, 20);
  const [below] = halfDeg(pattern, control / 4);
  expect(below).toBeGreaterThan(31);
  for (const f of [control, 2 * control, 8 * control])
    expect(halfDeg(pattern, f)[0]).toBeCloseTo(30, 6);
});

test("parallel walls keep narrowing where flared walls hold their angle", () => {
  const pattern: CoveragePattern = { mouth: { wIn: 20, hIn: 20, wallH: 60, wallV: null } };
  const control = keeleFrequency(60, 20);
  const [held2, parallel2] = halfDeg(pattern, 2 * control);
  const [held4, parallel4] = halfDeg(pattern, 4 * control);
  expect(held4).toBeCloseTo(held2, 6);
  expect(parallel2).toBeLessThan(held2);
  expect(parallel4).toBeLessThan(parallel2 * 0.6);
});

test("a folded horn with no drawing keeps its cones as sources, and the map stays off", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.th18);
  const [chamber] = spec.cabinet.chambers;
  assert(chamber.load.kind === CHAMBER_LOAD.horn);
  const undrawn = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [
        { ...chamber, load: { ...chamber.load, horn: { ...chamber.load.horn, fold: undefined } } },
      ],
    },
  };
  expect(driverSpotsIn(undrawn).every((s) => s.mouth === null)).toBe(true);
  expect(dispersionModeled([undrawn])).toBe(false);
});
