// A Space in the 3D view: the room (its floor in the coverage map's colors, its walls and ceiling), each box as the
// Stack page draws it (buildMembersScene) at its spot, lift, aim, side, and roll as the space model places it
// (lib/speaker/spaceLayout `placementFrame`), the listener, the alignment point, and each driver's beam (lib/speaker/
// spaceBeams), clipped at the walls, floor and ceiling.
//
// Scene coordinates are inches, three's: x across (the room's x), y up (the room's z), z down the room (the room's y),
// the front wall at z = 0 and the room's center line at x = 0.
import * as THREE from "three";
import { buildMembersScene, membersSceneKey } from "./buildMembersScene";
import { FRAME_BOX_KEY } from "./sceneFraming";
import { contourSegments } from "../../lib/acoustics/coverage";
import { COVERAGE_CONTOURS, coverageRgba } from "../../styles/coverageScale";
import { ON_DATA, PALETTES, STAGE } from "../../styles/palette";
import { INCHES_PER_FOOT } from "../../constants/units";
import { ROOM_SURFACE_NAME } from "../../constants/space";
import type { PlacedItem, RoomPoint, placementFrame } from "../../lib/speaker/spaceLayout";
import type { SpaceBeam } from "../../lib/speaker/spaceBeams";
import type {
  CoverageGrid,
  CoverageGridView,
  CoverageRoom,
  FloorPoint,
  SpaceVenue,
  ThemeName,
} from "../../types";

/** What the scene draws. */
export interface SpaceSceneProps {
  room: Pick<CoverageRoom, "widthFt" | "lengthFt" | "ceilingFt" | "outdoors">;
  /** each box as the model stands it (a mirrored pair is two), with what it places (null: missing) */
  items: readonly Pick<PlacedItem, "placement" | "stack" | "rollAxisIn">[];
  listener: FloorPoint;
  alignAt: FloorPoint;
  earFt: SpaceVenue["earFt"];
  /**
   * the grid the map shows (null: none yet, or a quiet room; the floor is then a plain gray, as it is while a grid for
   * another room size is on show)
   */
  view: Pick<CoverageGridView, "grid" | "room" | "target"> | null;
  /** the beams to draw (empty while they are hidden) */
  beams: readonly SpaceBeam[];
  /** the walls and ceiling left out */
  cutaway: boolean;
  theme: ThemeName;
}

/** A see-through wall's opacity: one between the camera and the room. */
const WALL_SEE_THROUGH = 0.15;
/** A beam's opacity, and its outline's. */
const BEAM_OPACITY = 0.1;
const BEAM_EDGE_OPACITY = 0.4;
/** Segments along each edge of a beam's far end, so a wide beam's end stays round. */
const BEAM_SEGMENTS = 8;
/** The listener figure, in: its head's radius, its body's radius, and the gap between them. */
const HEAD_IN = 4.5;
const BODY_IN = 6;
const NECK_IN = 1;
/** The alignment point's mark, in: its radius. */
const ALIGN_MARK_IN = 5;
/** How far the contour lines float over the floor, and how far outdoors the ground runs past the map, in. */
const CONTOUR_LIFT_IN = 1;
const GROUND_MARGIN = 2;
/** The least height the view frames outdoors, ft. */
const OUTDOOR_FRAME_FT = 8;

/** A point in the room (ft: across, down the room, up) in the scene (in). */
export const roomPointIn = (p: RoomPoint) =>
  new THREE.Vector3(p.x * INCHES_PER_FOOT, p.z * INCHES_PER_FOOT, p.y * INCHES_PER_FOOT);

/**
 * Sets an object holding a stack (in its own frame: its base's front center at the origin, its front toward +z) where a
 * placement stands it, as `placementFrame` does: flipped left and right as an image, upside down turned over about its
 * front center line at `rollAxisIn` up, tilted by its pitch about its base's front center, lifted, turned by its yaw
 * and set on its spot.
 */
export function posePlacement(
  object: THREE.Object3D,
  p: Parameters<typeof placementFrame>[0],
  rollAxisIn: number,
) {
  object.scale.set(p.image ? -1 : 1, 1, 1);
  // the roll first, then the tilt, then the turn: + pitch raises the front (a turn about x by −pitch), + yaw turns
  // toward +x; upside down is a half turn about the front center line (z)
  const aim = new THREE.Euler(
    (-p.aim.pitchDeg * Math.PI) / 180,
    (p.aim.yawDeg * Math.PI) / 180,
    0,
    "YXZ",
  );
  object.rotation.set(aim.x, aim.y, p.upsideDown ? Math.PI : 0, "YXZ");
  // the half turn about the line at rollAxisIn up, not the base: the stack lifts by twice that, along its tilt and turn
  const rollLift = new THREE.Vector3(0, p.upsideDown ? 2 * rollAxisIn : 0, 0).applyEuler(aim);
  object.position.set(p.x * INCHES_PER_FOOT, p.liftIn, p.y * INCHES_PER_FOOT).add(rollLift);
}

