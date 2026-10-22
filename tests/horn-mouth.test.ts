// A horn radiates only from its mouth: one source per horn, its pattern plane by plane from the mouth's size and walls.
import { expect, test } from "vite-plus/test";
import assert from "node:assert";
import { driverSpotsIn } from "../src/lib/speaker/stackLayout";
import { bandOfPart, driverPattern } from "../src/lib/speaker/spaceCoverage";
import { layStack } from "../src/lib/speaker/spaceLayout";
import { stackMember } from "../src/lib/speaker/specParts";
import { mouthPlane, mouthPlaneGain } from "../src/lib/acoustics/directivity";
import { beamHalfAngles } from "../src/lib/speaker/spaceBeams";
import { dispersionModeled } from "../src/lib/speaker/stackDispersion";
import { keeleFrequency } from "../src/lib/acoustics/boxModels";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  FOLD_WALL,
  HORN_PLACEMENT,
  SPEAKER_BAND,
} from "../src/constants/speakerSpec";
import { BEAM_EDGE_DB, DRIVER_PART } from "../src/constants/space";
import { RAD } from "../src/constants/units";
import { directivityAt, type CoveragePattern } from "../src/lib/acoustics/coverage";

/** A box's width, in: only what reaches behind it, which a beam's edges in front never see. */
const BOX_W_IN = 20;

/** A pattern's −6 dB half angles at `f`, degrees: across and up. */
const halfDeg = (pattern: CoveragePattern, f: number) =>
  beamHalfAngles(directivityAt(pattern, f, BOX_W_IN), BEAM_EDGE_DB).map((a) => a / RAD);

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

test("a horn with a cone and a compression driver inside plays both bands from its mouth, each once", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
  const hf = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn)
    .cabinet.chambers.flatMap((c) => c.drivers)
    .find((d) => d.kind === DRIVER_KIND.compression);
  assert(hf, "the tower has a compression driver");
  const [chamber] = spec.cabinet.chambers;
  const both = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [
        {
          ...chamber,
          drivers: [
            ...chamber.drivers,
            {
              ...hf,
              horn: hf.horn && { ...hf.horn, placement: HORN_PLACEMENT.baffle },
              bands: [SPEAKER_BAND.high],
            },
          ],
        },
      ],
    },
  };
  const { drivers } = layStack(
    { stack: { members: [stackMember(both.id, both.input)] }, speakers: [both] },
    { x: 0, y: 0, liftIn: 0, aim: { yawDeg: 0, pitchDeg: 0 }, image: false, upsideDown: false },
    bandOfPart,
  );
  const bands = drivers.map((d) => d.band);
  expect(new Set(bands)).toEqual(new Set([chamber.drivers[0].bands[0], SPEAKER_BAND.high]));
  // one spot per band, every one at the mouth
  expect(bands).toHaveLength(2);
  expect(drivers.every((d) => d.mouth !== null)).toBe(true);
});

test("behind a mouth, a piston plane and a held plane both keep their value at a quarter turn", () => {
  for (const plane of [mouthPlane(2000, 20, null), mouthPlane(2000, 20, 60)])
    for (const angle of [2, Math.PI, -2.5])
      expect(mouthPlaneGain(angle, plane)).toBe(mouthPlaneGain(Math.PI / 2, plane));
});
