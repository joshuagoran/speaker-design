import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import {
  ADAPTER_MESH_NAME,
  CD_MESH_NAME,
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
import type { PaLayout } from "../src/types";

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
        const g = buildStackScene({ ...base, horn, layout });
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
  const COMMERCIAL = ["Lavoce", "B&C", "RCF"];
  const isCommercial = (name: string) => COMMERCIAL.some((maker) => name.startsWith(`${maker} `));

  test("Lavoce, B&C and RCF horns are drawn factory black; printed horns stay cream", () => {
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
