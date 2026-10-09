// The horn mount setting at its default (the aluminum plate): the 3D scenes it draws, pinned. Each case's hash hashes
// every mesh's name, geometry, place and color. The scenes the plate doesn't touch (a horn on its throat adapter's
// L-bracket, and a horn and driver the plate can't hold, which keep the clamped L-bracket) keep the hashes made on main
// before the horn mount (9a26fa3); the scenes that draw the plate were made when the plate replaced the clamped
// L-bracket. A deliberate change to the scene rewrites them:
//   SCENE_HASH_OUT=path vp test --run tests/horn-mount-default.test.ts   (writes the current hashes as JSON)
import { expect, test } from "vite-plus/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import { SCENE_CASE_NAMES, sceneCases } from "./scene-cases";
import type { PaLayout } from "../src/types";

const base = (() => {
  const c = sceneCases.find((x) => x.name === SCENE_CASE_NAMES.defaultPa);
  if (!c) throw new Error("no default scene case");
  return c.props;
})();
const hornOf = (id: string) => {
  const horn = HORN_OPTIONS.find((h) => h.id === id);
  if (!horn) throw new Error(`no horn ${id}`);
  return horn;
};

/**
 * Representative scenes: the default PA (a horn on its adapter's bracket), horns the driver bolts straight to (the
 * plate), and a horn and driver the plate can't hold (the clamped L-bracket).
 */
const CASES: { name: string; props: Props }[] = [
  ...(["stack", "pole", "satellite", "tower"] as const satisfies readonly PaLayout[]).map(
    (layout) => ({
      name: `default horn, ${layout}`,
      props: { ...base, layout },
    }),
  ),
  ...(
    [
      ["diy_rosse110x50", "stack"],
      ["diy_os90x50", "satellite"],
      ["me45", "pole"],
      ["athRect", "stack"],
      ["iwata600", "stack"],
      ["hf950", "stack"],
    ] as const
  ).map(([id, layout]) => ({
    name: `${id}, ${layout}`,
    props: { ...base, horn: hornOf(id), layout },
  })),
  (() => {
    const cd = CD_OPTIONS.find((c) => c.id === "de360");
    if (!cd) throw new Error("no DE360");
    return { name: "st260 + de360, stack", props: { ...base, horn: hornOf("st260"), cd } };
  })(),
];

/** A hash of every mesh in the scene, in order: its name, geometry type and vertices, world matrix and color. */
function sceneHash(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const hash = createHash("sha256");
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute("position");
    const color =
      o.material instanceof THREE.MeshStandardMaterial ? o.material.color.getHex() : null;
    hash.update(
      JSON.stringify([
        o.name,
        o.geometry.type,
        Array.from({ length: pos.array.length }, (_, i) => pos.array[i].toFixed(4)),
        o.matrixWorld.elements.map((v) => v.toFixed(5)),
        color,
      ]),
    );
  });
  return hash.digest("hex").slice(0, 16);
}

const EXPECTED: Record<string, string> = {
  "default horn, stack": "4b5a6e5ea6e591d0", // main
  "default horn, pole": "44cef27cc010e72f", // main
  "default horn, satellite": "89eeb9bb141c260f", // main
  "default horn, tower": "f4d156923f4a41a0", // main
  "diy_rosse110x50, stack": "87cfcd8f08604366", // the plate
  "diy_os90x50, satellite": "69cff82a581b3c8e", // the plate
  "me45, pole": "6b5a0f9f0544d064", // the plate
  "athRect, stack": "697ebebfd7a333bf", // the plate
  "iwata600, stack": "de09d0ec1c68b10c", // the plate
  "hf950, stack": "01b4f6fd3232a6e4", // the plate
  "st260 + de360, stack": "8d3b0ae33988dd70", // main
};

test("with the horn mount at its default, every scene is the pinned one", () => {
  const now = Object.fromEntries(CASES.map((c) => [c.name, sceneHash(buildStackScene(c.props))]));
  const out = process.env.SCENE_HASH_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify(now, null, 2));
  // and the same with the setting saying so
  for (const c of CASES)
    expect(sceneHash(buildStackScene({ ...c.props, hornMount: "plate" })), c.name).toBe(
      now[c.name],
    );
  expect(now).toEqual(EXPECTED);
});
