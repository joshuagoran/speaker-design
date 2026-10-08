// The horn mount setting off (the L-bracket, the default): the 3D scene is what it was before the setting existed.
// Each case's hash below was generated on main before the plywood mount (9a26fa3) by hashing every mesh's name,
// geometry, place and color; the setting must leave them all alone. A deliberate change to the scene rewrites them:
//   SCENE_HASH_OUT=path vp test --run tests/horn-mount-off.test.ts   (writes the current hashes as JSON)
import { expect, test } from "vite-plus/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { buildStackScene, type Props } from "../src/components/stack-view/buildStackScene";
import { HORN_OPTIONS } from "../src/lib/data";
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

/** Representative scenes: the default PA (a horn on its adapter's bracket), and horns clamped in the L-bracket. */
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
  "default horn, stack": "4b5a6e5ea6e591d0",
  "default horn, pole": "44cef27cc010e72f",
  "default horn, satellite": "89eeb9bb141c260f",
  "default horn, tower": "f4d156923f4a41a0",
  "diy_rosse110x50, stack": "d01f1e760a46fce4",
  "diy_os90x50, satellite": "7a4425420701e6f2",
  "me45, pole": "5a32b13c27a2428c",
  "athRect, stack": "6bebcdbfe2157fe7",
  "iwata600, stack": "466b8d4c0a1df8f2",
  "hf950, stack": "3f261b57e2494ac6",
};

test("with the horn mount off, every scene is the one main drew before the setting", () => {
  const now = Object.fromEntries(CASES.map((c) => [c.name, sceneHash(buildStackScene(c.props))]));
  const out = process.env.SCENE_HASH_OUT;
  if (out) fs.writeFileSync(out, JSON.stringify(now, null, 2));
  // and the same with the setting saying so
  for (const c of CASES)
    expect(sceneHash(buildStackScene({ ...c.props, hornMount: "bracket" })), c.name).toBe(
      now[c.name],
    );
  expect(now).toEqual(EXPECTED);
});