/** The room's surfaces as clipping planes facing in: what lies outside one is cut away. Outdoors: the ground only. */
export function roomClipPlanes(room: SpaceSceneProps["room"]): THREE.Plane[] {
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (room.outdoors) return [ground];
  const halfW = (room.widthFt / 2) * INCHES_PER_FOOT,
    l = room.lengthFt * INCHES_PER_FOOT,
    h = room.ceilingFt * INCHES_PER_FOOT;
  return [
    ground,
    new THREE.Plane(new THREE.Vector3(0, -1, 0), h),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), l),
  ];
}

/** A wall or the ceiling: its middle and the way it faces into the room. */
interface RoomSurface {
  center: THREE.Vector3;
  normal: THREE.Vector3;
}

/** Whether a wall stands between the camera and the room: the camera is on its outer side. */
export const wallIsNear = (wall: RoomSurface, camera: THREE.Vector3) =>
  wall.normal.dot(camera.clone().sub(wall.center)) < 0;

/** The room's four walls and its ceiling, each as a plane mesh facing in, its surface in `userData`. */
function roomSurfaces(room: SpaceSceneProps["room"], color: string): THREE.Mesh[] {
  const w = room.widthFt * INCHES_PER_FOOT,
    l = room.lengthFt * INCHES_PER_FOOT,
    h = room.ceilingFt * INCHES_PER_FOOT;
  const surfaces: { size: [number, number]; at: [number, number, number]; turn: THREE.Euler }[] = [
    // front, back, left, right, ceiling (a plane faces +z until turned)
    { size: [w, h], at: [0, h / 2, 0], turn: new THREE.Euler(0, 0, 0) },
    { size: [w, h], at: [0, h / 2, l], turn: new THREE.Euler(0, Math.PI, 0) },
    { size: [l, h], at: [-w / 2, h / 2, l / 2], turn: new THREE.Euler(0, Math.PI / 2, 0) },
    { size: [l, h], at: [w / 2, h / 2, l / 2], turn: new THREE.Euler(0, -Math.PI / 2, 0) },
    { size: [w, l], at: [0, h, l / 2], turn: new THREE.Euler(Math.PI / 2, 0, 0) },
  ];
  return surfaces.map(({ size, at, turn }) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    mesh.name = ROOM_SURFACE_NAME;
    mesh.position.set(...at);
    mesh.rotation.copy(turn);
    const surface: RoomSurface = {
      center: mesh.position.clone(),
      normal: new THREE.Vector3(0, 0, 1).applyEuler(turn),
    };
    // each frame: see-through while it stands between the camera and the room, else solid
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      const near = wallIsNear(surface, camera.position);
      material.opacity = near ? WALL_SEE_THROUGH : 1;
      material.depthWrite = !near;
    };
    return mesh;
  });
}

/**
 * A beam's surface: a wedge from its apex at the origin along +z, `half` radians to each side and up and down, `length`
 * in long, its far end curved (every point on it that far from the apex).
 */
export function beamGeometry(half: SpaceBeam["half"], length: number): THREE.BufferGeometry {
  const n = BEAM_SEGMENTS;
  const dir = (i: number, j: number) => {
    const az = (2 * i) / n - 1,
      el = (2 * j) / n - 1;
    const a = az * half[0],
      e = el * half[1];
    return [
      Math.sin(a) * Math.cos(e) * length,
      Math.sin(e) * length,
      Math.cos(a) * Math.cos(e) * length,
    ];
  };
  // the far end's grid, then the apex
  const positions: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) positions.push(...dir(i, j));
  const apex = positions.length / 3;
  positions.push(0, 0, 0);
  const at = (i: number, j: number) => j * (n + 1) + i;
  const index: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      index.push(
        at(i, j),
        at(i + 1, j),
        at(i + 1, j + 1),
        at(i, j),
        at(i + 1, j + 1),
        at(i, j + 1),
      );
  // the four sides: fans from the apex to the far end's edges
  for (let k = 0; k < n; k++)
    index.push(
      apex,
      at(k, 0),
      at(k + 1, 0),
      apex,
      at(n, k),
      at(n, k + 1),
      apex,
      at(k + 1, n),
      at(k, n),
      apex,
      at(0, k + 1),
      at(0, k),
    );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

