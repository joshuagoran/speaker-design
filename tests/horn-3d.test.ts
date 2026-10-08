import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import {
  ADAPTER_MESH_NAME,
  CD_MESH_NAME,
  HORN_MESH_DRAWING,
  HORN_MESH_NAME,
} from "../src/components/stack-view/buildHorn";
import {
  BRACKET,
  BRACKET_BOLT_MESH_NAME,
  BRACKET_MESH_NAME,
  takesBracket,
} from "../src/components/stack-view/buildBracket";
import { HARDWARE_MESH_NAME } from "../src/components/stack-view/buildHardware";
import { PARTS_3D } from "../src/styles/palette";
import {
  CD_OPTIONS,
  HORN_OPTIONS,
  cdBodySteps,
  hornDepth,
  stepsDia,
  stepsLength,
} from "../src/lib/data";
import { SCENE_CASE_NAMES, defaultConfig, sceneCases, scenePropsOf } from "./scene-cases";
import { HORN_COLOR_CATALOG } from "../src/constants/hornColor";
import { pickedHornColor, savedHornColor } from "../src/lib/pa/hornColor";
import { HORN_MESHES } from "../src/data/meshes";
import {
  A460G2_14,
  DIY_OS90X50,
  DIY_OS90X70,
  DIY_ROSSE110X50,
  ST260,
} from "../src/data/catalog/horns";
import { MM_IN, partMeshGeometry, partMeshSilhouette } from "../src/components/stack-view/geometry";
import type { CompressionDriver, Horn, PaLayout, PartMesh } from "../src/types";

/** How close two faces count as touching, in (meshes are faceted, so a contact is never exact). */
const CONTACT_IN = 0.01;
/** How far apart two parts must stay to count as clear, in. */
const CLEAR_IN = 0.01;
const LAYOUTS: readonly PaLayout[] = ["stack", "pole", "satellite", "tower"];

const base = (() => {
  const c = sceneCases.find((x) => x.name === SCENE_CASE_NAMES.defaultPa);
  if (!c) throw new Error("no default scene case");
  return c.props;
})();

const meshesNamed = (group: THREE.Group, name: string) => {
  group.updateMatrixWorld(true);
  const out: THREE.Mesh[] = [];
  group.traverse((o) => o instanceof THREE.Mesh && o.name === name && out.push(o));
  return out;
};

/** The box round every mesh of a name, or null when the scene has none. */
function boxOf(group: THREE.Group, name: string) {
  const meshes = meshesNamed(group, name);
  if (!meshes.length) return null;
  const box = new THREE.Box3();
  meshes.forEach((m) => box.expandByObject(m));
  return box;
}

/** The box round the bracket's uprights (its plates taller than they are thick), or null when there are none. */
function uprightBox(group: THREE.Group) {
  const uprights = meshesNamed(group, BRACKET_MESH_NAME).filter((m) => {
    const b = new THREE.Box3().setFromObject(m);
    return b.max.y - b.min.y > BRACKET.thickness + 1e-6;
  });
  if (!uprights.length) return null;
  const box = new THREE.Box3();
  uprights.forEach((m) => box.expandByObject(m));
  return box;
}

/** Whether two boxes overlap by more than the clearance (the simplified intersection check). */
const overlaps = (a: THREE.Box3, b: THREE.Box3) =>
  a
    .clone()
    .expandByScalar(-CLEAR_IN / 2)
    .intersectsBox(b);

