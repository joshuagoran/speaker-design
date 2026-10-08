import * as THREE from "three";
import { MM_IN, partMeshGeometry, rectangularHornGeometry, type PartMeshDrawing } from "./geometry";
import { HORN_MESHES } from "../../data/meshes";
import { HORN_LIFT_IN } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import { buildBracket, buildClampedBracket, takesBracket } from "./buildBracket";
import { cdBodySteps } from "../../lib/data";
import type { BodyStep, CompressionDriver, Dims3, Horn } from "../../types";

/** The horn body's mesh. */
export const HORN_MESH_NAME = "horn";
/** The throat adapter's meshes. */
export const ADAPTER_MESH_NAME = "hornAdapter";
/** The compression driver's meshes. */
export const CD_MESH_NAME = "compressionDriver";
/** A horn's CAD mesh: shaded smooth, and placed by its origin, which build/horn-mesh.mjs puts on the driver's axis. */
export const HORN_MESH_DRAWING: PartMeshDrawing = { shading: "smooth", place: "origin" };

/**
 * Turned steps along the z axis, front face at `z0`, drawn backward (toward −z) and centered on (x, y). Returns the z
 * of the last step's back face.
 */
function addSteps(
  ctx: SceneContext,
  steps: readonly BodyStep[],
  at: { x: number; y: number; z0: number },
  material: THREE.Material,
  name: string,
): number {
  let z = at.z0;
  for (const [dia, len] of steps) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, len, 48), material);
    m.rotation.x = Math.PI / 2;
    m.position.set(at.x, at.y, z - len / 2);
    m.name = name;
    ctx.group.add(m);
    z -= len;
  }
  return z;
}

/** Where a horn and the parts behind it sit: the axis (x, y) and the z of the horn body's throat. */
export interface HornAxis {
  x: number;
  y: number;
  throatZ: number;
}

/**
 * The horn's throat adapter, when it has one, and the compression driver behind it: the adapter's front face on the
 * throat, the driver's front face on the adapter's back face (or on the throat). On a lid (`lidY`; the tower has none
 * under the driver) the L-bracket holds it: from the adapter's flange, or, without an adapter, clamped between
 * the throat and the driver.
 */
function addThroatParts(
  ctx: SceneContext,
  horn: Pick<Horn, "adapter">,
  cd: Pick<CompressionDriver, "body" | "exit">,
  at: HornAxis,
  lidY: number | null,
) {
  let cdFront = at.throatZ;
  if (horn.adapter) {
    cdFront = addSteps(
      ctx,
      horn.adapter.steps,
      { x: at.x, y: at.y, z0: at.throatZ },
      ctx.materials.adapter,
      ADAPTER_MESH_NAME,
    );
    if (lidY !== null && takesBracket(horn.adapter)) buildBracket(ctx, horn.adapter, at, lidY);
  } else if (lidY !== null) cdFront = buildClampedBracket(ctx, cd, at, lidY);
  addSteps(
    ctx,
    cdBodySteps(cd.body),
    { x: at.x, y: at.y, z0: cdFront },
    ctx.materials.black,
    CD_MESH_NAME,
  );
}

/**
 * The horn, its throat adapter and its compression driver, one set per x. A horn with a CAD mesh (data/meshes) is that
 * mesh at its own size, its flange's back face on the throat plane; a horn with a profile is that profile turned
 * and stretched to its mouth and depth; the full-width concept (`rect`) is a rectangular flare as wide as the box; any
 * other horn is a rectangular flare at its own mouth and depth. `y` is the base of the horn (the top of the box below)
 * and `mount` the footprint it sits on (the mid box, or the tower's shell); the mouth plane is on its front plane. In
 * the tower the horn sits in the shared shell instead: `tower` gives its center height, the mouth width and the section
 * height. Returns the y of the horn envelope's top and each horn's axis.
 */
export function buildHorn(
  ctx: SceneContext,
  {
    horn,
    cd,
    y: hornY,
    xs = [0],
    mount,
    tower,
  }: {
    horn: Horn;
    cd: Pick<CompressionDriver, "body" | "exit">;
    y: number;
    xs?: number[];
    mount: Pick<Dims3, "w" | "d">;
    tower?: { cy: number; width: number; sectionH: number };
  },
): { top: number; axes: HornAxis[] } {
  const { hornShell } = ctx.materials;
  const hz = horn.size;
  // every horn's mouth plane on the box's front plane (the frame front, `mount.d / 2`), the throat `hz.d` behind it
  const throatZ = mount.d / 2 - hz.d;
  const model = HORN_MESHES[horn.id];
  // the axis above the horn's bottom: half its height, or for a mesh how far its origin is above its lowest point
  const axisUp = model ? -model.min[1] * MM_IN : hz.h / 2;
  const cy = tower ? tower.cy : hornY + HORN_LIFT_IN + axisUp;
  const axes = xs.map((x) => ({ x, y: cy, throatZ }));
  for (const at of axes) {
    let body: THREE.Mesh;
    if (model) {
      // its own mesh at its own size, its origin on the axis: the flange's back face on the throat plane, the mouth
      // toward +z
      body = new THREE.Mesh(partMeshGeometry(model, HORN_MESH_DRAWING), hornShell);
    } else if (horn.profile) {
      // the profile stretched to the mouth's width and height and the body's depth
      const maxR = Math.max(...horn.profile.map(([r]) => r));
      const maxX = Math.max(...horn.profile.map(([, x]) => x));
      body = new THREE.Mesh(
        new THREE.LatheGeometry(
          horn.profile.map(([r, x]) => new THREE.Vector2(r, x)),
          96,
        ),
        hornShell,
      );
      body.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      body.scale.set(hz.w / 2 / maxR, hz.d / maxX, hz.h / 2 / maxR); // local x = width, y = depth, z = height
    } else {
      const mouthW = horn.rect ? (tower ? tower.width : mount.w) : hz.w;
      body = new THREE.Mesh(rectangularHornGeometry(mouthW, hz.h, hz.d, horn.exit / 2), hornShell);
    }
    body.position.set(at.x, at.y, at.throatZ);
    body.name = HORN_MESH_NAME;
    ctx.group.add(body);
    addThroatParts(ctx, horn, cd, at, tower ? null : hornY);
  }
  return { top: hornY + (tower ? tower.sectionH : HORN_LIFT_IN + hz.h), axes };
}
