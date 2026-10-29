import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  straightHornSizes,
  withStraightHorn,
  withStraightHornsFollowingBox,
} from "../src/pages/speaker/straightHorn";
import { CHAMBER_LOAD, PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import { coneParts } from "../src/lib/speaker/driverParts";
import { conesAreaCm2, frontChamber, throatCones } from "../src/lib/speaker/hornThroat";
import { chamberSetbackIn } from "../src/lib/speaker/driverBoard";
import type { SpeakerCabinet, SpeakerChamber } from "../src/types";

const cabinet = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox).cabinet;
const segmentOf = (c: SpeakerChamber) => {
  assert.ok(c.load.kind === CHAMBER_LOAD.horn);
  const [segment] = c.load.horn.segments;
  assert.ok(segment);
  return segment;
};
const withChamber = (cab: SpeakerCabinet, c: SpeakerChamber): SpeakerCabinet => ({
  ...cab,
  chambers: [c],
});

test("straight horn: worked out from the box, the mouth fills the face as the preset sets it", () => {
  const next = withStraightHorn(cabinet, 0);
  assert.ok(next);
  const [before] = cabinet.chambers;
  assert.ok(before);
  // the preset's mouth is the face between the slots, so it stays within a square inch
  assert.ok(Math.abs(segmentOf(next).s2 - segmentOf(before).s2) < 6.5);
  assert.equal(segmentOf(next).length, segmentOf(before).length);
  assert.ok((next.netLiters ?? 0) > 0);
});

test("straight horn: a longer flare leaves less rear chamber", () => {
  const sizes = straightHornSizes(cabinet, 0);
  assert.ok(sizes);
  const longer = withStraightHorn(cabinet, 0, { flareIn: sizes.flareIn + 2 });
  const shorter = withStraightHorn(cabinet, 0, { flareIn: sizes.flareIn - 2 });
  assert.ok(longer && shorter);
  assert.ok((longer.netLiters ?? 0) < (shorter.netLiters ?? 0));
});

test("straight horn: the flare stays inside the box", () => {
  const sizes = straightHornSizes(cabinet, 0);
  assert.ok(sizes);
  const next = withStraightHorn(cabinet, 0, { flareIn: 1000 });
  assert.ok(next);
  const after = straightHornSizes(withChamber(cabinet, next), 0);
  assert.ok(after);
  assert.ok(Math.abs(after.flareIn - sizes.maxFlareIn) < 1e-9);
});

test("straight horn: the ratio sets the throat from the cones' area", () => {
  const next = withStraightHorn(cabinet, 0, { ratio: 2.5 });
  assert.ok(next);
  const sizes = straightHornSizes(withChamber(cabinet, next), 0);
  assert.ok(sizes);
  assert.ok(Math.abs(sizes.ratio - 2.5) < 1e-9);
});

test("straight horn: a wider box widens the mouth and keeps the flare", () => {
  const [c] = cabinet.chambers;
  assert.ok(c);
  const wider = withChamber(cabinet, { ...c, dims: { ...c.dims, w: c.dims.w + 4 } });
  const followed = withStraightHornsFollowingBox(cabinet, wider);
  const [after] = followed.chambers;
  assert.ok(after);
  assert.ok(segmentOf(after).s2 > segmentOf(c).s2);
  assert.equal(segmentOf(after).length, segmentOf(c).length);
});

test("straight horn: an edit that keeps the box leaves the cabinet as it is", () => {
  assert.equal(withStraightHornsFollowingBox(cabinet, cabinet), cabinet);
});

test("straight horn: the rear chamber is the box's inside less the flare, the driver, the front chamber and the slots", () => {
  // by hand, from the box's sizes: the Mid box (one chamber, frame with no inset: walls all round, the slots up the
  // front sides), its exponential flare made 12 in long at a 1.5 ratio
  const next = withStraightHorn(cabinet, 0, { flareIn: 12, ratio: 1.5 });
  const [c] = cabinet.chambers;
  assert.ok(next && c && c.vent.kind === VENT_KIND.vented && c.vent.port.shape === PORT_SHAPE.slot);
  const t = cabinet.panel.thicknessIn;
  const { n, h: slotW, len } = c.vent.port;
  const CC_PER_IN3 = 16.387064;
  const clear = { w: c.dims.w - 2 * t, h: c.dims.h - 2 * t, d: c.dims.d - 2 * t };
  const insideL = (clear.w * clear.h * clear.d * CC_PER_IN3) / 1000;
  // the mouth: the clear face less each side's slot and its wall
  const mouthCm2 = (clear.w - n * (slotW + t)) * clear.h * 6.4516;
  const throatCm2 = conesAreaCm2(c.drivers) / 1.5;
  const flareCm = 12 * 2.54;
  // an exponential flare's air: its length times (S2 − S1) over ln(S2 / S1)
  const flareL = (flareCm * (mouthCm2 - throatCm2)) / Math.log(mouthCm2 / throatCm2) / 1000;
  const slotsL = (n * slotW * clear.h * len * CC_PER_IN3) / 1000;
  // the driver's displacement and the front chamber, as the model takes them (the front chamber is Hornresp's Vtc)
  const displacementL = c.drivers.reduce((sum, d) => sum + (coneParts(d)?.dispL ?? 0) * d.count, 0);
  const throat = throatCones(c.drivers);
  assert.ok(throat);
  const frontL = frontChamber(
    throat.cone,
    throat.count,
    chamberSetbackIn(cabinet.panel, next),
  ).liters;
  const expected = insideL - flareL - slotsL - displacementL - frontL;
  assert.ok(
    Math.abs((next.netLiters ?? 0) - expected) <= 0.05,
    `rear chamber ${next.netLiters} L, by hand ${expected.toFixed(2)} L`,
  );
});
