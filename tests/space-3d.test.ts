// The Space page's 3D view (stack-view/buildSpaceScene) and its beams (lib/speaker/spaceBeams): each box stands where
// the space model places it (spaceLayout `placementFrame`), the room's clipping planes keep a beam inside it, a wall
// between the camera and the room is the near one, and a beam's angles are where the driver pattern falls 6 dB.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  beamGeometry,
  buildSpaceScene,
  posePlacement,
  roomClipPlanes,
  roomPointIn,
  spaceSceneKey,
  wallIsNear,
  type SpaceSceneProps,
} from "../src/components/stack-view/buildSpaceScene";
import { FRAME_BOX_KEY } from "../src/components/stack-view/sceneFraming";
import { beamHalfAngles, spaceBeams } from "../src/lib/speaker/spaceBeams";
import { placementFrame } from "../src/lib/speaker/spaceLayout";
import { pistonDirectivity, waveguideHalfAngles } from "../src/lib/acoustics/directivity";
import { spaceFromStart } from "../src/pages/space/useSpace";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { INCHES_PER_FOOT, METERS_PER_FOOT } from "../src/constants/units";
import { DRIVER_PART, ROOM_SURFACE_NAME } from "../src/constants/space";
import { spaceModel } from "./helpers";
import type { DriverPart, SpacePlacement } from "../src/types";
import type { RoomPoint } from "../src/lib/speaker/spaceLayout";

const POSES: Pick<SpacePlacement, "x" | "y" | "liftIn" | "aim" | "mirror">[] = [
  { x: 0, y: 0, liftIn: 0, aim: { yawDeg: 0, pitchDeg: 0 }, mirror: false },
  { x: -9, y: 3, liftIn: 72, aim: { yawDeg: 30, pitchDeg: -10 }, mirror: false },
  { x: 6, y: 12, liftIn: 12, aim: { yawDeg: -135, pitchDeg: 8 }, mirror: true },
];
/** Points of a stack, in: across its center line, up from its base, back from its front. */
const STACK_POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 20, z: 5 },
  { x: -7, y: 44, z: 18 },
];

describe("Space 3D view: each box stands where the model places it", () => {
  for (const [k, pose] of POSES.entries())
    test(`pose ${k}`, () => {
      const holder = new THREE.Group();
      posePlacement(holder, pose);
      holder.updateMatrixWorld();
      const frame = placementFrame(pose);
      for (const q of STACK_POINTS) {
        // the stack's own scene: its front toward three's +z
        const drawn = new THREE.Vector3(q.x, q.y, -q.z).applyMatrix4(holder.matrixWorld);
        const placed = roomPointIn(frame.toRoom(q));
        expect(drawn.distanceTo(placed)).toBeLessThan(1e-9);
      }
    });
});

const ROOM = { widthFt: 30, lengthFt: 40, ceilingFt: 12, outdoors: false };

test("the room's clipping planes keep what is inside it and cut what is outside", () => {
  const planes = roomClipPlanes(ROOM);
  expect(planes.length).toBe(6);
  const inside = roomPointIn({ x: 14, y: 39, z: 11 });
  for (const plane of planes) expect(plane.distanceToPoint(inside)).toBeGreaterThan(0);
  for (const outside of [
    { x: 16, y: 10, z: 5 },
    { x: -16, y: 10, z: 5 },
    { x: 0, y: -1, z: 5 },
    { x: 0, y: 41, z: 5 },
    { x: 0, y: 10, z: 13 },
    { x: 0, y: 10, z: -1 },
  ]) {
    const p = roomPointIn(outside);
    expect(planes.some((plane) => plane.distanceToPoint(p) < 0)).toBe(true);
  }
  // outdoors only the ground cuts
  const ground = roomClipPlanes({ ...ROOM, outdoors: true });
  expect(ground.length).toBe(1);
  expect(ground[0].distanceToPoint(roomPointIn({ x: 0, y: 0, z: -1 }))).toBeLessThan(0);
});