describe("catalog sizes", () => {
  test("each driver body has its published size, and its steps add up to it", () => {
    for (const cd of CD_OPTIONS) {
      const { dia, depth, bolts } = cd.body;
      expect(dia, cd.id).toBeGreaterThan(cd.exit);
      expect(depth, cd.id).toBeGreaterThan(0);
      expect(bolts.n, cd.id).toBeGreaterThanOrEqual(2);
      expect(bolts.circle, cd.id).toBeLessThan(dia);
      const steps = cdBodySteps(cd.body);
      expect(stepsLength(steps), cd.id).toBeCloseTo(depth, 9);
      expect(stepsDia(steps), cd.id).toBeCloseTo(dia, 9);
    }
    const n314t = CD_OPTIONS.find((c) => c.id === "n314t");
    expect(n314t?.body).toMatchObject({ dia: 5.72, depth: 2.53, bolts: { n: 4, circle: 4 } });
  });

  test("the DIY horns' estimated price is the 460 mm ATH print's", () => {
    for (const horn of [DIY_OS90X50, DIY_ROSSE110X50]) {
      expect(horn.price, horn.id).toBe(A460G2_14.price);
      expect(horn.src, horn.id).toMatch(/^Estimate/);
    }
  });

  test("the DIY 1 in waveguide's estimated price is the ATH ST260 print's, a waveguide of its size", () => {
    expect(DIY_OS90X70.price).toBe(ST260.price);
    expect(DIY_OS90X70.src).toMatch(/^Estimate/);
    expect(DIY_OS90X70.size.w).toBeCloseTo(ST260.size.w, 0);
    expect(DIY_OS90X70.size.d).toBeCloseTo(ST260.size.d, 0);
  });

  test("the A460G2 with its adapter is about 7.9 in deep", () => {
    const a460 = HORN_OPTIONS.find((h) => h.id === "a460g2_14");
    expect(a460?.adapter).toBeDefined();
    if (!a460?.adapter) return;
    expect(stepsLength(a460.adapter.steps) * 25.4).toBeCloseTo(41, 6);
    expect(a460.size.d * 25.4).toBeCloseTo(160, 6);
    expect(hornDepth(a460)).toBeCloseTo(7.9, 1);
  });
});

describe("horn, throat adapter and compression driver", () => {
  for (const layout of LAYOUTS)
    test(`${layout}: each horn's mesh has its catalog size, and the driver sits on the adapter on the throat`, () => {
      for (const horn of HORN_OPTIONS) {
        const at = `${horn.id} ${layout}`;
        const g = buildStackScene({ ...base, horn, layout });
        const hornBox = boxOf(g, HORN_MESH_NAME);
        const cdBox = boxOf(g, CD_MESH_NAME);
        expect(hornBox, at).not.toBeNull();
        expect(cdBox, at).not.toBeNull();
        if (!hornBox || !cdBox) continue;
        const throatZ = hornBox.min.z;
        const size = hornBox.getSize(new THREE.Vector3());
        expect(size.z, at).toBeCloseTo(horn.size.d, 2);
        expect(size.y, at).toBeCloseTo(horn.size.h, 1);
        // the satellites stand two horns apart, and the full-width concept takes the box's width
        if (layout !== "satellite" && !horn.rect) expect(size.x, at).toBeCloseTo(horn.size.w, 1);
        const adapter = boxOf(g, ADAPTER_MESH_NAME);
        if (horn.adapter) {
          expect(adapter, at).not.toBeNull();
          if (!adapter) continue;
          expect(Math.abs(adapter.max.z - throatZ), `${at}: adapter on the throat`).toBeLessThan(
            CONTACT_IN,
          );
          expect(adapter.max.z - adapter.min.z, at).toBeCloseTo(stepsLength(horn.adapter.steps), 6);
          if (layout !== "satellite")
            expect(adapter.max.x - adapter.min.x, at).toBeCloseTo(stepsDia(horn.adapter.steps), 2);
          expect(
            Math.abs(cdBox.max.z - adapter.min.z),
            `${at}: driver on the adapter`,
          ).toBeLessThan(CONTACT_IN);
        } else {
          expect(adapter, at).toBeNull();
          const upright = uprightBox(g);
          if (layout === "tower") {
            // no lid under the driver, so no bracket: the driver on the throat
            expect(upright, at).toBeNull();
            expect(Math.abs(cdBox.max.z - throatZ), `${at}: driver on the throat`).toBeLessThan(
              CONTACT_IN,
            );
          } else {
            // the bracket's upright clamped between the throat flange and the driver, 1/8 in thick
            expect(upright, at).not.toBeNull();
            if (!upright) continue;
            expect(
              Math.abs(upright.max.z - throatZ),
              `${at}: upright on the throat flange`,
            ).toBeLessThan(CONTACT_IN);
            expect(upright.max.z - upright.min.z, at).toBeCloseTo(BRACKET.thickness, 6);
            expect(
              Math.abs(cdBox.max.z - upright.min.z),
              `${at}: driver on the upright`,
            ).toBeLessThan(CONTACT_IN);
          }
        }
        // the driver's body: its catalog depth and diameter
        expect(cdBox.max.z - cdBox.min.z, at).toBeCloseTo(base.cd.body.depth, 6);
        if (layout !== "satellite")
          expect(cdBox.max.x - cdBox.min.x, at).toBeCloseTo(base.cd.body.dia, 2);
      }
    });

  test("each driver's mesh has its catalog size", () => {
    for (const cd of CD_OPTIONS) {
      const cdBox = boxOf(buildStackScene({ ...base, cd }), CD_MESH_NAME);
      expect(cdBox, cd.id).not.toBeNull();
      if (!cdBox) continue;
      const size = cdBox.getSize(new THREE.Vector3());
      expect(size.z, cd.id).toBeCloseTo(cd.body.depth, 6);
      expect(size.x, cd.id).toBeCloseTo(cd.body.dia, 2);
      expect(size.y, cd.id).toBeCloseTo(cd.body.dia, 2);
    }
  });
});

