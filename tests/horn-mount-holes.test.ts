// The horn mounts' bolts stand only where the horn's flange is drilled: every bolt drawn through the aluminum plate or
// the plywood mount sits on one of the mesh's holes, on every meshed horn with every driver that fits it, and on a
// made-up flange with two level holes (as the DIY hi-fi waveguide's). Where no turn of the driver's pattern lands on
// the holes, the plate gives way to the clamped L-bracket and the plywood mount can't be picked.
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { plateFit, PLATE_MESH_NAMES } from "../src/components/stack-view/buildPlate";
import { plyMountFit } from "../src/components/stack-view/buildPlyMount";
import { BRACKET_MESH_NAME } from "../src/components/stack-view/buildBracket";
import { BOLT_TURNS, type XY } from "../src/components/stack-view/throatFit";
import { MM_IN } from "../src/components/stack-view/geometry";
import { HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { HORN_MESHES } from "../src/data/meshes";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import { base, meshed, meshesNamed, scene } from "./mount-helpers";
import type { Horn, PartMesh } from "../src/types";

/** How far a bolt may sit from a hole's center and still be on it, in. */
const ON_HOLE_IN = 0.5 * MM_IN;
/** Back-face points this close to each other belong to one hole's edge, in. */
const HOLE_LINK_IN = 4 * MM_IN;

/** A mesh's drilled holes, read off its back face (z = 0) between the throat and the rim: each hole's center, in. */
function meshHoles(mesh: PartMesh): XY[] {
  const k = mesh.unitMm * MM_IN;
  const face: (XY & { r: number })[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3)
    if (mesh.positions[i + 2] === 0) {
      const [x, y] = [mesh.positions[i] * k, mesh.positions[i + 1] * k];
      face.push({ x, y, r: Math.hypot(x, y) });
    }
  const rim = Math.max(...face.map((p) => p.r));
  const throat = Math.min(...face.map((p) => p.r));
  let groups: XY[][] = [];
  for (const p of face.filter((q) => q.r > throat + 1 * MM_IN && q.r < rim - 1 * MM_IN)) {
    const near = groups.filter((h) =>
      h.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < HOLE_LINK_IN),
    );
    groups = [...groups.filter((h) => !near.includes(h)), [p, ...near.flat()]];
  }
  return groups.map((h) => {
    const xs = h.map((p) => p.x);
    const ys = h.map((p) => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  });
}

const onAHole = (b: XY, holes: readonly XY[]) =>
  holes.some((h) => Math.hypot(h.x - b.x, h.y - b.y) < ON_HOLE_IN);

/**
 * A made-up horn mesh, mm: a ⌀110 × 12 mm flange with a 1″ throat and two ⌀6.6 mm holes level across it on a 76 mm
 * circle (0° and 180°), and a conical flare in front of it.
 */
function levelTwoHoleMesh(): PartMesh {
  const flange = new THREE.Shape().absarc(0, 0, 55, 0, Math.PI * 2, false);
  flange.holes.push(new THREE.Path().absarc(0, 0, 12.7, 0, Math.PI * 2, true));
  for (const x of [-38, 38])
    flange.holes.push(new THREE.Path().absarc(x, 0, 3.3, 0, Math.PI * 2, true));
  const plate = new THREE.ExtrudeGeometry(flange, {
    depth: 12,
    bevelEnabled: false,
    curveSegments: 24,
  });
  const flare = new THREE.CylinderGeometry(60, 16, 80, 48, 1, true);
  flare.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0, 52));
  const unit = 0.5;
  const positions: number[] = [];
  for (const g of [plate.toNonIndexed(), flare.toNonIndexed()]) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++)
      positions.push(
        Math.round(pos.getX(i) / unit),
        Math.round(pos.getY(i) / unit),
        Math.max(0, Math.round(pos.getZ(i) / unit)),
      );
  }
  const axis = (k: number) => positions.filter((_, i) => i % 3 === k).map((v) => v * unit);
  const [xs, ys, zs] = [0, 1, 2].map(axis);
  return {
    unitMm: unit,
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    positions,
    indices: Array.from({ length: positions.length / 3 }, (_, i) => i),
  };
}