test("a wall between the camera and the room is the near one", () => {
  const back = {
    center: roomPointIn({ x: 0, y: ROOM.lengthFt, z: 6 }),
    normal: new THREE.Vector3(0, 0, -1),
  };
  const front = { center: roomPointIn({ x: 0, y: 0, z: 6 }), normal: new THREE.Vector3(0, 0, 1) };
  const behindAudience = roomPointIn({ x: 5, y: 60, z: 20 });
  expect(wallIsNear(back, behindAudience)).toBe(true);
  expect(wallIsNear(front, behindAudience)).toBe(false);
});

test("a beam's angles: where the pattern falls 6 dB", () => {
  // a piston small against the wavelength never falls 6 dB in front: a quarter turn each way
  expect(beamHalfAngles({ a: 0.05 }, 100)).toEqual([Math.PI / 2, Math.PI / 2]);
  // a 15 inch cone at 2 kHz: the pattern is one half at the angle
  const a = 0.19;
  const [h, v] = beamHalfAngles({ a }, 2000);
  expect(h).toBe(v);
  expect(20 * Math.log10(pistonDirectivity(2000, a, h))).toBeCloseTo(-6.02, 1);
  // a horn: its own half angles, never past a quarter turn
  const horn = { covH: 90, covV: 40, wIn: 20, hIn: 10 };
  expect(beamHalfAngles({ horn }, 8000)).toEqual(waveguideHalfAngles(8000, 90, 40, 20, 10));
  for (const half of beamHalfAngles({ horn }, 40)) expect(half).toBeLessThanOrEqual(Math.PI / 2);
});

// float32 positions: to 4 places
test("a beam's surface runs from its apex out to its length", () => {
  const g = beamGeometry([0.5, 0.3], 100);
  const box = new THREE.Box3().setFromObject(new THREE.Mesh(g));
  expect(box.min.z).toBeCloseTo(0, 4);
  expect(box.max.z).toBeCloseTo(100, 4);
  expect(box.max.x).toBeCloseTo(100 * Math.sin(0.5), 4);
  expect(box.max.y).toBeCloseTo(100 * Math.sin(0.3), 4);
});

