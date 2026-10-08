// The plywood horn mount (the Build section's horn mount setting): in front of the DIY horns' throat flange, saddled
// under the neck, bolted through the flange to the driver's lower bolts, on a base on the lid; clear of the horn, the
// driver and the lid's hardware. Where it doesn't fit, the default aluminum plate (tests/horn-plate.test.ts) holds the
// driver instead.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { CD_MESH_NAME, HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { BRACKET_MESH_NAME } from "../src/components/stack-view/buildBracket";
import {
  PLY_MOUNT,
  PLY_MOUNT_MESH_NAMES,
  plyMountFit,
} from "../src/components/stack-view/buildPlyMount";
import { driverBolts } from "../src/components/stack-view/throatFit";
import { PLATE_MESH_NAMES, plateFit } from "../src/components/stack-view/buildPlate";
import { HARDWARE_MESH_NAME } from "../src/components/stack-view/buildHardware";
import { ROUNDOVER_IN } from "../src/components/stack-view/stackHeights";
import { MM_IN } from "../src/components/stack-view/geometry";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import { DIY_ROSSE110X50 } from "../src/data/catalog/horns";
import { N314T } from "../src/data/catalog/compression-drivers";
import { DEFAULT_PA } from "../src/lib/defaults";
import { savedHornMount, takesHornMount } from "../src/lib/pa/hornMount";
import {
  HORN_MOUNT_DEFAULT,
  HORN_MOUNT_NAMES,
  HORN_MOUNT_PANEL,
  RETIRED_HORN_MOUNT_BRACKET,
} from "../src/constants/hornMount";
import { PANEL_STOCK } from "../src/data/catalog/plywood";
import {
  CLEAR_IN,
  CONTACT_IN,
  LID_LAYOUTS,
  base,
  bolted,
  boxOf,
  hornSamples,
  inside,
  meshFlange,
  meshed,
  meshesNamed,
  overlaps,
  scene,
  worldVertices,
} from "./mount-helpers";
import type { Horn, PaLayout } from "../src/types";

const PLY_IN = PANEL_STOCK[HORN_MOUNT_PANEL].in;

/** The scene's horns, each with the upright in front of it (the one on its axis). */
function hornsWithUprights(g: THREE.Group) {
  const uprights = meshesNamed(g, PLY_MOUNT_MESH_NAMES.upright);
  return meshesNamed(g, HORN_MESH_NAME).map((body) => {
    const axis = body.getWorldPosition(new THREE.Vector3()); // the horn's origin is on its axis, at the throat
    const upright = uprights.find(
      (u) => Math.abs(boxOf(u).getCenter(new THREE.Vector3()).x - axis.x) < 1e-6,
    );
    if (!upright) throw new Error("no upright on the horn's axis");
    return { body, axis, upright };
  });
}

/**
 * The upright's outline in the axis' frame: half its width, its top and bottom, the saddle's radius (its nearest
 * point to the axis) and its back and front faces' z.
 */
function uprightOutline(upright: THREE.Mesh, axis: THREE.Vector3) {
  const box = boxOf(upright);
  const saddleR = Math.min(
    ...worldVertices(upright)
      .filter((p) => p.y - axis.y < box.max.y - axis.y - 1e-6 || Math.abs(p.x - axis.x) < 0.1)
      .map((p) => Math.hypot(p.x - axis.x, p.y - axis.y)),
  );
  return {
    w: (box.max.x - box.min.x) / 2,
    top: box.max.y - axis.y,
    bottom: box.min.y - axis.y,
    saddleR,
    zBack: box.min.z,
    zFront: box.max.z,
  };
}

