// The aluminum front plate (the horn mount setting's default): in front of the throat flange, slotted for the neck,
// bolted through the flange to every driver bolt with room for its washer, bent back into a foot on the lid; clear of
// the horn, the driver and the lid's hardware. Where no bolt can pass through it, the clamped L-bracket holds the
// driver instead.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import type { Props } from "../src/components/stack-view/buildStackScene";
import { CD_MESH_NAME, HORN_MESH_NAME } from "../src/components/stack-view/buildHorn";
import { BRACKET, BRACKET_MESH_NAME } from "../src/components/stack-view/buildBracket";
import {
  PLATE,
  PLATE_MESH_NAMES,
  plateFit,
  type PlateFit,
} from "../src/components/stack-view/buildPlate";
import { BOLT_TURNS, driverBolts, type XY } from "../src/components/stack-view/throatFit";
import { HARDWARE_MESH_NAME } from "../src/components/stack-view/buildHardware";
import { MM_IN } from "../src/components/stack-view/geometry";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import { N314T } from "../src/data/catalog/compression-drivers";
import { DIY_OS90X70, DIY_ROSSE110X50 } from "../src/data/catalog/horns";
import { takesHornMount } from "../src/lib/pa/hornMount";
import {
  CLAMPED_BRACKET_NAME,
  HORN_MOUNT_PLATE_FALLBACK,
  HORN_MOUNT_TIPS,
} from "../src/constants/hornMount";
import {
  CLEAR_IN,
  CONTACT_IN,
  LID_LAYOUTS,
  base,
  bolted,
  boxOf,
  centerOf,
  hornSamples,
  inside,
  meshFlange,
  meshedFor,
  meshesNamed,
  overlaps,
  scene,
  worldVertices,
} from "./mount-helpers";
import type { Horn, PaLayout } from "../src/types";

const fitOf = (horn: Horn, cd: Props["cd"]) => plateFit(horn, cd, base.mid.box.w);
const hornOf = (id: string) => {
  const horn = HORN_OPTIONS.find((h) => h.id === id);
  if (!horn) throw new Error(`no horn ${id}`);
  return horn;
};
const cdOf = (id: string) => {
  const cd = CD_OPTIONS.find((c) => c.id === id);
  if (!cd) throw new Error(`no driver ${id}`);
  return cd;
};

/** Whether a point (in the axis' frame) is in the plate's metal: inside its outline, outside the slot and the holes. */
function inMetal(f: PlateFit, x: number, y: number, margin: number) {
  const inOutline = Math.abs(x) < f.w - margin && y < f.top - margin && y > f.bottom + margin;
  const inSlot =
    y >= 0
      ? Math.abs(x) < f.slotW + margin
      : (x / (f.slotW + margin)) ** 2 + (y / (f.slotD + margin)) ** 2 < 1;
  const inHole = f.through.some((b) => Math.hypot(x - b.x, y - b.y) < PLATE.boltHole / 2 + margin);
  return inOutline && !inSlot && !inHole;
}

/** The scene's horns, each with its axis and the plate on it. */
function hornsWithPlates(g: THREE.Group) {
  const plates = meshesNamed(g, PLATE_MESH_NAMES.plate);
  return meshesNamed(g, HORN_MESH_NAME).map((body) => {
    const axis = body.getWorldPosition(new THREE.Vector3()); // the horn's origin is on its axis, at the throat
    const plate = plates.find((p) => Math.abs(centerOf(p).x - axis.x) < 1e-6);
    if (!plate) throw new Error("no plate on the horn's axis");
    return { body, axis, plate };
  });
}

/**
 * The plate on one horn and driver, where it fits: in place of the L-bracket; its metal clear of the horn's surface;
 * the foot on the lid, clear of the driver (by `driverGap` under it) and the lid's posts and dish; the heads clear of
 * the horn; no bolt left passing through its metal. Where it doesn't fit, the clamped L-bracket.
 */