describe("Space 3D view: the PA stack preset", () => {
  const design = spaceFromStart(STACK_PRESET.paStack);
  const model = spaceModel(design);
  const { venue } = design.space;
  /** a map's target the horns reach across the room, dB */
  const TARGET_DB = 100;
  const props = (over: Partial<SpaceSceneProps> = {}): SpaceSceneProps => ({
    room: venue.room,
    items: model.placements.map((p) => p.item),
    listener: venue.listener,
    alignAt: venue.alignAt,
    earFt: venue.earFt,
    view: null,
    beams: spaceBeams(model, "high", 1000, TARGET_DB),
    cutaway: false,
    theme: "light",
    ...over,
  });

  test("each box beams along its aim, from inside the room", () => {
    const beams = spaceBeams(model, "high", 1000, TARGET_DB);
    expect(beams.length).toBeGreaterThan(0);
    const yaws = new Set(model.placements.map((p) => p.item.placement.aim.yawDeg));
    for (const b of beams) {
      expect(yaws.has(Math.round((b.yaw * 180) / Math.PI))).toBe(true);
      expect(Math.abs(b.at.x)).toBeLessThanOrEqual(venue.room.widthFt / 2);
      expect(b.at.z).toBeGreaterThan(0);
    }
  });

  /** Each beam's origin, rounded to 0.01 ft, as a key. */
  const spot = (p: RoomPoint) => [p.x, p.y, p.z].map((v) => v.toFixed(2)).join();
  /** The middle of each box's drivers of each part, by its spot. */
  const partSpots = (part: DriverPart) =>
    new Set(
      model.placements.flatMap(({ item }) => {
        const groups = new Map<string, RoomPoint[]>();
        for (const d of item.drivers)
          if (d.part === part)
            groups.set(`${d.member}/${d.band}`, [
              ...(groups.get(`${d.member}/${d.band}`) ?? []),
              d.at,
            ]);
        return [...groups.values()].map((at) => {
          const mean = (pick: (p: RoomPoint) => number) =>
            at.reduce((s, p) => s + pick(p), 0) / at.length;
          return spot({ x: mean((p) => p.x), y: mean((p) => p.y), z: mean((p) => p.z) });
        });
      }),
    );

  test("the beams come from the drivers that play the map's band", () => {
    const hf = partSpots(DRIVER_PART.hf),
      cone = partSpots(DRIVER_PART.cone);
    // a target any band reaches: every band that plays the high band beams, the cones as well as the horns
    const all = spaceBeams(model, "high", 1000, 0).map((b) => spot(b.at));
    expect(all.some((at) => hf.has(at))).toBe(true);
    expect(all.some((at) => cone.has(at))).toBe(true);
    for (const at of all) expect(hf.has(at) || cone.has(at)).toBe(true);
    // the bass bands spread every way: no beams
    expect(spaceBeams(model, "sub", 1000, 0)).toEqual([]);
    expect(spaceBeams(model, "kick", 1000, 0)).toEqual([]);
  });

  test("a beam reaches where its level falls to the target, 6 dB each time the distance doubles", () => {
    const [far] = spaceBeams(model, "high", 1000, 0);
    /** its level on its axis at 1 m, on the grid's scale */
    const at1m = 20 * Math.log10(far.reachFt * METERS_PER_FOOT);
    const reach = (targetDb: number) =>
      spaceBeams(model, "high", 1000, targetDb).find((b) => spot(b.at) === spot(far.at))?.reachFt;
    expect(reach(at1m - 6)).toBeCloseTo(2 / METERS_PER_FOOT, 1);
    expect(reach(at1m - 20)).toBeCloseTo(10 / METERS_PER_FOOT, 6);
    // a target it never reaches: no beam
    expect(reach(at1m + 0.1)).toBeUndefined();
  });

  test("the floor shows the map only while its grid is for the room on show", () => {
    const grid = { cols: 2, rows: 2, db: new Float32Array(4) };
    const textured = (root: THREE.Object3D) => {
      let n = 0;
      root.traverse((o) => {
        if (
          o instanceof THREE.Mesh &&
          o.material instanceof THREE.MeshBasicMaterial &&
          o.material.map
        )
          n++;
      });
      return n;
    };
    const view = { grid, room: venue.room, target: 0 };
    expect(textured(buildSpaceScene(props({ view })))).toBe(1);
    const resized = { ...venue.room, widthFt: venue.room.widthFt + 4 };
    expect(textured(buildSpaceScene(props({ view, room: resized })))).toBe(0);
  });

  test("the scene frames the room, with its walls and ceiling unless cut away", () => {
    const walls = (root: THREE.Object3D) => {
      let n = 0;
      root.traverse((o) => {
        if (o.name === ROOM_SURFACE_NAME) n++;
      });
      return n;
    };
    const root = buildSpaceScene(props());
    const frame: unknown = root.userData[FRAME_BOX_KEY];
    expect(frame).toBeInstanceOf(THREE.Box3);
    if (!(frame instanceof THREE.Box3)) return;
    expect(frame.max.z).toBeCloseTo(venue.room.lengthFt * INCHES_PER_FOOT, 6);
    expect(walls(root)).toBe(5);
    expect(walls(buildSpaceScene(props({ cutaway: true })))).toBe(0);
    expect(walls(buildSpaceScene(props({ room: { ...venue.room, outdoors: true } })))).toBe(0);
  });

  test("the key changes when a box moves, and not when nothing does", () => {
    expect(spaceSceneKey(props())).toBe(spaceSceneKey(props()));
    const moved = model.placements.map((p) => ({
      ...p.item,
      placement: { ...p.item.placement, liftIn: p.item.placement.liftIn + 12 },
    }));
    expect(spaceSceneKey(props({ items: moved }))).not.toBe(spaceSceneKey(props()));
  });
});