describe("the plywood horn mount on the DIY horns", () => {
  test("the DIY horns take it with the N314T, whose four 1/4-20 bolts sit on a 4 in circle at 45°", () => {
    expect(base.cd.body.bolts).toEqual(N314T.body.bolts);
    expect(N314T.body.bolts).toMatchObject({ n: 4, thread: "1/4-20", circle: 4 });
    const bolts = driverBolts(N314T);
    expect(bolts.filter((b) => b.y < 0)).toHaveLength(2);
    for (const b of bolts) expect(Math.abs(Math.abs(b.x) - Math.abs(b.y))).toBeLessThan(1e-9);
    for (const { horn, mesh } of meshed) {
      expect(takesHornMount(horn, "stack"), horn.id).toBe(true);
      expect(takesHornMount(horn, "tower"), horn.id).toBe(false);
      // the flange the mount is sized for: ⌀130 mm, 12 mm thick
      const flange = meshFlange(mesh);
      expect(2 * flange.rim, horn.id).toBeCloseTo(130 * MM_IN, 1);
      expect(flange.front, horn.id).toBeCloseTo(12 * MM_IN, 3);
    }
  });

  for (const layout of LID_LAYOUTS)
    test(`${layout}: the upright stands in front of the flange and behind the flare, its top 4 mm under the axis, its saddle clear of the neck`, () => {
      for (const { horn, mesh } of meshed) {
        const at = `${horn.id} ${layout}`;
        const g = scene({ horn, layout, hornMount: "ply" });
        const flange = meshFlange(mesh);
        const horns = hornsWithUprights(g);
        expect(horns, at).toHaveLength(layout === "satellite" ? 2 : 1);
        for (const { body, axis, upright } of horns) {
          const u = uprightOutline(upright, axis);
          // ½″ ply against the flange's front face, as wide as the flange, from the lid to 4 mm under the axis
          expect(Math.abs(u.zBack - (axis.z + flange.front)), `${at}: on the flange`).toBeLessThan(
            CONTACT_IN,
          );
          expect(u.zFront - u.zBack, at).toBeCloseTo(PLY_IN, 6);
          expect(u.w, at).toBeCloseTo(flange.rim, 3);
          expect(u.top, at).toBeCloseTo(-PLY_MOUNT.belowAxis, 6);
          // the R-OSSE's neck is about R31 there: the saddle is the neck's widest point over the ply's depth + 1.5 mm
          if (horn.id === DIY_ROSSE110X50.id) {
            expect(u.saddleR / MM_IN, at).toBeGreaterThan(30);
            expect(u.saddleR / MM_IN, at).toBeLessThan(34);
          }
          // the horn's surface over the ply's depth: inside the saddle (clear by about 1.5 mm), and nowhere in the ply
          const slab = new THREE.Box3(
            new THREE.Vector3(axis.x - u.w, axis.y + u.bottom, u.zBack),
            new THREE.Vector3(axis.x + u.w, axis.y + u.top, u.zFront),
          );
          const holes = driverBolts(base.cd).filter((b) => b.y < u.top);
          let inSlab = 0;
          let widest = 0;
          for (const p of hornSamples(body, slab)) {
            const [x, y, z] = [p.x - axis.x, p.y - axis.y, p.z];
            if (z <= u.zBack + CLEAR_IN || z >= u.zFront - CLEAR_IN) continue;
            inSlab++;
            const r = Math.hypot(x, y);
            if (y < u.top) widest = Math.max(widest, r);
            const inPly =
              Math.abs(x) < u.w - CLEAR_IN &&
              y < u.top - CLEAR_IN &&
              y > u.bottom + CLEAR_IN &&
              r > u.saddleR + CLEAR_IN &&
              holes.every((b) => Math.hypot(x - b.x, y - b.y) > PLY_MOUNT.boltHole / 2 + CLEAR_IN);
            expect(inPly, `${at}: horn inside the upright at ${x}, ${y}, ${z}`).toBe(false);
          }
          expect(inSlab, `${at}: the neck passes through the saddle`).toBeGreaterThan(100);
          expect(u.saddleR - widest, `${at}: saddle clears the neck`).toBeGreaterThan(
            PLY_MOUNT.saddleGap - 0.1 * MM_IN,
          );
          // behind the flare: in front of the ply's front face, the horn's surface reaches out past the saddle
          const ahead = hornSamples(
            body,
            new THREE.Box3(
              new THREE.Vector3(axis.x - u.w, axis.y + u.bottom, u.zFront),
              new THREE.Vector3(axis.x + u.w, axis.y + u.top, u.zFront + 1),
            ),
          ).filter((p) => p.z > u.zFront && p.z < u.zFront + 1 && p.y < axis.y + u.top);
          expect(
            Math.max(...ahead.map((p) => Math.hypot(p.x - axis.x, p.y - axis.y))),
            `${at}: the flare in front`,
          ).toBeGreaterThan(u.saddleR);
        }
      }
    });

  for (const layout of LID_LAYOUTS)
    test(`${layout}: the upright's bolt holes and bolts line up with the driver's lower bolts, and the driver bolts to the flange`, () => {
      for (const { horn } of meshed) {
        const at = `${horn.id} ${layout}`;
        const g = scene({ horn, layout, hornMount: "ply" });
        const bolts = meshesNamed(g, PLY_MOUNT_MESH_NAMES.bolt);
        const horns = hornsWithUprights(g);
        // a hex head and a washer per lower bolt
        expect(bolts, at).toHaveLength(2 * 2 * horns.length);
        const drivers = meshesNamed(g, CD_MESH_NAME);
        for (const { axis, upright } of horns) {
          const u = uprightOutline(upright, axis);
          const lower = driverBolts(base.cd).filter((b) => b.y < u.top);
          expect(lower, at).toHaveLength(2);
          // the driver's front face on the flange's back face (the throat plane), not moved back
          const cdFront = Math.max(
            ...drivers
              .map(boxOf)
              .filter((b) => Math.abs(b.getCenter(new THREE.Vector3()).x - axis.x) < 1e-6)
              .map((b) => b.max.z),
          );
          expect(Math.abs(cdFront - axis.z), `${at}: driver on the flange`).toBeLessThan(
            CONTACT_IN,
          );
          const verts = worldVertices(upright).map((p) => ({ x: p.x - axis.x, y: p.y - axis.y }));
          for (const b of lower) {
            // the hole's outline: the upright's vertices round the bolt, at the hole's radius
            const rim = verts.filter(
              (p) => Math.abs(Math.hypot(p.x - b.x, p.y - b.y) - PLY_MOUNT.boltHole / 2) < 1e-4,
            );
            expect(rim.length, `${at}: a hole at ${b.x}, ${b.y}`).toBeGreaterThan(8);
            const xs = rim.map((p) => p.x);
            const ys = rim.map((p) => p.y);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            expect(Math.hypot(cx - b.x, cy - b.y), `${at}: hole on the bolt`).toBeLessThan(1e-3);
            expect(Math.max(...xs) - Math.min(...xs), at).toBeCloseTo(PLY_MOUNT.boltHole, 3);
            // a head and a washer on it, against the upright's front
            const on = bolts.filter((m) => {
              const c = m.getWorldPosition(new THREE.Vector3());
              return Math.hypot(c.x - axis.x - b.x, c.y - axis.y - b.y) < 1e-6;
            });
            expect(on, `${at}: bolt at ${b.x}, ${b.y}`).toHaveLength(2);
            expect(
              Math.min(...on.map((m) => boxOf(m).min.z)),
              `${at}: washer on the upright`,
            ).toBeCloseTo(u.zFront, 6);
          }
          // the upper bolts hold the flange alone: above the upright's top edge
          for (const b of driverBolts(base.cd).filter((x) => x.y > u.top))
            expect(b.y - PLY_MOUNT.boltHole / 2, at).toBeGreaterThan(u.top);
        }
      }
    });

  for (const layout of LID_LAYOUTS)
    test(`${layout}: the base lies on the lid behind the upright, and the gusset stands on it against the upright`, () => {
      for (const { horn } of meshed) {
        const at = `${horn.id} ${layout}`;
        const g = scene({ horn, layout, hornMount: "ply" });
        const horns = hornsWithUprights(g);
        const bases = meshesNamed(g, PLY_MOUNT_MESH_NAMES.base);
        const gussets = meshesNamed(g, PLY_MOUNT_MESH_NAMES.gusset);
        expect(bases, at).toHaveLength(horns.length);
        expect(gussets, at).toHaveLength(horns.length);
        const notMount = new Set<string>(Object.values(PLY_MOUNT_MESH_NAMES));
        const all: THREE.Object3D[] = [];
        g.traverse(
          (o) =>
            o instanceof THREE.Mesh &&
            !notMount.has(o.name) &&
            o.parent?.name !== "scale-figure" &&
            all.push(o),
        );
        for (const { axis, upright } of horns) {
          const ub = boxOf(upright);
          const bb = bases
            .map(boxOf)
            .find((b) => Math.abs(b.getCenter(new THREE.Vector3()).x - axis.x) < 1e-6);
          const gb = gussets
            .map(boxOf)
            .find((b) => Math.abs(b.getCenter(new THREE.Vector3()).x - axis.x) < 1e-6);
          if (!bb || !gb) throw new Error(`${at}: no base or gusset on the axis`);
          // about 130 × 102 mm of ½″ ply, butted to the upright's back face, on the lid's roundover like the upright
          const size = bb.getSize(new THREE.Vector3());
          expect(size.x / MM_IN, at).toBeCloseTo(130.4, 0);
          expect(size.z / MM_IN, at).toBeCloseTo(101.6, 0);
          expect(size.y, at).toBeCloseTo(PLY_IN, 6);
          expect(Math.abs(bb.max.z - ub.min.z), `${at}: base against the upright`).toBeLessThan(
            CONTACT_IN,
          );
          expect(bb.min.y, `${at}: base and upright on the lid`).toBeCloseTo(ub.min.y, 6);
          // a ray down from just above the base's underside meets the lid at once, across its width and depth
          for (const dx of [-size.x / 2 + 0.1, 0, size.x / 2 - 0.1])
            for (const dz of [-size.z / 2 + 0.1, 0, size.z / 2 - 0.1]) {
              const c = bb.getCenter(new THREE.Vector3());
              const ray = new THREE.Raycaster(
                new THREE.Vector3(c.x + dx, bb.min.y + CONTACT_IN / 2, c.z + dz),
                new THREE.Vector3(0, -1, 0),
              );
              const hit = ray.intersectObjects(all, false)[0];
              expect(hit, `${at}: lid under the base`).toBeDefined();
              expect(hit?.distance ?? Infinity, `${at}: base on the lid`).toBeLessThan(CONTACT_IN);
            }
          // the lid's roundover top: the bracket's foot stands there too
          expect(bb.min.y - ROUNDOVER_IN, at).toBeGreaterThan(0);
          // the gusset: ½″ thick on the center line, 90 mm along the base, on the base and against the upright
          expect(gb.max.x - gb.min.x, at).toBeCloseTo(PLY_IN, 6);
          expect(gb.getCenter(new THREE.Vector3()).x, at).toBeCloseTo(axis.x, 6);
          expect((gb.max.z - gb.min.z) / MM_IN, at).toBeCloseTo(90, 3);
          expect(Math.abs(gb.min.y - bb.max.y), `${at}: gusset on the base`).toBeLessThan(
            CONTACT_IN,
          );
          expect(Math.abs(gb.max.z - ub.min.z), `${at}: gusset against the upright`).toBeLessThan(
            CONTACT_IN,
          );
          expect(gb.max.y - gb.min.y, at).toBeLessThanOrEqual(PLY_MOUNT.gussetLeg + 1e-9);
        }
      }
    });
});