function checkPlate(horn: Horn, cd: Props["cd"], layout: PaLayout) {
  const at = `${horn.id} + ${JSON.stringify(cd.body.bolts)} ${layout}`;
  const g = scene({ horn, cd, layout });
  const parts = Object.values(PLATE_MESH_NAMES).flatMap((n) => meshesNamed(g, n));
  const fit = fitOf(horn, cd);
  if (!fit) {
    expect(parts, `${at}: no plate where it doesn't fit`).toHaveLength(0);
    expect(meshesNamed(g, BRACKET_MESH_NAME).length, `${at}: the L-bracket`).toBeGreaterThan(0);
    return;
  }
  expect(meshesNamed(g, BRACKET_MESH_NAME), at).toHaveLength(0);
  const drivers = meshesNamed(g, CD_MESH_NAME);
  const hardware = meshesNamed(g, HARDWARE_MESH_NAME);
  for (const part of parts) {
    const pb = boxOf(part);
    for (const o of [...drivers, ...hardware])
      expect(overlaps(pb, boxOf(o)), `${at}: ${part.name} clear of ${o.name}`).toBe(false);
  }
  // the foot under the driver by the gap wherever it reaches under it
  for (const foot of meshesNamed(g, PLATE_MESH_NAMES.foot)) {
    const fb = boxOf(foot);
    for (const d of drivers) {
      const db = boxOf(d);
      if (fb.max.z > db.min.z + CLEAR_IN && fb.min.z < db.max.z - CLEAR_IN)
        expect(db.min.y - fb.max.y, `${at}: foot under the driver`).toBeGreaterThanOrEqual(
          PLATE.driverGap - 1e-6,
        );
    }
  }
  // a bolt that doesn't go through the plate holds the flange alone: its head (flange or washer) sits clear of the
  // plate's metal, all of its disk
  const headR = fit.head.flangeR;
  for (const b of driverBolts(cd, fit.turn).filter(
    (p) => !fit.through.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 1e-9),
  ))
    for (const r of [0, headR / 2, headR])
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * i) / 8;
        expect(
          inMetal(fit, b.x + r * Math.cos(a), b.y + r * Math.sin(a), 0),
          `${at}: head of the bolt at ${b.x}, ${b.y} on the metal`,
        ).toBe(false);
      }
  // each through bolt's head all on the metal, round its hole
  for (const b of fit.through)
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * i) / 8;
      expect(
        inMetal(fit, b.x + headR * Math.cos(a), b.y + headR * Math.sin(a), -1e-9),
        `${at}: head of the bolt at ${b.x}, ${b.y} off the metal`,
      ).toBe(true);
    }
  for (const { body, axis, plate } of hornsWithPlates(g)) {
    const pb = boxOf(plate);
    // the plate in front of the flange: its metal holds no horn surface (the slot clears the neck)
    for (const p of hornSamples(body, pb)) {
      if (p.z <= pb.min.z + CLEAR_IN || p.z >= pb.max.z - CLEAR_IN) continue;
      const [x, y] = [p.x - axis.x, p.y - axis.y];
      expect(inMetal(fit, x, y, CLEAR_IN), `${at}: horn in the plate at ${x}, ${y}, ${p.z}`).toBe(
        false,
      );
    }
    // the foot (its box) and the heads (round, along z) on this horn's axis: no horn surface inside them
    const own = parts.filter((m) => m !== plate && Math.abs(centerOf(m).x - axis.x) < 3);
    for (const m of own) {
      const mb = boxOf(m);
      const c = centerOf(m);
      const r = (mb.max.x - mb.min.x) / 2;
      for (const p of hornSamples(body, mb)) {
        const hit =
          m.name === PLATE_MESH_NAMES.bolt
            ? Math.hypot(p.x - c.x, p.y - c.y) < r - CLEAR_IN &&
              p.z > mb.min.z + CLEAR_IN &&
              p.z < mb.max.z - CLEAR_IN
            : inside(mb, p);
        expect(hit, `${at}: horn inside ${m.name}`).toBe(false);
      }
    }
  }
}