describe("horns drawn from their CAD mesh", () => {
  const meshed = Object.entries(HORN_MESHES).flatMap(([id, mesh]) => {
    const horn = HORN_OPTIONS.find((h) => h.id === id);
    if (!horn) throw new Error(`a mesh for a horn not in the catalog: ${id}`);
    return mesh ? [{ horn, mesh }] : [];
  });

  test("the DIY horns have one", () => {
    const ids = meshed.map((m) => m.horn.id);
    expect(ids).toContain(DIY_OS90X50.id);
    expect(ids).toContain(DIY_ROSSE110X50.id);
    expect(ids).toContain(DIY_OS90X70.id);
  });

  test("a mesh's geometries are built once per drawing and kept apart", () => {
    for (const { horn, mesh } of meshed) {
      const smooth = partMeshGeometry(mesh, HORN_MESH_DRAWING);
      const flat = partMeshGeometry(mesh, { ...HORN_MESH_DRAWING, shading: "flat" });
      expect(flat, horn.id).not.toBe(smooth);
      expect(flat.index, horn.id).toBeNull();
      expect(smooth.index?.count, horn.id).toBe(mesh.indices.length);
      expect(partMeshGeometry(mesh, HORN_MESH_DRAWING), horn.id).toBe(smooth);
    }
  });

  test("a horn mesh is placed by its origin (the driver's axis), not by the center of its bounds", () => {
    // an asymmetric horn: the real mesh with its mouth reaching 20 mm further up than down
    const [{ mesh }] = meshed;
    const up = 40; // grid steps
    const lopsided: PartMesh = {
      ...mesh,
      max: [mesh.max[0], mesh.max[1] + up * mesh.unitMm, mesh.max[2]],
      positions: mesh.positions.map((v, i) => (i % 3 === 1 && v > 0 ? v + up : v)),
    };
    for (const m of [mesh, lopsided]) {
      const g = partMeshGeometry(m, HORN_MESH_DRAWING);
      g.computeBoundingBox();
      const box = g.boundingBox;
      if (!box) throw new Error("no bounding box");
      expect(box.min.y).toBeCloseTo(m.min[1] * MM_IN, 4);
      expect(box.max.y).toBeCloseTo(m.max[1] * MM_IN, 4);
      expect(box.min.z).toBeCloseTo(0, 4);
    }
  });

  test("each mesh's size is the horn's catalog size, from the flange's back face at z = 0", () => {
    for (const { horn, mesh } of meshed) {
      const size = [0, 1, 2].map((k) => (mesh.max[k] - mesh.min[k]) * MM_IN);
      expect(size[0], horn.id).toBeCloseTo(horn.size.w, 3);
      expect(size[1], horn.id).toBeCloseTo(horn.size.h, 3);
      expect(size[2], horn.id).toBeCloseTo(horn.size.d, 3);
      expect(mesh.min[2], horn.id).toBe(0);
      // the mesh takes the place of a profile and of a throat adapter
      expect(horn.profile, horn.id).toBeUndefined();
      expect(horn.adapter, horn.id).toBeUndefined();
    }
  });

  /**
   * Where a driver's bolts sit round its axis, in: a 2-bolt driver's level (0° and 180°, as the 1″ drivers here mount),
   * any other's evenly spaced from half a step above level (a 4-bolt driver's at 45°, 135°, 225° and 315°).
   */
  const boltPoints = ({ n, circle }: CompressionDriver["body"]["bolts"]) => {
    const start = n === 2 ? 0 : 180 / n;
    return Array.from({ length: n }, (_, k) => {
      const a = ((start + (360 * k) / n) * Math.PI) / 180;
      return { x: (circle / 2) * Math.cos(a), y: (circle / 2) * Math.sin(a) };
    });
  };
  /** Points of one hole's edge are closer than this to a neighbor on it; separate holes are further apart, in. */
  const HOLE_LINK_IN = 0.4;
  /** How far a driver's bolt circle may be off the holes' and still bolt on, in (half of it each side, in 6.6 mm holes). */
  const CIRCLE_FIT_IN = 1 / 25.4;

  /**
   * The throat flange's back face in a scene (the mesh's vertices at its back, round the horn's axis): its rim, the
   * throat, and the bolt holes' centers between them.
   */
  function flangeOf(g: THREE.Group, at: string) {
    const [body] = meshesNamed(g, HORN_MESH_NAME);
    const hornBox = boxOf(g, HORN_MESH_NAME);
    if (!body || !hornBox) throw new Error(`${at}: no horn`);
    const axis = body.getWorldPosition(new THREE.Vector3()); // the mesh is placed by its origin, the driver's axis
    const pos = body.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    const face: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(body.matrixWorld);
      if (v.z - hornBox.min.z < 1e-4)
        face.push({ x: v.x - axis.x, y: v.y - axis.y, r: Math.hypot(v.x - axis.x, v.y - axis.y) });
    }
    const rim = Math.max(...face.map((p) => p.r));
    const throat = Math.min(...face.map((p) => p.r));
    // each hole's edge: the points between the throat and the rim, grouped with any point near one of them
    let groups: (typeof face)[] = [];
    for (const p of face.filter((q) => q.r > throat + 0.1 && q.r < rim - 0.1)) {
      const near = groups.filter((h) =>
        h.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < HOLE_LINK_IN),
      );
      groups = [...groups.filter((h) => !near.includes(h)), [p, ...near.flat()]];
    }
    const holes = groups.map((h) => {
      expect(h.length, `${at}: a hole's edge`).toBeGreaterThan(2);
      return {
        x: h.reduce((s, p) => s + p.x, 0) / h.length,
        y: h.reduce((s, p) => s + p.y, 0) / h.length,
      };
    });
    return { hornBox, rim, throat, holes };
  }

  test("the DIY horns' holes take both a 4-bolt and a 2-bolt driver", () => {
    const counts = meshed.map(
      ({ horn }) => flangeOf(buildStackScene({ ...base, horn }), horn.id).holes.length,
    );
    expect(counts).toContain(4);
    expect(counts).toContain(2);
    expect(
      flangeOf(buildStackScene({ ...base, horn: DIY_OS90X70 }), DIY_OS90X70.id).holes,
    ).toHaveLength(2);
  });

  for (const layout of LAYOUTS)
    test(`${layout}: each driver that fits bolts to the flange: its bolts line up with the flange's holes, its exit with the throat`, () => {
      for (const { horn } of meshed) {
        const at = `${horn.id} ${layout}`;
        const { holes } = flangeOf(buildStackScene({ ...base, horn, layout }), at);
        const holeCircle = (2 * holes.reduce((s, h) => s + Math.hypot(h.x, h.y), 0)) / holes.length;
        // the drivers for the throat with as many bolts as the flange has holes, on the holes' circle
        const fits = CD_OPTIONS.filter(
          (c) =>
            c.exit === horn.exit &&
            c.body.bolts.n === holes.length &&
            Math.abs(c.body.bolts.circle - holeCircle) < CIRCLE_FIT_IN,
        );
        expect(fits.length, `${at}: a driver that bolts on`).toBeGreaterThan(0);
        for (const cd of fits) {
          const with_ = `${at} ${cd.id}`;
          const g = buildStackScene({ ...base, horn, cd, layout });
          const { hornBox, rim, throat } = flangeOf(g, with_);
          const cdBox = boxOf(g, CD_MESH_NAME);
          if (!cdBox) throw new Error(`${with_}: no driver`);
          // the driver's front face on the flange, or on the bracket's upright clamped against it
          const upright = uprightBox(g);
          const onto = layout === "tower" ? hornBox.min.z : upright?.min.z;
          expect(onto, `${with_}: upright`).toBeDefined();
          expect(
            Math.abs(cdBox.max.z - (onto ?? Infinity)),
            `${with_}: driver on the flange`,
          ).toBeLessThan(CONTACT_IN);
          expect(throat, `${with_}: throat the driver's exit`).toBeCloseTo(cd.exit / 2, 1);
          expect(rim, `${with_}: flange round the bolts`).toBeGreaterThan(
            cd.body.bolts.circle / 2 + 0.25,
          );
          // a hole on each of the driver's bolts
          for (const b of boltPoints(cd.body.bolts))
            expect(
              Math.min(...holes.map((h) => Math.hypot(h.x - b.x, h.y - b.y))),
              `${with_}: a hole on the bolt at (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`,
            ).toBeLessThan(0.02);
        }
      }
    });

  /** How far inside and outside the silhouette the hole's edge is checked, in. */
  const MARGIN_IN = 0.1;
  /** The grid the see-through check casts rays on, in. */
  const STEP_IN = 0.4;
  /** The tower's walls, how far its baffle sits behind the frame's front (where the mouth is), and its plywood, in. */
  const WALL_IN = 0.75;
  const INSET_IN = 0.75;
  const BAFFLE_IN = 0.75;
  /** How far behind a baffle face the horn's cross-section is taken, in. */
  const BEHIND_IN = 0.05;

  /**
   * The tower's baffle hole for each meshed horn in a sub box `boxW` wide: nothing behind the horn shows round it, the
   * hole follows the horn's silhouette (inside it the horn, outside it the baffle) up to half an inch inside the side
   * walls, and the horn's cross-section at both baffle faces is inside the hole.
   */
  function checkTowerHole(boxWidth: (horn: Horn) => number) {
    for (const { horn, mesh } of meshed) {
      const boxW = boxWidth(horn);
      const at = `${horn.id} in a ${boxW} in box`;
      const g = buildStackScene({
        ...base,
        sub: { ...base.sub, box: { ...base.sub.box, w: boxW } },
        horn,
        layout: "tower",
        wall: WALL_IN,
        inset: INSET_IN,
      });
      const [body] = meshesNamed(g, HORN_MESH_NAME);
      const hornBox = boxOf(g, HORN_MESH_NAME);
      if (!body || !hornBox) throw new Error(`${at}: no horn`);
      const axis = body.getWorldPosition(new THREE.Vector3());
      const all: THREE.Object3D[] = [];
      g.traverse(
        (o) => o instanceof THREE.Mesh && o.parent?.name !== "scale-figure" && all.push(o),
      );
      // the first thing a ray straight into the front at (x, y) from the axis meets
      const firstHit = (x: number, y: number) => {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(axis.x + x, axis.y + y, hornBox.max.z + 1),
          new THREE.Vector3(0, 0, -1),
        );
        return ray.intersectObjects(all, false)[0];
      };
      // the first thing a ray forward from just behind the baffle's back face at (x, y) meets
      const fromBehind = (x: number, y: number) => {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(
            axis.x + x,
            axis.y + y,
            hornBox.max.z - INSET_IN - BAFFLE_IN - BEHIND_IN,
          ),
          new THREE.Vector3(0, 0, 1),
        );
        return ray.intersectObjects(all, false)[0];
      };
      const halfInside = boxW / 2 - WALL_IN; // inside the tower's side walls
      const halfHole = halfInside - 0.5; // the hole stops half an inch inside them
      // over the mouth's whole rectangle: every ray stops on the baffle, the horn or the driver, never behind them
      for (let x = -horn.size.w / 2 + STEP_IN / 2; x < horn.size.w / 2; x += STEP_IN)
        for (let y = -horn.size.h / 2 + STEP_IN / 2; y < horn.size.h / 2; y += STEP_IN) {
          if (Math.abs(x) > halfInside) continue;
          const hit = firstHit(x, y);
          expect(hit, `${at}: a ray at (${x}, ${y})`).toBeDefined();
          expect(hit?.point.z ?? -Infinity, `${at}: seen through at (${x}, ${y})`).toBeGreaterThan(
            hornBox.min.z - CONTACT_IN,
          );
        }
      // just inside the silhouette the ray meets the horn (its rim, a rolled-back lip or its outer wall), so the baffle
      // covers none of it; just outside it, the baffle, set back by the inset
      for (const p of partMeshSilhouette(mesh)) {
        const r = p.length();
        const inside = p.clone().multiplyScalar(1 - MARGIN_IN / r);
        if (Math.abs(inside.x) < halfHole - MARGIN_IN) {
          expect(
            firstHit(inside.x, inside.y)?.object.name,
            `${at}: inside at ${inside.x}, ${inside.y}`,
          ).toBe(HORN_MESH_NAME);
          // and from behind the baffle the hole is open there too: the ray meets the horn or nothing, not the baffle
          // (a hole smaller than the silhouette fails here even where the horn's rim covers it from the front)
          const back = fromBehind(inside.x, inside.y);
          expect(
            back?.object.name ?? HORN_MESH_NAME,
            `${at}: open behind at ${inside.x}, ${inside.y}`,
          ).toBe(HORN_MESH_NAME);
        }
        const outside = p.clone().multiplyScalar(1 + MARGIN_IN / r);
        if (Math.abs(outside.x) > halfHole) continue;
        const hit = firstHit(outside.x, outside.y);
        expect(hit?.object.name, `${at}: outside at ${outside.x}, ${outside.y}`).not.toBe(
          HORN_MESH_NAME,
        );
        expect(
          hit?.point.z ?? -Infinity,
          `${at}: baffle at ${outside.x}, ${outside.y}`,
        ).toBeCloseTo(hornBox.max.z - INSET_IN, 3);
      }
      // the horn's cross-section just behind each baffle face (where the horn's triangles cross that plane): a ray
      // from the front at each point meets the horn, not the baffle, so the hole holds the horn where it passes through
      const pos = body.geometry.getAttribute("position");
      const index = body.geometry.getIndex();
      if (!index) throw new Error(`${at}: the horn's geometry has no index`);
      const corner = (i: number) =>
        new THREE.Vector3().fromBufferAttribute(pos, index.getX(i)).applyMatrix4(body.matrixWorld);
      for (const z of [hornBox.max.z - INSET_IN, hornBox.max.z - INSET_IN - BAFFLE_IN].map(
        (face) => face - BEHIND_IN,
      )) {
        let crossings = 0;
        for (let t = 0; t < index.count; t += 3)
          for (let e = 0; e < 3; e++) {
            const [a, b] = [corner(t + e), corner(t + ((e + 1) % 3))];
            if ((a.z - z) * (b.z - z) >= 0) continue;
            const c = a.clone().lerp(b, (z - a.z) / (b.z - a.z));
            const [x, y] = [c.x - axis.x, c.y - axis.y];
            if (Math.abs(x) > halfHole - MARGIN_IN) continue;
            crossings++;
            // a hair toward the axis, so the ray meets the wall's face rather than grazing its edge
            const k = 1 - 0.01 / Math.max(Math.hypot(x, y), 0.01);
            expect(
              firstHit(x * k, y * k)?.object.name,
              `${at}: cross-section at ${x}, ${y}, z ${z}`,
            ).toBe(HORN_MESH_NAME);
          }
        expect(crossings, `${at}: a cross-section at z ${z}`).toBeGreaterThan(20);
      }
    }
  }

  test("tower: the baffle hole follows the horn's silhouette and holds its cross-section, so nothing behind it shows", () => {
    checkTowerHole(() => base.sub.box.w);
  });

  test("tower in a box narrower than the horn: the hole stops inside the side walls and the baffle still opens", () => {
    // the narrowest whole-inch box round the mouth (20 in for the PA horns' 19.4 and 19.7 in mouths, 11 in for the
    // 10 in waveguide): the mouth is wider than its baffle
    const narrow = (horn: Horn) => Math.ceil(horn.size.w);
    for (const { horn } of meshed)
      expect(horn.size.w, horn.id).toBeGreaterThan(narrow(horn) - 2 * WALL_IN - 1);
    checkTowerHole(narrow);
  });
});

