// Stages in the coverage model: the barrier's loss curve, a stage face's reflection (and where it lands), a stage's
// shadow on a box behind it, and the room's modal range indoors, which doesn't see stages.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  BARRIER_CAP_DB,
  BARRIER_GRAZING_DB,
  barrierLossDb,
  edgeFade,
  fresnelRadius,
  type SceneStage,
} from "../src/lib/acoustics/stageAcoustics";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { levelAtPoint, sceneOf, sceneSlots } from "../src/lib/acoustics/coverage";
import {
  spaceGridRequest,
  spaceLevelAt,
  spaceModelLaidOut,
} from "../src/lib/speaker/spaceCoverage";
import { emptySpace } from "../src/pages/space/spaceSaves";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { rectCorners } from "../src/lib/speaker/spaceStages";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { STAGE_SHAPE } from "../src/constants/space";
import { INCHES_PER_FOOT } from "../src/constants/units";
import type { CoverageBand, CoverageRoom, FloorPoint, SpaceDesign, SpaceStage } from "../src/types";

/** A standing listener's ear, ft. */
const STANDING_EAR_FT = 5.5;

test("barrier: about 5 dB at grazing, continuous across the shadow boundary, 0 on the bright side, capped", () => {
  assert.equal(barrierLossDb(0), BARRIER_GRAZING_DB);
  assert.ok(Math.abs(barrierLossDb(1e-6) - BARRIER_GRAZING_DB) < 0.01);
  assert.ok(Math.abs(barrierLossDb(-1e-6) - BARRIER_GRAZING_DB) < 0.01);
  assert.equal(barrierLossDb(-0.2), 0);
  assert.equal(barrierLossDb(-1), 0);
  // Maekawa's curve: about 13 dB at N = 1
  assert.ok(Math.abs(barrierLossDb(1) - 13) < 0.5, `${barrierLossDb(1)}`);
  assert.equal(barrierLossDb(100), BARRIER_CAP_DB);
  // it only rises with N
  for (let n = -0.25; n < 6; n += 0.01)
    assert.ok(barrierLossDb(n + 0.01) >= barrierLossDb(n) - 1e-9, `${n}`);
});

const OUTDOORS: CoverageRoom = {
  widthFt: 60,
  lengthFt: 80,
  ceilingFt: 20,
  materials: { front: "open", back: "open", left: "open", right: "open", ceiling: "open" },
  crowd: "empty",
  outdoors: true,
};

test("stage face: a reflection point past the face's end gives no image there; on the face it does", () => {
  // a 1 m wide face at y = 1 m, 0.9 m high; a driver 0.5 m in front of it, aimed away from it
  const stage: SceneStage = {
    corners: [
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
      { x: -0.5, y: 1 },
    ],
    base: 0,
    top: 0.9,
  };
  const voices = [{ id: "v", pattern: { a: 0.1 } }];
  const box = [[{ voice: "v", x: 0, y: 1.5, z: 0.5, yaw: 0, pitch: 0, alignM: 0 }]];
  const level = (stages: SceneStage[], x: number, y: number) => {
    const scene = sceneOf(OUTDOORS, voices, box, stages);
    const slots = sceneSlots(scene, [1000], true, () => ({ v: { re: 1, im: 0 } }));
    return levelAtPoint(scene, slots, x, y, 1.7);
  };
  // from (8, 3) the reflection would land 1.6 m across, past the face's end at 0.5 m
  assert.ok(Math.abs(level([stage], 8, 3) - level([], 8, 3)) < 1e-9);
  // from straight in front it lands on the face
  assert.ok(Math.abs(level([stage], 0.5, 5) - level([], 0.5, 5)) > 0.1);
});

test("edge fade: ½ on the edge, full a zone inside, none a zone outside; wide at 50 Hz, narrow at 2 kHz", () => {
  const zone = (f: number) => fresnelRadius(SPEED_OF_SOUND / f, 3, 10);
  assert.equal(edgeFade(0, 1), 0.5);
  assert.equal(edgeFade(1, 1), 1);
  assert.equal(edgeFade(-1, 1), 0);
  for (let x = -1.2; x < 1.2; x += 0.01) assert.ok(edgeFade(x + 0.01, 1) >= edgeFade(x, 1));
  // 1 m past the edge: some of it at 50 Hz (a zone about 4 m), none at 2 kHz (about 0.6 m)
  assert.ok(zone(50) > 3.5 && zone(2000) < 0.7, `${zone(50)}, ${zone(2000)}`);
  assert.ok(edgeFade(-1, zone(50)) > 0.25 && edgeFade(1, zone(50)) < 0.75);
  assert.equal(edgeFade(-1, zone(2000)), 0);
  assert.equal(edgeFade(1, zone(2000)), 1);
});