const LEVEL_MESH = levelTwoHoleMesh();
const rx28 = HORN_OPTIONS.find((h) => h.id === "rx28");
if (!rx28) throw new Error("no RX28");
/** A 1″ horn drawn from the made-up mesh (registered in `HORN_MESHES` for these tests only). */
const LEVEL_HORN: Horn = {
  ...rx28,
  id: "test_level_two_hole",
  size: {
    w: (LEVEL_MESH.max[0] - LEVEL_MESH.min[0]) * MM_IN,
    h: (LEVEL_MESH.max[1] - LEVEL_MESH.min[1]) * MM_IN,
    d: LEVEL_MESH.max[2] * MM_IN,
  },
};
beforeAll(() => {
  HORN_MESHES[LEVEL_HORN.id] = LEVEL_MESH;
});
afterAll(() => {
  delete HORN_MESHES[LEVEL_HORN.id];
});

describe("bolts through the mounts sit on the flange's holes", () => {
  test("the made-up flange's holes read as two, level across the throat on a 76 mm circle", () => {
    const holes = meshHoles(LEVEL_MESH);
    expect(holes).toHaveLength(2);
    for (const h of holes) {
      expect(Math.abs(h.y)).toBeLessThan(ON_HOLE_IN);
      expect(Math.abs(h.x)).toBeCloseTo(38 * MM_IN, 2);
    }
  });

  test("on every meshed horn and the made-up one, with every driver that fits it", () => {
    let checked = 0;
    for (const { horn, mesh } of [...meshed, { horn: LEVEL_HORN, mesh: LEVEL_MESH }]) {
      const holes = meshHoles(mesh);
      expect(holes.length, horn.id).toBeGreaterThan(0);
      for (const cd of CD_OPTIONS.filter((c) => c.exit === horn.exit))
        for (const fit of [
          plateFit(horn, cd, base.mid.box.w),
          plyMountFit(horn, cd, base.mid.box.w),
        ]) {
          for (const b of fit?.through ?? []) {
            checked++;
            expect(onAHole(b, holes), `${horn.id} + ${cd.id}: bolt at ${b.x}, ${b.y}`).toBe(true);
          }
        }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test("a 2-bolt driver on the level holes: the plate takes the pair across, both through it, its heads on the holes", () => {
    const holes = meshHoles(LEVEL_MESH);
    for (const cd of CD_OPTIONS.filter((c) => c.exit === LEVEL_HORN.exit && c.body.bolts.n === 2)) {
      const fit = plateFit(LEVEL_HORN, cd, base.mid.box.w);
      // only a pair on the holes' 76 mm circle lands on them
      const onCircle = Math.abs(cd.body.bolts.circle / 2 - 38 * MM_IN) < ON_HOLE_IN;
      if (!onCircle) {
        expect(fit, `${cd.id}: off the holes' circle`).toBeNull();
        continue;
      }
      if (!fit) throw new Error(`${cd.id}: no plate`);
      expect(fit.turn, cd.id).toBeCloseTo(BOLT_TURNS.across, 9);
      expect(fit.through, cd.id).toHaveLength(2);
      const g = scene({ horn: LEVEL_HORN, cd });
      const [body] = meshesNamed(g, HORN_MESH_NAME);
      const axis = body.getWorldPosition(new THREE.Vector3());
      const heads = meshesNamed(g, PLATE_MESH_NAMES.bolt).map((m) =>
        m.getWorldPosition(new THREE.Vector3()),
      );
      expect(heads, cd.id).toHaveLength(4);
      for (const c of heads)
        expect(
          onAHole({ x: c.x - axis.x, y: c.y - axis.y }, holes),
          `${cd.id}: head on a hole`,
        ).toBe(true);
      // the plywood mount's upright stops under the axis: a level pair can't pass through it
      expect(plyMountFit(LEVEL_HORN, cd, base.mid.box.w), cd.id).toBeNull();
    }
  });

  test("a driver whose pattern lands on no turn of the holes (the DF10.171K's four bolts on two holes): the L-bracket, and no plywood mount", () => {
    const df10 = CD_OPTIONS.find((c) => c.id === "lavoce171");
    if (!df10) throw new Error("no DF10.171K");
    expect(df10.body.bolts.n).toBe(4);
    expect(plateFit(LEVEL_HORN, df10, base.mid.box.w)).toBeNull();
    expect(plyMountFit(LEVEL_HORN, df10, base.mid.box.w)).toBeNull();
    const g = scene({ horn: LEVEL_HORN, cd: df10 });
    expect(meshesNamed(g, PLATE_MESH_NAMES.plate)).toHaveLength(0);
    expect(meshesNamed(g, BRACKET_MESH_NAME).length).toBeGreaterThan(0);
  });
});