describe("the aluminum plate on the DIY horns with the N314T", () => {
  for (const layout of LID_LAYOUTS)
    test(`${layout}: the plate stands in front of the flange, slotted round the neck, its two lower bolts through it, its foot on the lid`, () => {
      expect(base.cd.body.bolts).toEqual(N314T.body.bolts);
      for (const { horn, mesh } of meshedFor(N314T)) {
        const at = `${horn.id} ${layout}`;
        const fit = fitOf(horn, N314T);
        if (!fit) throw new Error(`${at}: no plate`);
        const g = scene({ horn, layout });
        const flange = meshFlange(mesh);
        const horns = hornsWithPlates(g);
        expect(horns, at).toHaveLength(layout === "satellite" ? 2 : 1);
        const notMount = new Set<string>(Object.values(PLATE_MESH_NAMES));
        const all: THREE.Object3D[] = [];
        g.traverse(
          (o) =>
            o instanceof THREE.Mesh &&
            !notMount.has(o.name) &&
            o.parent?.name !== "scale-figure" &&
            all.push(o),
        );
        const drivers = meshesNamed(g, CD_MESH_NAME);
        for (const { body, axis, plate } of horns) {
          const pb = boxOf(plate);
          // 1/8″ against the flange's front face, as wide as the flange, its top 20 mm over the axis (the lower bolts'
          // washers are far under that)
          expect(Math.abs(pb.min.z - (axis.z + flange.front)), `${at}: on the flange`).toBeLessThan(
            CONTACT_IN,
          );
          expect(pb.max.z - pb.min.z, at).toBeCloseTo(BRACKET.thickness, 6);
          expect((pb.max.x - pb.min.x) / 2, at).toBeCloseTo(flange.rim, 3);
          expect(pb.max.y - axis.y, at).toBeCloseTo(PLATE.minTop, 6);
          // the driver on the flange, not moved back
          const cdFront = Math.max(
            ...drivers
              .filter((d) => Math.abs(centerOf(d).x - axis.x) < 1e-6)
              .map((d) => boxOf(d).max.z),
          );
          expect(Math.abs(cdFront - axis.z), `${at}: driver on the flange`).toBeLessThan(
            CONTACT_IN,
          );
          // the slot: wider than the neck across and deeper under it by about the gap, over the plate's depth
          let neckW = 0;
          let neckD = 0;
          for (const p of hornSamples(body, pb)) {
            if (p.z <= pb.min.z + CLEAR_IN || p.z >= pb.max.z) continue;
            neckW = Math.max(neckW, Math.abs(p.x - axis.x));
            neckD = Math.max(neckD, axis.y - p.y);
            const [x, y] = [p.x - axis.x, p.y - axis.y];
            // inside the slot by at least most of the gap
            const g9 = 0.9 * PLATE.slotGap;
            if (y >= 0)
              expect(fit.slotW - Math.abs(x), `${at}: slot clears the neck`).toBeGreaterThan(g9);
            else
              expect(
                (x / (fit.slotW - g9)) ** 2 + (y / (fit.slotD - g9)) ** 2,
                `${at}: slot bottom clears the neck at ${x}, ${y}`,
              ).toBeLessThanOrEqual(1 + 1e-9);
          }
          expect(fit.slotW - neckW, at).toBeGreaterThanOrEqual(PLATE.slotGap - 0.2 * MM_IN);
          expect(fit.slotD - neckD, at).toBeGreaterThanOrEqual(PLATE.slotGap - 0.2 * MM_IN);
          // the slot in the plate's own outline: its vertices at the top edge stand at ±slotW
          const topVerts = worldVertices(plate).filter((v) => Math.abs(v.y - pb.max.y) < 1e-6);
          expect(
            Math.min(...topVerts.map((v) => Math.abs(v.x - axis.x))),
            `${at}: slot at the top edge`,
          ).toBeCloseTo(fit.slotW, 6);
          // the N314T's lower two bolts through it, at its holes, with a flanged button head on each; the upper two
          // hold the flange alone, above the plate
          const lower = driverBolts(N314T).filter((b) => b.y < 0);
          expect(fit.through, at).toEqual(lower);
          for (const b of driverBolts(N314T).filter((p) => p.y > 0))
            expect(b.y - PLATE.boltHole / 2, `${at}: upper bolt over the plate`).toBeGreaterThan(
              fit.top,
            );
          const verts = worldVertices(plate).map((v) => ({ x: v.x - axis.x, y: v.y - axis.y }));
          const heads = meshesNamed(g, PLATE_MESH_NAMES.bolt).filter(
            (m) => Math.abs(centerOf(m).x - axis.x) < 3,
          );
          expect(heads, at).toHaveLength(2 * lower.length);
          for (const b of lower) {
            const rim = verts.filter(
              (p) => Math.abs(Math.hypot(p.x - b.x, p.y - b.y) - PLATE.boltHole / 2) < 1e-4,
            );
            expect(rim.length, `${at}: a hole at ${b.x}, ${b.y}`).toBeGreaterThan(8);
            const xs = rim.map((p) => p.x);
            const ys = rim.map((p) => p.y);
            expect(
              Math.hypot(
                (Math.min(...xs) + Math.max(...xs)) / 2 - b.x,
                (Math.min(...ys) + Math.max(...ys)) / 2 - b.y,
              ),
              `${at}: hole on the bolt`,
            ).toBeLessThan(1e-3);
            const on = heads.filter((m) => {
              const c = m.getWorldPosition(new THREE.Vector3());
              return Math.hypot(c.x - axis.x - b.x, c.y - axis.y - b.y) < 1e-6;
            });
            expect(on, `${at}: head on ${b.x}, ${b.y}`).toHaveLength(2);
            expect(
              Math.min(...on.map((m) => boxOf(m).min.z)),
              `${at}: head on the plate`,
            ).toBeCloseTo(pb.max.z, 6);
            // the head's flange is the washer: within the plate's metal all round
            expect(
              Math.max(...on.map((m) => (boxOf(m).max.x - boxOf(m).min.x) / 2)),
              at,
            ).toBeCloseTo(fit.head.flangeR, 2);
          }
          // the foot: bent back under the driver on the lid, 80 mm from the plate's back face
          const foot = meshesNamed(g, PLATE_MESH_NAMES.foot).find(
            (m) => Math.abs(centerOf(m).x - axis.x) < 1e-6,
          );
          if (!foot) throw new Error(`${at}: no foot`);
          const fb = boxOf(foot);
          expect((pb.min.z - fb.min.z) / MM_IN, `${at}: foot length`).toBeCloseTo(
            PLATE.foot / MM_IN,
            3,
          );
          expect(Math.abs(fb.max.z - pb.max.z), `${at}: bend at the plate's front`).toBeLessThan(
            1e-6,
          );
          expect(Math.abs(fb.max.y - pb.min.y), `${at}: bend meets the plate`).toBeLessThan(1e-5);
          for (const dx of [-0.8 * flange.rim, 0, 0.8 * flange.rim])
            for (const dz of [0.25, 1.5, 2.9]) {
              const ray = new THREE.Raycaster(
                new THREE.Vector3(axis.x + dx, fb.min.y + CONTACT_IN / 2, fb.min.z + dz),
                new THREE.Vector3(0, -1, 0),
              );
              const hit = ray.intersectObjects(all, false)[0];
              expect(hit, `${at}: lid under the foot`).toBeDefined();
              expect(hit?.distance ?? Infinity, `${at}: foot on the lid`).toBeLessThan(CONTACT_IN);
            }
        }
        checkPlate(horn, N314T, layout);
      }
    });
});