describe("horn placement", () => {
  test("every horn's mouth plane is on the box's front plane, in every layout", () => {
    for (const layout of LAYOUTS) {
      // the box the horn sits on: the tower's shared shell, else the mid box (both centered on z = 0)
      const front = (layout === "tower" ? base.sub.box : base.mid.box).d / 2;
      for (const horn of HORN_OPTIONS) {
        const hornBox = boxOf(buildStackScene({ ...base, horn, layout }), HORN_MESH_NAME);
        if (!hornBox) throw new Error(`no horn: ${horn.id}, ${layout}`);
        expect(Math.abs(hornBox.max.z - front), `${horn.id}, ${layout}`).toBeLessThan(CONTACT_IN);
      }
    }
  });
});

describe("the driver's L-bracket", () => {
  test("the default horn takes one on its adapter, every horn has one, and the tower has none", () => {
    expect(takesBracket(base.horn.adapter)).toBe(true);
    for (const horn of HORN_OPTIONS) {
      if (horn.adapter) expect(takesBracket(horn.adapter), horn.id).toBe(true);
      const g = buildStackScene({ ...base, horn, layout: "tower" });
      expect(meshesNamed(g, BRACKET_MESH_NAME), horn.id).toHaveLength(0);
    }
  });

  for (const layout of LAYOUTS.filter((l) => l !== "tower"))
    test(`${layout}: it bolts to the adapter's flange or is clamped behind the throat, stands on the lid, and clears the horn, driver, posts and dish`, () => {
      for (const horn of HORN_OPTIONS) {
        const at = `${horn.id} ${layout}`;
        // a driver that fits the throat (the planner flags a mismatched pair, and a 1.4" driver is taller than the
        // ME45's 5.5" mouth)
        const cd =
          horn.exit === base.cd.exit
            ? base.cd
            : (CD_OPTIONS.find((c) => c.exit === horn.exit) ?? base.cd);
        const g = buildStackScene({ ...base, horn, cd, layout });
        const plates = meshesNamed(g, BRACKET_MESH_NAME);
        const hornCount = layout === "satellite" ? 2 : 1;
        expect(plates, at).toHaveLength(2 * hornCount); // an upright and a foot per horn
        const hornBox = boxOf(g, HORN_MESH_NAME);
        if (!hornBox) throw new Error(`${at}: no horn`);
        // the face the upright meets: the back of the adapter's front flange, or the throat flange it is clamped to
        const face = horn.adapter ? hornBox.min.z - horn.adapter.steps[0][1] : hornBox.min.z;
        const neckR = horn.adapter ? horn.adapter.steps[1][0] / 2 : 0;
        const others = [HORN_MESH_NAME, CD_MESH_NAME, HARDWARE_MESH_NAME].flatMap((n) =>
          meshesNamed(g, n),
        );
        const notBracket = (o: THREE.Object3D) =>
          o.name !== BRACKET_MESH_NAME && o.name !== BRACKET_BOLT_MESH_NAME;
        const all: THREE.Object3D[] = [];
        g.traverse(
          (o) =>
            o instanceof THREE.Mesh &&
            notBracket(o) &&
            o.parent?.name !== "scale-figure" &&
            all.push(o),
        );
        for (const plate of plates) {
          const box = new THREE.Box3().setFromObject(plate);
          const isUpright = box.max.y - box.min.y > BRACKET.thickness + 1e-6;
          if (isUpright) {
            // its front face against the back of the adapter's front flange, or the throat flange
            expect(Math.abs(box.max.z - face), `${at}: upright on the flange`).toBeLessThan(
              CONTACT_IN,
            );
            // the notch keeps it off the neck: every point of its outline is outside the neck
            const pos = plate.geometry.getAttribute("position");
            const v = new THREE.Vector3();
            const axis = new THREE.Vector3(
              box.getCenter(v).x,
              hornBox.getCenter(new THREE.Vector3()).y,
              0,
            );
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(plate.matrixWorld);
              expect(
                Math.hypot(v.x - axis.x, v.y - axis.y),
                `${at}: clears the neck`,
              ).toBeGreaterThan(neckR);
            }
          } else {
            // the foot stands on the lid: a ray down from just above its underside meets the box at once
            for (const dx of [-BRACKET.width / 2 + 0.1, 0, BRACKET.width / 2 - 0.1]) {
              const c = box.getCenter(new THREE.Vector3());
              const ray = new THREE.Raycaster(
                new THREE.Vector3(c.x + dx, box.min.y + CONTACT_IN / 2, c.z),
                new THREE.Vector3(0, -1, 0),
              );
              const hit = ray.intersectObjects(all, false)[0];
              expect(hit, `${at}: lid under the foot`).toBeDefined();
              expect(hit?.distance ?? Infinity, `${at}: foot on the lid`).toBeLessThan(CONTACT_IN);
            }
          }
          // clear of the horn, the driver, the horn posts and the input dish (boxes: a simplified check)
          for (const o of others) {
            const ob = new THREE.Box3().setFromObject(o);
            expect(overlaps(box, ob), `${at}: bracket clear of ${o.name}`).toBe(false);
          }
        }
      }
    });
});