/** The default mount drawn where the plywood mount doesn't fit: the aluminum plate, or the L-bracket where neither fits. */
function expectFallback(g: THREE.Group, horn: Horn, cd: Props["cd"], at: string) {
  const plate = plateFit(horn, cd, base.mid.box.w) !== null;
  expect(meshesNamed(g, PLATE_MESH_NAMES.plate).length > 0, `${at}: the plate`).toBe(plate);
  expect(meshesNamed(g, BRACKET_MESH_NAME).length > 0, `${at}: the L-bracket`).toBe(!plate);
}

/**
 * The mount on one horn and driver, where it fits: in place of the plate, clear of the horn, the driver (the base and
 * gusset at least `driverGap` under it) and the lid's posts and dish, and on the lid. Where it doesn't fit, the plate
 * (or the L-bracket).
 */
function checkMount(horn: Horn, cd: Props["cd"], layout: PaLayout) {
  const at = `${horn.id} + ${JSON.stringify(cd.body.bolts)} ${layout}`;
  const g = scene({ horn, cd, layout, hornMount: "ply" });
  const parts = Object.values(PLY_MOUNT_MESH_NAMES).flatMap((n) => meshesNamed(g, n));
  if (!plyMountFit(horn, cd, base.mid.box.w)) {
    expect(parts, `${at}: no mount where it doesn't fit`).toHaveLength(0);
    expectFallback(g, horn, cd, at);
    return;
  }
  expect(meshesNamed(g, BRACKET_MESH_NAME), at).toHaveLength(0);
  expect(meshesNamed(g, PLATE_MESH_NAMES.plate), at).toHaveLength(0);
  const horns = hornsWithUprights(g);
  const drivers = meshesNamed(g, CD_MESH_NAME);
  const others = [...drivers, ...meshesNamed(g, HARDWARE_MESH_NAME)];
  for (const part of parts) {
    const pb = boxOf(part);
    for (const o of others)
      expect(overlaps(pb, boxOf(o)), `${at}: ${part.name} clear of ${o.name}`).toBe(false);
  }
  // the base and gusset: under the driver by the gap wherever they reach under it
  for (const part of parts.filter((m) => m.name !== PLY_MOUNT_MESH_NAMES.upright)) {
    const pb = boxOf(part);
    for (const d of drivers) {
      const db = boxOf(d);
      const under =
        pb.max.z > db.min.z + CLEAR_IN &&
        pb.min.z < db.max.z - CLEAR_IN &&
        pb.max.x > db.min.x &&
        pb.min.x < db.max.x;
      if (under)
        expect(db.min.y - pb.max.y, `${at}: ${part.name} under the driver`).toBeGreaterThanOrEqual(
          part.name === PLY_MOUNT_MESH_NAMES.base ? PLY_MOUNT.driverGap - 1e-6 : 0,
        );
    }
  }
  for (const { body, axis, upright } of horns) {
    // the upright: no horn surface in the ply round the saddle
    const u = uprightOutline(upright, axis);
    expect(u.top, at).toBeLessThanOrEqual(-PLY_MOUNT.belowAxis + 1e-6);
    const holes = driverBolts(cd, "upright").filter((b) => b.y < u.top);
    for (const p of hornSamples(body, boxOf(upright))) {
      const [x, y] = [p.x - axis.x, p.y - axis.y];
      if (p.z <= u.zBack + CLEAR_IN || p.z >= u.zFront - CLEAR_IN) continue;
      const inPly =
        Math.abs(x) < u.w - CLEAR_IN &&
        y < u.top - CLEAR_IN &&
        y > u.bottom + CLEAR_IN &&
        Math.hypot(x, y) > u.saddleR + CLEAR_IN &&
        holes.every((b) => Math.hypot(x - b.x, y - b.y) > PLY_MOUNT.boltHole / 2 + CLEAR_IN);
      expect(inPly, `${at}: horn inside the upright at ${x}, ${y}, ${p.z}`).toBe(false);
    }
    // the base, the gusset and the bolts on this horn's axis: no horn surface inside them
    const own = parts.filter(
      (m) => m !== upright && Math.abs(boxOf(m).getCenter(new THREE.Vector3()).x - axis.x) < 1.5,
    );
    for (const m of own) {
      const mb = boxOf(m);
      for (const p of hornSamples(body, mb))
        expect(inside(mb, p), `${at}: horn inside ${m.name}`).toBe(false);
    }
  }
}

