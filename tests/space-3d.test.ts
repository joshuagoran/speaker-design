// The Space page's 3D view (stack-view/buildSpaceScene) and its beams (lib/speaker/spaceBeams): each box stands where
// the space model places it (spaceLayout `placementFrame`), the room's clipping planes keep a beam inside it, a wall
// between the camera and the room is the near one, and a beam's edges are where the driver pattern falls 6 and 3 dB.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  beamLineEnds,
  buildSpaceScene,
  posePlacement,
  roomClipPlanes,
  roomPointIn,
  spaceSceneKey,
  wallIsNear,
  type SpaceSceneProps,
} from "../src/components/stack-view/buildSpaceScene";
import { FRAME_BOX_KEY } from "../src/components/stack-view/sceneFraming";
import { buildMembersScene } from "../src/components/stack-view/buildMembersScene";
import { beamHalfAngles, spaceBeams, type SpaceBeam } from "../src/lib/speaker/spaceBeams";
import { placementFrame } from "../src/lib/speaker/spaceLayout";
import { pistonDirectivity, waveguideHalfAngles } from "../src/lib/acoustics/directivity";
import { spaceFromStart } from "../src/pages/space/useSpace";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { INCHES_PER_FOOT, METERS_PER_FOOT } from "../src/constants/units";
import {
  BEAM_EDGE_DB,
  BEAM_FALL_DB,
  BEAM_INNER_EDGE_DB,
  DRIVER_PART,
  ROOM_SURFACE_NAME,
} from "../src/constants/space";
import { airDbPerM } from "../src/lib/acoustics/roomAcoustics";
import { spaceModel } from "./helpers";
import type { DriverPart } from "../src/types";
import type { RoomPoint } from "../src/lib/speaker/spaceLayout";

const POSES: Parameters<typeof placementFrame>[0][] = [
  { x: 0, y: 0, liftIn: 0, aim: { yawDeg: 0, pitchDeg: 0 }, image: false, upsideDown: false },
  { x: -9, y: 3, liftIn: 72, aim: { yawDeg: 30, pitchDeg: -10 }, image: false, upsideDown: false },
  { x: 6, y: 12, liftIn: 12, aim: { yawDeg: -135, pitchDeg: 8 }, image: true, upsideDown: false },
  // upside down at the ceiling, an image, tilted down
  { x: -4, y: 2, liftIn: 100, aim: { yawDeg: 20, pitchDeg: -15 }, image: true, upsideDown: true },
  { x: 3, y: 8, liftIn: 90, aim: { yawDeg: -60, pitchDeg: 5 }, image: false, upsideDown: true },
];
/** The height a stack turns over about upside down, in. */
const ROLL_AXIS_IN = 22;
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
      posePlacement(holder, pose, ROLL_AXIS_IN);
      holder.updateMatrixWorld();
      const frame = placementFrame(pose, ROLL_AXIS_IN);
      for (const q of STACK_POINTS) {
        // the stack's own scene: its front toward three's +z
        const drawn = new THREE.Vector3(q.x, q.y, -q.z).applyMatrix4(holder.matrixWorld);
        const placed = roomPointIn(frame.toRoom(q));
        expect(drawn.distanceTo(placed)).toBeLessThan(1e-9);
      }
    });
});