test("an adapter neck below the upright's top edge leaves the upright un-notched", () => {
  const { adapter } = base.horn;
  if (!adapter) throw new Error("the default horn has no adapter");
  // a thin neck: its radius stays under the upright's top edge, so the notch has nothing to cut
  const horn = {
    ...base.horn,
    adapter: {
      ...adapter,
      steps: [
        [5.6, 0.35],
        [1, 0.6],
        [5, 0.66],
      ] as const,
    },
  };
  const g = buildStackScene({ ...base, horn, layout: "stack" });
  const hornBox = boxOf(g, HORN_MESH_NAME);
  if (!hornBox) throw new Error("no horn");
  const axisY = hornBox.getCenter(new THREE.Vector3()).y;
  const top = -(adapter.bodyBoltCircle / 2) * Math.SQRT1_2 + BRACKET.aboveBolts;
  const tallest = Math.max(
    ...meshesNamed(g, BRACKET_MESH_NAME).map((m) => new THREE.Box3().setFromObject(m).max.y),
  );
  expect(tallest).toBeCloseTo(axisY + top, 6);
});

/** The body color of the scene's horn meshes, as hex. */
function hornColors(group: THREE.Group) {
  return meshesNamed(group, HORN_MESH_NAME).map((m) => {
    if (!(m.material instanceof THREE.MeshStandardMaterial)) throw new Error("horn material");
    return m.material.color.getHex();
  });
}