describe("the plywood horn mount on every horn it applies to", () => {
  for (const { horn, cds } of bolted)
    test(`stack, ${horn.id}: with every driver that fits it, the mount clears the horn, the driver and the lid's parts, or the plate stays`, () => {
      for (const cd of cds) checkMount(horn, cd, "stack");
    });

  for (const layout of LID_LAYOUTS.filter((l) => l !== "stack"))
    test(`${layout}: the mount clears the horn, the driver and the lid's parts on every horn`, () => {
      for (const { horn, cds } of bolted) checkMount(horn, cds[0] ?? base.cd, layout);
    });

  test("the tower has no mount, and a horn with a throat adapter keeps its bracket", () => {
    for (const horn of HORN_OPTIONS) {
      const tower = scene({ horn, layout: "tower", hornMount: "ply" });
      for (const name of Object.values(PLY_MOUNT_MESH_NAMES))
        expect(meshesNamed(tower, name), `${horn.id} tower`).toHaveLength(0);
      if (!horn.adapter) continue;
      expect(takesHornMount(horn, "stack"), horn.id).toBe(false);
      const g = scene({ horn, layout: "stack", hornMount: "ply" });
      expect(meshesNamed(g, BRACKET_MESH_NAME).length, horn.id).toBeGreaterThan(0);
      expect(meshesNamed(g, PLY_MOUNT_MESH_NAMES.upright), horn.id).toHaveLength(0);
    }
  });

  test("a driver hanging close over the base: the base stops in front of it, or is left out", () => {
    // the ME45 is short, so a large 1" driver hangs within the gap of the base's top
    const me45 = HORN_OPTIONS.find((h) => h.id === "me45");
    if (!me45) throw new Error("no ME45");
    const low = CD_OPTIONS.filter((c) => c.exit === me45.exit).filter(
      (c) => plyMountFit(me45, c, base.mid.box.w)?.baseClearsDriver === false,
    );
    expect(low.length).toBeGreaterThan(0);
    for (const cd of low) {
      const g = scene({ horn: me45, cd, hornMount: "ply" });
      const cdBox = new THREE.Box3();
      meshesNamed(g, CD_MESH_NAME).forEach((m) => cdBox.expandByObject(m));
      for (const b of meshesNamed(g, PLY_MOUNT_MESH_NAMES.base))
        expect(boxOf(b).min.z, cd.id).toBeGreaterThanOrEqual(
          cdBox.max.z + PLY_MOUNT.driverGap - 1e-6,
        );
    }
  });

  test("a shallow box: the base stops at the lid's back edge", () => {
    const d = DIY_ROSSE110X50.size.d + 1;
    const g = buildStackScene({
      ...base,
      horn: DIY_ROSSE110X50,
      hornMount: "ply",
      mid: { ...base.mid, box: { ...base.mid.box, d } },
    });
    g.updateMatrixWorld(true);
    const [b] = meshesNamed(g, PLY_MOUNT_MESH_NAMES.base);
    if (!b) throw new Error("no base");
    expect(boxOf(b).min.z).toBeCloseTo(-d / 2 + ROUNDOVER_IN, 6);
    expect(boxOf(b).max.z - boxOf(b).min.z).toBeLessThan(PLY_MOUNT.baseDepth);
  });
});

