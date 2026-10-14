// A placement on the Space page turns a full circle: its yaw wraps within -180..180 (never clamps), a drag across the
// back of the room stays continuous, and a mirrored pair's image turns the other way at any angle.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { expandPlacements, wrapYawDeg, yawToward } from "../src/lib/speaker/spaceLayout";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import type { SpacePlacement } from "../src/types";

const placement = (over: Partial<SpacePlacement>): SpacePlacement => ({
  item: { kind: SPACE_ITEM.stack, id: "s" },
  x: 6,
  y: 10,
  liftIn: 0,
  aim: { yawDeg: 0, pitchDeg: 0 },
  mirror: false,
  mirrored: false,
  levelDb: 0,
  delayMs: 0,
  fill: false,
  ...over,
});

test("yaw wraps into -180..180 instead of clamping", () => {
  assert.equal(wrapYawDeg(190), -170);
  assert.equal(wrapYawDeg(-190), 170);
  assert.equal(wrapYawDeg(180), 180);
  assert.equal(wrapYawDeg(-180), 180);
  assert.equal(wrapYawDeg(540), 180);
  assert.equal(wrapYawDeg(135), 135);
  assert.equal(wrapYawDeg(0), 0);
});

test("a drag across 180 degrees stays continuous", () => {
  const at = { x: 0, y: 10 };
  // the pointer sweeps along a line behind the box, from its right to its left
  const yaws = [-20, -10, -1, 1, 10, 20].map((dx) => yawToward(at, { x: dx, y: 0 }));
  assert.ok(yaws.every((y) => y >= -180 && y <= 180));
  const jumps = yaws.slice(1).map((y, i) => Math.abs(wrapYawDeg(y - yaws[i])));
  assert.ok(Math.max(...jumps) < 60, `jumps: ${jumps.join(", ")}`);
  // past 90 either way is not clamped
  assert.ok(yawToward(at, { x: 5, y: 0 }) > 90);
  assert.ok(yawToward(at, { x: -5, y: 0 }) < -90);
  // across the seam, a hair either side of straight back are within 2 degrees of each other
  const seam = wrapYawDeg(yawToward(at, { x: -0.1, y: 0 }) - yawToward(at, { x: 0.1, y: 0 }));
  assert.ok(Math.abs(seam) <= 2, `seam jump ${seam}`);
});

test("a mirrored pair's image mirrors the yaw at any angle", () => {
  for (const [yaw, image] of [
    [135, -135],
    [-135, 135],
    [90, -90],
    [0, 0],
    [180, 180],
  ]) {
    const [, r] = expandPlacements([
      placement({ aim: { yawDeg: yaw, pitchDeg: 5 }, mirrored: true }),
    ]);
    assert.equal(r.aim.yawDeg, image);
    assert.equal(r.x, -6);
    assert.equal(r.aim.pitchDeg, 5);
  }
});