describe("horn finish", () => {
  const COMMERCIAL = ["Lavoce", "B&C", "RCF", "Beyma"];
  const isCommercial = (name: string) => COMMERCIAL.some((maker) => name.startsWith(`${maker} `));

  test("Lavoce, B&C, RCF and Beyma horns are drawn factory black; printed horns stay cream", () => {
    for (const maker of COMMERCIAL) {
      expect(HORN_OPTIONS.some((h) => h.name.startsWith(`${maker} `))).toBe(true);
    }
    for (const horn of HORN_OPTIONS) {
      const want = isCommercial(horn.name) ? PARTS_3D.hornBlack : PARTS_3D.cream;
      const colors = hornColors(buildStackScene({ ...base, horn, layout: "stack" }));
      expect(colors.length, horn.id).toBeGreaterThan(0);
      for (const c of colors) expect(c, horn.id).toBe(want);
    }
  });

  const black = HORN_OPTIONS.find((h) => h.finish === "black");
  if (!black) throw new Error("no factory-black horn");
  const PICKED = "#b23a2f";

  test("a picked horn color overrides the catalog finish", () => {
    for (const horn of [black, base.horn]) {
      const colors = hornColors(buildStackScene({ ...base, horn, hornColor: PICKED }));
      for (const c of colors) expect(c, horn.id).toBe(0xb23a2f);
    }
  });

  test("clearing the picked color returns to the catalog finish", () => {
    for (const cleared of [undefined, "", HORN_COLOR_CATALOG]) {
      const hornColor = pickedHornColor(cleared);
      expect(hornColor).toBeUndefined();
      const colors = hornColors(buildStackScene({ ...base, horn: black, hornColor }));
      for (const c of colors) expect(c).toBe(PARTS_3D.hornBlack);
    }
    // the picker's reset preset, passed straight to the scene, also draws the finish
    const colors = hornColors(
      buildStackScene({ ...base, horn: black, hornColor: HORN_COLOR_CATALOG }),
    );
    for (const c of colors) expect(c).toBe(PARTS_3D.hornBlack);
  });

  test("a save from before the horn color loads with the catalog finish", () => {
    const old = { ...defaultConfig, horn: black.id };
    expect("hornColor" in old).toBe(false);
    expect(savedHornColor(old)).toBeUndefined();
    const colors = hornColors(buildStackScene(scenePropsOf(old)));
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) expect(c).toBe(PARTS_3D.hornBlack);
    // a saved color comes back as saved
    expect(savedHornColor({ hornColor: PICKED })).toBe(PICKED);
    for (const c of hornColors(buildStackScene(scenePropsOf({ ...old, hornColor: PICKED })))) {
      expect(c).toBe(0xb23a2f);
    }
  });
});