describe("the aluminum plate on every horn it applies to", () => {
  for (const { horn, cds } of bolted)
    test(`stack, ${horn.id}: with every driver that fits it, the plate clears the horn, the driver and the lid's parts, or the L-bracket holds the driver`, () => {
      for (const cd of cds) checkPlate(horn, cd, "stack");
    });

  for (const layout of LID_LAYOUTS.filter((l) => l !== "stack"))
    test(`${layout}: the plate clears the horn, the driver and the lid's parts on every horn`, () => {
      for (const { horn, cds } of bolted) checkPlate(horn, cds[0] ?? base.cd, layout);
    });

  test("the top edge stands 3 mm over the highest bolt's washer, and at least 20 mm over the axis", () => {
    for (const { horn, cds } of bolted)
      for (const cd of cds) {
        const fit = fitOf(horn, cd);
        if (!fit) continue;
        const highest = Math.max(...fit.through.map((b: XY) => b.y + fit.head.flangeR));
        // at the rule's height, or lower to clear a bolt left out of the plate, but never into a through bolt's head
        expect(fit.top, `${horn.id} ${cd.id}`).toBeLessThanOrEqual(
          Math.max(PLATE.minTop, highest + PLATE.aboveWasher) + 1e-9,
        );
        expect(fit.top, `${horn.id} ${cd.id}`).toBeGreaterThanOrEqual(
          highest + PLATE.aboveWasher - 1e-9,
        );
      }
  });

  test("the plate is the default mount, and the tower and the horns on a throat adapter take none", () => {
    for (const horn of HORN_OPTIONS) {
      const tower = scene({ horn, layout: "tower" });
      for (const name of Object.values(PLATE_MESH_NAMES))
        expect(meshesNamed(tower, name), `${horn.id} tower`).toHaveLength(0);
      if (!horn.adapter) continue;
      const g = scene({ horn });
      expect(meshesNamed(g, PLATE_MESH_NAMES.plate), horn.id).toHaveLength(0);
    }
    expect(meshesNamed(scene({ horn: DIY_ROSSE110X50 }), PLATE_MESH_NAMES.plate)).toHaveLength(1);
  });
});

