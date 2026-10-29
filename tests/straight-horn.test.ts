import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  straightHornSizes,
  withStraightHorn,
  withStraightHornsFollowingBox,
} from "../src/pages/speaker/straightHorn";
import { CHAMBER_LOAD } from "../src/constants/speakerSpec";
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