test("stage face: its reflection fades out smoothly past the face's end, full well inside it and gone well outside", () => {
  // a face at y = 1 m from x = −3 to 0.5 m, 3 m high; a driver 0.5 m in front of it, aimed at it; the listener 5 m
  // down the room
  const face = (x0: number, x1: number): SceneStage => ({
    corners: [
      { x: x0, y: 0 },
      { x: x1, y: 0 },
      { x: x1, y: 1 },
      { x: x0, y: 1 },
    ],
    base: 0,
    top: 3,
  });
  const voices = [{ id: "v", pattern: { a: 0.1 } }];
  const box = [[{ voice: "v", x: 0, y: 1.5, z: 0.5, yaw: Math.PI, pitch: 0, alignM: 0 }]];
  const level = (stages: SceneStage[], x: number) => {
    const scene = sceneOf(OUTDOORS, voices, box, stages);
    // 1 kHz: the paths add by power
    const slots = sceneSlots(scene, [1000], false, () => ({ v: { re: 1, im: 0 } }));
    return levelAtPoint(scene, slots, x, 5, 1.7);
  };
  // the reflection lands at a ninth of the listener's x: the end at 0.5 m is under x = 4.5 m
  let last = level([face(-3, 0.5)], 2);
  for (let x = 2.02; x < 7; x += 0.02) {
    const now = level([face(-3, 0.5)], x);
    assert.ok(Math.abs(now - last) < 0.2, `${x}: ${last} → ${now}`);
    last = now;
  }
  assert.ok(level([face(-3, 0.5)], 2) - level([face(-3, 0.5)], 7) > 3);
  assert.ok(Math.abs(level([face(-3, 0.5)], -9) - level([face(-30, 30)], -9)) < 1e-9);
  assert.ok(Math.abs(level([face(-3, 0.5)], 20) - level([], 20)) < 1e-9);
});

/** A rectangular stage from x0 to x1 across and y0 to y1 down the room, ft. */
const stage = (
  [x0, y0, x1, y1]: [number, number, number, number],
  heightFt: number,
): SpaceStage => ({
  id: "a",
  shape: STAGE_SHAPE.rectangle,
  corners: rectCorners(x0, y0, x1, y1),
  heightFt,
  on: null,
});

const sub = { ...templateSpeaker(SPEAKER_TEMPLATE.genericSub18), id: "sub" };
const top = { ...templateSpeaker(SPEAKER_TEMPLATE.genericTop12), id: "top" };
const subDepthFt = speakerLayout(sub.cabinet).size.d / INCHES_PER_FOOT;

/** A space in a 40 × 60 ft room (outdoors or not) with these stages and boxes ([id, x, y], ft), the ear standing. */
function design(
  outdoors: boolean,
  stages: readonly SpaceStage[],
  spots: [string, number, number][],
): SpaceDesign {
  const { space } = emptySpace();
  return {
    space: {
      ...space,
      placements: spots.map(([id, x, y]) =>
        spacePlacement({ x, y }, { kind: SPACE_ITEM.speaker, id }, 0),
      ),
      venue: {
        ...space.venue,
        room: { ...space.venue.room, widthFt: 40, lengthFt: 60, outdoors },
        earFt: STANDING_EAR_FT,
        stages,
      },
    },
    stacks: [],
    speakers: [sub, top],
  };
}

/** The level at each spot in a band (or at one frequency), at the space's typed levels, dB. */
function levels(d: SpaceDesign, band: CoverageBand, freqHz: number, at: FloorPoint[]) {
  const model = spaceModelLaidOut(d);
  const req = spaceGridRequest(model, d.space.venue, band, freqHz, 8);
  return at.map((p) => spaceLevelAt(req, p));
}

/** The audience: a few spots in front of the stage, ft. */
const AUDIENCE: FloorPoint[] = [-6, 0, 6].flatMap((x) => [24, 32, 40].map((y) => ({ x, y })));

/** How much louder the audience gets with the stages than without, on average, dB. */
function gainDb(
  outdoors: boolean,
  stages: SpaceStage[],
  spots: [string, number, number][],
  band: CoverageBand,
  freqHz = 0,
) {
  const on = levels(design(outdoors, stages, spots), band, freqHz, AUDIENCE),
    off = levels(design(outdoors, [], spots), band, freqHz, AUDIENCE);
  return on.reduce((a, v, i) => a + v - off[i], 0) / on.length;
}

test("stage face outdoors: a sub flush in front of a 3 ft stage gains more at 300 Hz than at 50 Hz", () => {
  const stages = [stage([-8, 0, 8, 8], 3)];
  const spots: [string, number, number][] = [["sub", 0, 8 + subDepthFt]];
  const at50 = gainDb(true, stages, spots, "one", 50),
    at300 = gainDb(true, stages, spots, "one", 300);
  assert.ok(at50 > 0 && at50 < 2, `50 Hz: ${at50}`);
  assert.ok(at300 > at50 + 0.25, `50 Hz: ${at50}, 300 Hz: ${at300}`);
});

test("stage shadow outdoors: a top behind a 3 ft stage loses the high end in front of it, not the low end", () => {
  const stages = [stage([-8, 4, 8, 12], 3)];
  const spots: [string, number, number][] = [["top", 0, 1.5]];
  const high = gainDb(true, stages, spots, "high"),
    low = gainDb(true, stages, spots, "sub");
  assert.ok(high <= -10, `high: ${high}`);
  assert.ok(Math.abs(low) < 1, `sub: ${low}`);
});

test("indoors at 40 Hz the room's modes carry the sound: a stage changes nothing", () => {
  const stages = [stage([-8, 0, 8, 8], 3)];
  const spots: [string, number, number][] = [
    ["sub", -4, 8 + subDepthFt],
    ["top", 12, 20],
  ];
  assert.ok(Math.abs(gainDb(false, stages, spots, "one", 40)) < 1e-9);
});