test("a box upside down at the ceiling draws where the model places it", () => {
  const start = spaceFromStart(STACK_PRESET.paStack);
  const ceilingIn = start.space.venue.room.ceilingFt * INCHES_PER_FOOT;
  const design = {
    ...start,
    space: {
      ...start.space,
      placements: start.space.placements.map((p) => ({
        ...p,
        upsideDown: true,
        liftIn: ceilingIn - 60,
      })),
    },
  };
  for (const { item } of spaceModel(design).placements) {
    if (!item.stack) continue;
    const holder = new THREE.Group();
    holder.add(buildMembersScene({ ...item.stack, cutaway: false }));
    posePlacement(holder, item.placement, item.rollAxisIn);
    const drawn = new THREE.Box3().setFromObject(holder);
    const placed = new THREE.Box3().setFromPoints(
      item.boxes.flatMap((b) => b.corners.map(roomPointIn)),
    );
    expect(placed.max.y).toBeGreaterThan(ceilingIn - 20);
    // across and down the room the drawing spans the boxes; up, it reaches their top, a part of it standing out of a
    // box (a horn on top, upright) now hangs below
    for (const axis of ["x", "z"] as const) {
      expect(Math.abs(drawn.min[axis] - placed.min[axis])).toBeLessThan(1);
      expect(Math.abs(drawn.max[axis] - placed.max[axis])).toBeLessThan(1);
    }
    expect(Math.abs(drawn.max.y - placed.max.y)).toBeLessThan(1);
    expect(drawn.min.y).toBeLessThan(placed.min.y + 1);
  }
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

test("a beam's angles: where the pattern falls 6 dB, and 3 dB", () => {
  // a piston small against the wavelength never falls 6 or 3 dB in front: a quarter turn each way
  for (const fall of [BEAM_EDGE_DB, BEAM_INNER_EDGE_DB])
    expect(beamHalfAngles({ a: 0.05 }, 100, fall)).toEqual([Math.PI / 2, Math.PI / 2]);
  // a 15 inch cone at 2 kHz: the pattern falls 6 dB, and 3 dB, at the angles
  const a = 0.19;
  const [h, v] = beamHalfAngles({ a }, 2000, BEAM_EDGE_DB);
  expect(h).toBe(v);
  expect(20 * Math.log10(pistonDirectivity(2000, a, h))).toBeCloseTo(-6, 1);
  const [h3] = beamHalfAngles({ a }, 2000, BEAM_INNER_EDGE_DB);
  expect(h3).toBeLessThan(h);
  expect(20 * Math.log10(pistonDirectivity(2000, a, h3))).toBeCloseTo(-3, 1);
  // a horn: its own half angles at 6 dB, never past a quarter turn; at 3 dB, where −6·(θ/half)² dB is −3
  const horn = { covH: 90, covV: 40, wIn: 20, hIn: 10 };
  const own = waveguideHalfAngles(8000, 90, 40, 20, 10);
  expect(beamHalfAngles({ horn }, 8000, BEAM_EDGE_DB)).toEqual(own);
  beamHalfAngles({ horn }, 8000, BEAM_INNER_EDGE_DB).forEach((half, i) =>
    expect(half).toBeCloseTo(own[i] / Math.SQRT2, 9),
  );
  for (const half of beamHalfAngles({ horn }, 40, BEAM_EDGE_DB))
    expect(half).toBeLessThanOrEqual(Math.PI / 2);
});

test("a beam's lines: its aim, and its edges at its half angles, each as long as its reach", () => {
  const [h, v] = [0.5, 0.3];
  const { aim, edges } = beamLineEnds([h, v], 100);
  expect(aim.toArray()).toEqual([0, 0, 100]);
  expect(edges).toHaveLength(4);
  for (const end of edges) expect(end.length()).toBeCloseTo(100, 9);
  // the horizontal edges: to each side in the x–z plane, at the horizontal half angle off the aim
  const [left, right, down, up] = edges;
  for (const [end, side] of [
    [left, -1],
    [right, 1],
  ] as const) {
    expect(end.y).toBe(0);
    expect(Math.sign(end.x)).toBe(side);
    expect(end.angleTo(aim)).toBeCloseTo(h, 9);
  }
  // the vertical edges: up and down in the y–z plane, at the vertical half angle off the aim
  for (const [end, side] of [
    [down, -1],
    [up, 1],
  ] as const) {
    expect(end.x).toBe(0);
    expect(Math.sign(end.y)).toBe(side);
    expect(end.angleTo(aim)).toBeCloseTo(v, 9);
  }
  // no edge in a plane where it never falls that far: the vertical ones only, or none
  const high = beamLineEnds([null, v], 100).edges;
  expect(high).toHaveLength(2);
  for (const end of high) expect(end.x).toBe(0);
  expect(beamLineEnds([null, null], 100).edges).toEqual([]);
});

describe("Space 3D view: the PA stack preset", () => {
  const design = spaceFromStart(STACK_PRESET.paStack);
  const model = spaceModel(design);
  const { venue } = design.space;
  const props = (over: Partial<SpaceSceneProps> = {}): SpaceSceneProps => ({
    room: venue.room,
    items: model.placements.map((p) => p.item),
    listener: venue.listener,
    alignAt: venue.alignAt,
    earFt: venue.earFt,
    view: null,
    beams: spaceBeams(model, "high", 1000),
    cutaway: false,
    theme: "light",
    ...over,
  });

  test("each box beams along its aim, from inside the room", () => {
    const beams = spaceBeams(model, "high", 1000);
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
  /** Each driver's spot, of one part (all of them without one), as keys. */
  const driverSpots = (part?: DriverPart) =>
    new Set(
      model.placements.flatMap(({ item }) =>
        item.drivers.filter((d) => !part || d.part === part).map((d) => spot(d.at)),
      ),
    );
  /** whether a beam has no edge lines: its aim alone */
  const aimOnly = (b: SpaceBeam) => [...b.edges6, ...b.edges3].every((e) => e === null);
  test("each driver that plays the map's band has a beam of its own, from where it sits", () => {
    const hf = driverSpots(DRIVER_PART.hf),
      cone = driverSpots(DRIVER_PART.cone);
    // in the Mid band each top's horn beams with both edges, from its own spot; its cone spreads every way there, so
    // draws its aim alone
    const midBeams = spaceBeams(model, "mid", 1000);
    const mid = midBeams.map((b) => spot(b.at));
    expect(new Set(mid).size).toBe(mid.length);
    const horns = midBeams.filter((b) => hf.has(spot(b.at)));
    expect(horns.length).toBe(2);
    for (const b of horns) expect([...b.edges6, ...b.edges3].every((e) => e !== null)).toBe(true);
    const cones = midBeams.filter((b) => cone.has(spot(b.at)));
    expect(cones.length).toBe(2);
    expect(cones.every(aimOnly)).toBe(true);
    // the subs don't play the Mid band: no beams from them
    const subs = new Set(
      model.placements.flatMap(({ item }) =>
        item.drivers.filter((d) => d.member === 0).map((d) => spot(d.at)),
      ),
    );
    for (const at of mid) expect(subs.has(at)).toBe(false);
    // in the Sub band only the subs play, and they spread every way (never 3 dB down inside a quarter turn): aims alone
    const subBeams = spaceBeams(model, "sub", 1000);
    expect(subBeams.length).toBeGreaterThan(0);
    for (const b of subBeams) expect(subs.has(spot(b.at)) && aimOnly(b)).toBe(true);
  });

  test("at 800 Hz, a top's cone falls 3 dB inside a quarter turn, but not 6 dB: its −3 dB edges alone", () => {
    const topCone = new Set(
      model.placements.flatMap(({ item }) =>
        item.drivers
          .filter((d) => d.part === DRIVER_PART.cone && d.member !== 0)
          .map((d) => spot(d.at)),
      ),
    );
    const cones = spaceBeams(model, "one", 800).filter((b) => topCone.has(spot(b.at)));
    expect(cones.length).toBeGreaterThan(0);
    for (const b of cones) {
      expect(b.edges6).toEqual([null, null]);
      expect(b.edges3.every((e) => e !== null && e < Math.PI / 2)).toBe(true);
    }
  });

  test("in the Mid band each horn's beam reaches past the listener, or to a wall", () => {
    const hf = driverSpots(DRIVER_PART.hf);
    const horns = spaceBeams(model, "mid", 1000).filter((b) => hf.has(spot(b.at)));
    expect(horns.length).toBe(2);
    const { widthFt, lengthFt, ceilingFt } = venue.room;
    const ear = { x: venue.listener.x, y: venue.listener.y, z: venue.earFt };
    for (const b of horns) {
      /** its axis, a unit vector: yaw 0 straight down the room, pitch up */
      const axis = {
        x: Math.sin(b.yaw) * Math.cos(b.pitch),
        y: Math.cos(b.yaw) * Math.cos(b.pitch),
        z: Math.sin(b.pitch),
      };
      const bounds = { x: [-widthFt / 2, widthFt / 2], y: [0, lengthFt], z: [0, ceilingFt] };
      /** how far along its axis it meets a wall, the floor, or the ceiling, ft */
      const toWall = Math.min(
        ...(["x", "y", "z"] as const).flatMap((k) => {
          const [lo, hi] = bounds[k];
          if (axis[k] > 0) return [(hi - b.at[k]) / axis[k]];
          return axis[k] < 0 ? [(lo - b.at[k]) / axis[k]] : [];
        }),
      );
      const toEar = Math.hypot(ear.x - b.at.x, ear.y - b.at.y, ear.z - b.at.z);
      expect(b.reachFt).toBeGreaterThan(Math.min(toEar, toWall));
    }
  });

  test("at one frequency, a cone's beam narrows as the frequency rises", () => {
    const cone = driverSpots(DRIVER_PART.cone);
    const coneBeam = (f: number) =>
      spaceBeams(model, "one", f).find((b) => cone.has(spot(b.at)) && b.edges6[0] !== null);
    const [lower, higher] = [1000, 1500].map(coneBeam);
    expect(lower && higher && spot(lower.at) === spot(higher.at)).toBe(true);
    if (!lower || !higher) return;
    for (const key of ["edges6", "edges3"] as const)
      for (const i of [0, 1]) expect(higher[key][i] ?? 0).toBeLessThan(lower[key][i] ?? 0);
  });

  test("a beam reaches where its driver's direct level falls BEAM_FALL_DB below its level at 1 m", () => {
    for (const f of [1000, 4000, 16000]) {
      const beams = spaceBeams(model, "one", f);
      expect(beams.length).toBeGreaterThan(0);
      for (const b of beams) {
        const r = b.reachFt * METERS_PER_FOOT;
        // spreading as 1/r, and the air's absorption past 1 m, as the map has it
        const fallDb = 20 * Math.log10(r) + airDbPerM(f) * (r - 1);
        expect(fallDb).toBeCloseTo(BEAM_FALL_DB, 6);
      }
    }
    // in a band, the air only brings it nearer than where the spreading alone takes it
    for (const b of spaceBeams(model, "high", 1000)) {
      expect(b.reachFt * METERS_PER_FOOT).toBeLessThan(10 ** (BEAM_FALL_DB / 20));
      expect(b.reachFt * METERS_PER_FOOT).toBeGreaterThan(1);
    }
  });

  test("each beam draws as clipped lines, its aim solid, its −6 dB edges dashed, its −3 dB edges fainter dots", () => {
    const clipped: THREE.Object3D[] = [];
    buildSpaceScene(props()).traverse((o) => {
      if (
        (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) &&
        o.material instanceof THREE.Material &&
        o.material.clippingPlanes?.length
      )
        clipped.push(o);
    });
    const beams = spaceBeams(model, "high", 1000);
    expect(clipped).toHaveLength(3 * beams.length);
    const broken = clipped.flatMap((o) =>
      o instanceof THREE.LineSegments && o.material instanceof THREE.LineDashedMaterial
        ? [o.material]
        : [],
    );
    expect(broken).toHaveLength(2 * beams.length);
    // the dotted ones: shorter dashes, and fainter
    const dotted = broken.filter((m) => m.transparent);
    expect(dotted).toHaveLength(beams.length);
    for (const m of dotted) {
      expect(m.opacity).toBeLessThan(1);
      expect(broken.every((d) => d.transparent || m.dashSize < d.dashSize)).toBe(true);
    }
    expect(clipped.every((o) => o instanceof THREE.LineSegments)).toBe(true);
    // a beam with no edges draws its aim alone
    const aims = (scene: THREE.Object3D) => {
      let n = 0;
      scene.traverse((o) => {
        if (o instanceof THREE.LineSegments && o.material instanceof THREE.Material) n++;
      });
      return n;
    };
    const bare = beams.map((b): SpaceBeam => ({
      ...b,
      edges6: [null, null],
      edges3: [null, null],
    }));
    expect(aims(buildSpaceScene(props({ beams: bare })))).toBe(
      aims(buildSpaceScene(props({ beams: [] }))) + beams.length,
    );
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