/** A beam's outline: its four edges from the apex and the rim of its far end. */
function beamOutline(half: SpaceBeam["half"], length: number): THREE.BufferGeometry {
  const surface = beamGeometry(half, length);
  const p = surface.getAttribute("position");
  surface.dispose();
  const n = BEAM_SEGMENTS;
  const point = (i: number, j: number) => {
    const k = j * (n + 1) + i;
    return [p.getX(k), p.getY(k), p.getZ(k)];
  };
  const rim: [number, number][] = [];
  for (let k = 0; k < n; k++) rim.push([k, 0], [n, k], [n - k, n], [0, n - k]);
  const lines: number[] = [];
  rim.forEach(([i, j], k) => {
    const [ni, nj] = rim[(k + 1) % rim.length];
    lines.push(...point(i, j), ...point(ni, nj));
  });
  for (const [i, j] of [
    [0, 0],
    [n, 0],
    [n, n],
    [0, n],
  ])
    lines.push(0, 0, 0, ...point(i, j));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  return geometry;
}

/** The floor in the coverage map's colors and contour lines, over the room the grid was worked out for. */
function coverageFloor(view: NonNullable<SpaceSceneProps["view"]>): THREE.Group {
  const { grid, room } = view;
  const w = room.widthFt * INCHES_PER_FOOT,
    l = room.lengthFt * INCHES_PER_FOOT;
  const floor = new THREE.Group();
  const texture = new THREE.DataTexture(coverageRgba(view), grid.cols, grid.rows);
  // the map's sRGB pixels drawn as they are: three r140 converts neither this texture, the lines' colors nor the output
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    // the contour lines sit on top: the floor is pushed back in depth
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  // the grid's first row is the front wall (z = 0): the plane turned face down puts its texture's first row there
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, 0, l / 2);
  floor.add(mesh);
  const at = (x: number, y: number) => [
    (x / grid.cols - 0.5) * w,
    CONTOUR_LIFT_IN,
    (y / grid.rows) * l,
  ];
  for (const [db, line] of COVERAGE_CONTOURS) {
    const points = contourSegments(grid, view.target + db).flatMap(([x1, y1, x2, y2]) => [
      ...at(x1, y1),
      ...at(x2, y2),
    ]);
    if (!points.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    floor.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: line.color,
          transparent: line.opacity < 1,
          opacity: line.opacity,
        }),
      ),
    );
  }
  return floor;
}

/** A plain floor or ground of `w` × `l` in, its front edge at z = `z0`, at height `y`. */
function plainFloor(w: number, l: number, z0: number, y: number, color: string | number) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, y, z0 + l / 2);
  return mesh;
}

/** The listener as a plain figure standing on the floor, its head's center at the ear height. */
function listenerFigure(at: FloorPoint, earFt: number, color: string): THREE.Group {
  const figure = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const earIn = earFt * INCHES_PER_FOOT;
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_IN, 20, 14), material);
  head.position.y = earIn;
  const bodyTop = Math.max(2 * BODY_IN, earIn - HEAD_IN - NECK_IN);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(BODY_IN, bodyTop - 2 * BODY_IN, 6, 16),
    material,
  );
  body.position.y = bodyTop / 2;
  figure.add(head, body);
  figure.position.copy(roomPointIn({ ...at, z: 0 }));
  return figure;
}

/** The alignment point: a small diamond at the ear height, on a thin line up from the floor. */
function alignMark(at: FloorPoint, earFt: number, lineColor: string): THREE.Group {
  const mark = new THREE.Group();
  const earIn = earFt * INCHES_PER_FOOT;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(ALIGN_MARK_IN),
    new THREE.MeshStandardMaterial({ color: ON_DATA.magenta, roughness: 0.6 }),
  );
  diamond.position.y = earIn;
  const stem = new THREE.BufferGeometry();
  stem.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, earIn, 0], 3));
  mark.add(
    diamond,
    new THREE.LineSegments(stem, new THREE.LineBasicMaterial({ color: lineColor })),
  );
  mark.position.copy(roomPointIn({ ...at, z: 0 }));
  return mark;
}

