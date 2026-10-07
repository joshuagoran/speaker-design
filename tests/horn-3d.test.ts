import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import {
  ADAPTER_MESH_NAME,
  CD_MESH_NAME,
  HORN_MESH_NAME,
} from "../src/components/stack-view/buildHorn";
import { HORN_OPTIONS, hornDepth, stepsDia, stepsLength } from "../src/lib/data";
import { SCENE_CASE_NAMES, sceneCases } from "./scene-cases";
import type { PaLayout } from "../src/types";

/** How close two faces count as touching, in (meshes are faceted, so a contact is never exact). */
const CONTACT_IN = 0.01;
const LAYOUTS: readonly PaLayout[] = ["stack", "pole", "satellite", "tower"];

const base = (() => {
  const c = sceneCases.find((x) => x.name === SCENE_CASE_NAMES.defaultPa);
  if (!c) throw new Error("no default scene case");
  return c.props;
})();

/** The box round every mesh of a name, or null when the scene has none. */
function boxOf(group: THREE.Group, name: string) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let found = false;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === name) {
      box.expandByObject(o);
      found = true;
    }
  });
  return found ? box : null;
}

describe("horn, throat adapter and compression driver", () => {
  test("the A460G2 with its adapter is about 7.9 in deep", () => {
    const a460 = HORN_OPTIONS.find((h) => h.id === "a460g2_14");
    expect(a460?.adapter).toBeDefined();
    if (!a460?.adapter) return;
    expect(stepsLength(a460.adapter.steps) * 25.4).toBeCloseTo(41, 6);
    expect(hornDepth(a460)).toBeCloseTo(7.9, 1);
  });

  for (const layout of LAYOUTS)
    test(`${layout}: each horn's mesh matches its catalog size, and the driver sits on the adapter on the throat`, () => {
      for (const horn of HORN_OPTIONS) {
        const at = `${horn.id} ${layout}`;
        const g = buildStackScene({ ...base, horn, layout });
        const hornBox = boxOf(g, HORN_MESH_NAME);
        const cdBox = boxOf(g, CD_MESH_NAME);
        expect(hornBox, at).not.toBeNull();
        expect(cdBox, at).not.toBeNull();
        if (!hornBox || !cdBox) continue;
        const throatZ = hornBox.min.z;
        if (horn.profile) {
          const size = hornBox.getSize(new THREE.Vector3());
          expect(size.z, at).toBeCloseTo(horn.size.d, 2);
          expect(size.y, at).toBeCloseTo(horn.size.h, 1);
          // in two layouts the satellites stand two horns apart
          if (layout !== "satellite") expect(size.x, at).toBeCloseTo(horn.size.w, 1);
        }
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
          expect(Math.abs(cdBox.max.z - throatZ), `${at}: driver on the throat`).toBeLessThan(
            CONTACT_IN,
          );
        }
      }
    });
});