describe("two-bolt drivers on the plate", () => {
  test("on the DIY OS 90×70's two level holes, every pair on their circle goes through both arms, on the holes (the approved mock)", () => {
    const horn = hornOf(DIY_OS90X70.id);
    const pairs = CD_OPTIONS.filter((c) => c.exit === horn.exit && c.body.bolts.n === 2).filter(
      (c) => fitOf(horn, c) !== null,
    );
    // the 76 mm pairs (M6, M5 and 1/4-20 alike); the DE360's 57 mm circle misses the holes
    expect(pairs.map((c) => c.id)).not.toContain("de360");
    expect(pairs.map((c) => c.id)).toContain("de250");
    for (const cd of pairs) {
      const fit = fitOf(horn, cd);
      if (!fit) throw new Error(cd.id);
      expect(fit.turn, cd.id).toBeCloseTo(BOLT_TURNS.across, 9);
      expect(fit.through, cd.id).toHaveLength(2);
      for (const b of fit.through) expect(Math.abs(b.y), cd.id).toBeLessThan(1e-9);
      const g = scene({ horn, cd });
      expect(meshesNamed(g, PLATE_MESH_NAMES.bolt), cd.id).toHaveLength(4);
      expect(meshesNamed(g, BRACKET_MESH_NAME), cd.id).toHaveLength(0);
    }
  });

  test("the pair stands across the throat, both bolts through the plate's arms", () => {
    const rx28 = hornOf("rx28");
    const de250 = cdOf("de250");
    const fit = fitOf(rx28, de250);
    if (!fit) throw new Error("no plate");
    expect(fit.turn).toBeCloseTo(BOLT_TURNS.across, 9);
    const r = de250.body.bolts.circle / 2;
    expect(fit.through).toHaveLength(2);
    expect(fit.through.map((b) => b.x).sort((a, b) => a - b)).toEqual(
      [-r, r].map((v) => expect.closeTo(v, 9)),
    );
    for (const b of fit.through) expect(b.y).toBeCloseTo(0, 9);
    // both washers clear of the slot's sides and the plate's edges
    for (const b of fit.through) {
      expect(Math.abs(b.x) - fit.head.flangeR).toBeGreaterThanOrEqual(fit.slotW);
      expect(Math.abs(b.x) + fit.head.flangeR).toBeLessThanOrEqual(fit.w);
    }
    const g = scene({ horn: rx28, cd: de250 });
    const heads = meshesNamed(g, PLATE_MESH_NAMES.bolt).map((m) =>
      m.getWorldPosition(new THREE.Vector3()),
    );
    const [{ axis }] = hornsWithPlates(g);
    expect(heads).toHaveLength(4);
    for (const c of heads) {
      expect(Math.abs(Math.abs(c.x - axis.x) - r)).toBeLessThan(1e-6);
      expect(Math.abs(c.y - axis.y)).toBeLessThan(1e-6);
    }
  });

  test("where the neck leaves no room across, the pair stands upright, the bottom bolt through the plate", () => {
    // the Iwata 600's neck, stretched with its mouth, is wider than it is tall: the DE360's 57 mm pair has no room
    // beside it, but the bottom bolt clears it underneath
    const iwata = hornOf("iwata600");
    const de360 = cdOf("de360");
    const fit = fitOf(iwata, de360);
    if (!fit) throw new Error("no plate");
    expect(fit.turn).toBeCloseTo(BOLT_TURNS.upright, 9);
    expect(fit.through).toHaveLength(1);
    const [b] = fit.through;
    expect(b.x).toBeCloseTo(0, 9);
    expect(b.y).toBeCloseTo(-de360.body.bolts.circle / 2, 9);
    expect(-b.y - fit.head.flangeR).toBeGreaterThanOrEqual(fit.slotD);
  });
});

describe("where no driver bolt can pass through the plate", () => {
  test("the DE360's 57 mm circle on the ST260: the clamped L-bracket holds the driver, and the setting says so", () => {
    const de360 = cdOf("de360");
    for (const id of ["st260"]) {
      const horn = hornOf(id);
      expect(takesHornMount(horn, "stack"), id).toBe(true);
      expect(fitOf(horn, de360), id).toBeNull();
      const g = scene({ horn, cd: de360 });
      expect(meshesNamed(g, PLATE_MESH_NAMES.plate), id).toHaveLength(0);
      expect(meshesNamed(g, BRACKET_MESH_NAME).length, id).toBeGreaterThan(0);
    }
    expect(HORN_MOUNT_PLATE_FALLBACK).toContain(CLAMPED_BRACKET_NAME);
    expect(HORN_MOUNT_PLATE_FALLBACK).not.toBe(HORN_MOUNT_TIPS.plate);
  });

  test("those are the only horn and driver pairs that fall back", () => {
    const fallbacks = bolted.flatMap(({ horn, cds }) =>
      cds.filter((cd) => !fitOf(horn, cd)).map((cd) => `${horn.id} + ${cd.id}`),
    );
    // the ST260's neck leaves the DE360's 57 mm pair no room; on the DIY OS 90×70, the DE360's circle and the
    // DF10.171K's four bolts miss its two holes
    expect(fallbacks.sort()).toEqual([
      "diy_os90x70 + de360",
      "diy_os90x70 + lavoce171",
      "st260 + de360",
    ]);
  });
});