describe("two-bolt drivers on the plywood mount", () => {
  const twoBolt = CD_OPTIONS.filter((c) => c.body.bolts.n === 2);
  const rx28 = HORN_OPTIONS.find((h) => h.id === "rx28");
  if (!rx28) throw new Error("no RX28");

  test("their bolts stand upright: the bottom one goes through the ply, centered, and the top one holds the flange", () => {
    expect(twoBolt.length).toBeGreaterThan(0);
    for (const cd of twoBolt.filter((c) => c.exit === rx28.exit)) {
      const [bottom, top] = [...driverBolts(cd, "upright")].sort((a, b) => a.y - b.y);
      expect(bottom.x, cd.id).toBeCloseTo(0, 9);
      expect(top.x, cd.id).toBeCloseTo(0, 9);
      expect(bottom.y, cd.id).toBeCloseTo(-cd.body.bolts.circle / 2, 9);
      const g = scene({ horn: rx28, cd, hornMount: "ply" });
      const [{ axis, upright }] = hornsWithUprights(g);
      const u = uprightOutline(upright, axis);
      expect(top.y, `${cd.id}: top bolt above the ply`).toBeGreaterThan(u.top);
      // one head and washer, on the bottom bolt
      const bolts = meshesNamed(g, PLY_MOUNT_MESH_NAMES.bolt);
      expect(bolts, cd.id).toHaveLength(2);
      for (const m of bolts) {
        const c = m.getWorldPosition(new THREE.Vector3());
        expect(c.x - axis.x, cd.id).toBeCloseTo(0, 6);
        expect(c.y - axis.y, cd.id).toBeCloseTo(bottom.y, 6);
      }
      // its washer on the ply: clear of the saddle and the edges
      const washerR = PLY_MOUNT.boltHole / 2 + PLY_MOUNT.washerPast;
      expect(Math.abs(bottom.y) - washerR, cd.id).toBeGreaterThanOrEqual(u.saddleR - 1e-6);
      expect(bottom.y + washerR, cd.id).toBeLessThanOrEqual(u.top);
    }
  });

  test("with a four-bolt driver the bolts stay at 45°, as the flange's holes are", () => {
    for (const cd of CD_OPTIONS.filter((c) => c.body.bolts.n === 4))
      expect(driverBolts(cd, "upright"), cd.id).toEqual(driverBolts(cd));
  });

  test("where no bolt has room for its washer on the ply (the DE360's 57 mm circle on the ST260), the mount can't be picked", () => {
    const de360 = CD_OPTIONS.find((c) => c.id === "de360");
    const narrow = HORN_OPTIONS.filter((h) => h.id === "st260" || h.id === "iwata600");
    if (!de360) throw new Error("no DE360");
    expect(narrow).toHaveLength(2);
    for (const horn of narrow) {
      expect(takesHornMount(horn, "stack"), horn.id).toBe(true);
      expect(plyMountFit(horn, de360, base.mid.box.w), horn.id).toBeNull();
      const g = scene({ horn, cd: de360, hornMount: "ply" });
      expect(meshesNamed(g, PLY_MOUNT_MESH_NAMES.upright), horn.id).toHaveLength(0);
      expectFallback(g, horn, de360, horn.id);
    }
  });

  test("a bolt whose washer would straddle the top edge: the edge drops below it", () => {
    // a made-up six-bolt driver on a 100 mm circle: its bolt at 345° sits 12.9 mm under the axis
    const cd = {
      ...base.cd,
      body: { ...base.cd.body, bolts: { n: 6, thread: "M6", circle: 100 * MM_IN } },
    };
    const fit = plyMountFit(rx28, cd, base.mid.box.w);
    if (!fit) throw new Error("no fit");
    const washerR = PLY_MOUNT.boltHole / 2 + PLY_MOUNT.washerPast;
    expect(fit.top).toBeLessThan(-PLY_MOUNT.belowAxis);
    for (const b of driverBolts(cd, "upright"))
      expect(
        b.y + washerR <= fit.top + 1e-9 || b.y - washerR >= fit.top - 1e-9,
        `${b.x}, ${b.y}`,
      ).toBe(true);
    const straddler = driverBolts(cd, "upright").find(
      (b) => Math.abs(b.y + 50 * MM_IN * Math.sin(Math.PI / 12)) < 1e-9,
    );
    expect(straddler).toBeDefined();
    expect(fit.top).toBeCloseTo((straddler?.y ?? 0) - washerR, 9);
    expect(fit.through.length).toBeGreaterThan(0);
  });
});

describe("with the aluminum plate (the default)", () => {
  test("no plywood mount is drawn (tests/horn-mount-off.test.ts pins the default scenes)", () => {
    expect(HORN_MOUNT_DEFAULT).toBe("plate");
    expect(DEFAULT_PA.hornMount).toBe(HORN_MOUNT_DEFAULT);
    for (const layout of [...LID_LAYOUTS, "tower"] as const)
      for (const horn of HORN_OPTIONS) {
        const g = scene({ horn, layout, hornMount: "plate" });
        for (const name of Object.values(PLY_MOUNT_MESH_NAMES))
          expect(meshesNamed(g, name), `${horn.id} ${layout}`).toHaveLength(0);
      }
  });

  test("a save from before the setting, with the retired L-bracket, or with a bad value, loads with the plate", () => {
    expect(savedHornMount(undefined)).toBe("plate");
    expect(savedHornMount(RETIRED_HORN_MOUNT_BRACKET)).toBe("plate");
    expect(savedHornMount("plywood")).toBe("plate");
    expect(savedHornMount(3)).toBe("plate");
    for (const id of Object.keys(HORN_MOUNT_NAMES)) expect(savedHornMount(id)).toBe(id);
  });
});