/** The ids the scene key gives the grids it has seen, so a new grid rebuilds the scene and the same one doesn't. */
const gridIds = new WeakMap<CoverageGrid, number>();
let nextGridId = 0;
const gridId = (grid: CoverageGrid) => {
  const id = gridIds.get(grid) ?? nextGridId++;
  gridIds.set(grid, id);
  return id;
};

/** What the scene reads, as a key that changes exactly when the scene does. */
export function spaceSceneKey(props: SpaceSceneProps): string {
  const { room, items, view } = props;
  return JSON.stringify({
    room: [room.widthFt, room.lengthFt, room.ceilingFt, room.outdoors],
    items: items.map(({ placement: p, stack }) => ({
      pose: [p.x, p.y, p.liftIn, p.aim, p.image, p.upsideDown],
      stack: stack ? membersSceneKey({ ...stack, cutaway: false }) : null,
    })),
    marks: [props.listener, props.alignAt, props.earFt],
    view: view ? [gridId(view.grid), view.room, view.target] : null,
    beams: props.beams,
    cutaway: props.cutaway,
    theme: props.theme,
  });
}

/** The Space in the scene's inches, framed on the room (a beam may reach past it, cut off at its walls). */
export function buildSpaceScene(props: SpaceSceneProps): THREE.Group {
  const { room, view, theme } = props;
  const pal = PALETTES[theme];
  const root = new THREE.Group();
  const w = room.widthFt * INCHES_PER_FOOT,
    l = room.lengthFt * INCHES_PER_FOOT,
    h = room.ceilingFt * INCHES_PER_FOOT;
  // the floor: the map's colors, or a plain gray (while the grid is worked out again for a new room size, too); outdoors,
  // the ground round it
  const fits = view && view.room.widthFt === room.widthFt && view.room.lengthFt === room.lengthFt;
  root.add(fits ? coverageFloor(view) : plainFloor(w, l, 0, 0, ON_DATA.edge));
  if (room.outdoors)
    root.add(
      plainFloor(
        w * (1 + 2 * GROUND_MARGIN),
        l * (1 + 2 * GROUND_MARGIN),
        -l * GROUND_MARGIN,
        -2,
        STAGE[theme].floor,
      ),
    );
  else {
    if (!props.cutaway) root.add(...roomSurfaces(room, pal.edge));
    // the room's edges, so a see-through wall still shows where it is
    const box = new THREE.BoxGeometry(w, h, l);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: pal.faint }),
    );
    box.dispose();
    edges.position.set(0, h / 2, l / 2);
    root.add(edges);
  }
  const boxes = new THREE.Group();
  for (const { placement, stack, rollAxisIn } of props.items) {
    if (!stack) continue;
    const holder = new THREE.Group();
    holder.add(buildMembersScene({ stack: stack.stack, speakers: stack.speakers, cutaway: false }));
    posePlacement(holder, placement, rollAxisIn);
    boxes.add(holder);
  }
  root.add(boxes);
  root.add(listenerFigure(props.listener, props.earFt, pal.muted));
  root.add(alignMark(props.alignAt, props.earFt, pal.muted));
  // each beam runs as far as it stays as loud as the target, cut off where it meets a surface
  const planes = roomClipPlanes(room);
  for (const beam of props.beams) {
    const length = beam.reachFt * INCHES_PER_FOOT;
    const holder = new THREE.Group();
    holder.add(
      new THREE.Mesh(
        beamGeometry(beam.half, length),
        new THREE.MeshBasicMaterial({
          color: ON_DATA.cyan,
          transparent: true,
          opacity: BEAM_OPACITY,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: planes,
        }),
      ),
      new THREE.LineSegments(
        beamOutline(beam.half, length),
        new THREE.LineBasicMaterial({
          color: ON_DATA.cyan,
          transparent: true,
          opacity: BEAM_EDGE_OPACITY,
          depthWrite: false,
          clippingPlanes: planes,
        }),
      ),
    );
    holder.position.copy(roomPointIn(beam.at));
    holder.rotation.set(-beam.pitch, beam.yaw, 0, "YXZ");
    root.add(holder);
  }
  // the view frames the room and what stands in it, not the beams
  const frame = new THREE.Box3(
    new THREE.Vector3(-w / 2, 0, 0),
    new THREE.Vector3(w / 2, room.outdoors ? OUTDOOR_FRAME_FT * INCHES_PER_FOOT : h, l),
  );
  if (boxes.children.length) frame.union(new THREE.Box3().setFromObject(boxes));
  root.userData[FRAME_BOX_KEY] = frame;
  return root;
}
