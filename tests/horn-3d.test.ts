import { describe, expect, test } from "vite-plus/test";
import {
  CD_OPTIONS,
  HORN_OPTIONS,
  cdBodySteps,
  hornDepth,
  stepsDia,
  stepsLength,
} from "../src/lib/data";
import { HORN_MESHES } from "../src/data/meshes";
import {
  A460G2_14,
  DIY_OS90X50,
  DIY_OS90X70,
  DIY_ROSSE110X50,
  ST260,
} from "../src/data/catalog/horns";
import { IN_PER_MM } from "../src/constants/units";

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

  test("each mesh's size is the horn's catalog size, from the flange's back face at z = 0", () => {
    for (const { horn, mesh } of meshed) {
      const size = [0, 1, 2].map((k) => (mesh.max[k] - mesh.min[k]) * IN_PER_MM);
      expect(size[0], horn.id).toBeCloseTo(horn.size.w, 3);
      expect(size[1], horn.id).toBeCloseTo(horn.size.h, 3);
      expect(size[2], horn.id).toBeCloseTo(horn.size.d, 3);
      expect(mesh.min[2], horn.id).toBe(0);
      // the mesh takes the place of a profile and of a throat adapter
      expect(horn.profile, horn.id).toBeUndefined();
      expect(horn.adapter, horn.id).toBeUndefined();
    }
  });
});
