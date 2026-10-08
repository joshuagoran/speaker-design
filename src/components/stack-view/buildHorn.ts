import * as THREE from "three";
import { HORN_LIFT_IN, ROUNDOVER_IN, hornAxisUp } from "./stackHeights";
import type { SceneContext } from "./sceneContext";
import { buildBracket, buildClampedBracket, takesBracket } from "./buildBracket";
import { buildPlyMount, plyMountFit } from "./buildPlyMount";
import { buildPlate, plateFit } from "./buildPlate";
import { HORN_MOUNT_PLY } from "../../constants/hornMount";
import { hornBody } from "./hornBody";
import { cdBodySteps } from "../../lib/data";
import type { BodyStep, CompressionDriver, Dims3, Horn, HornMountId } from "../../types";

/** The horn body's mesh. */
export const HORN_MESH_NAME = "horn";
/** The throat adapter's meshes. */
export const ADAPTER_MESH_NAME = "hornAdapter";
/** The compression driver's meshes. */
export const CD_MESH_NAME = "compressionDriver";
export { HORN_MESH_DRAWING } from "./hornBody";

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
 * under the driver) a mount holds it. With an adapter, the L-bracket bolted to the adapter's flange. Without one, the
 * driver on the throat flange and, in front of the flange, the plywood mount when `hornMount` is "ply" and the
 * driver's bolts fit it (`plyMountFit`), else the aluminum plate when they fit that (`plateFit`), else the L-bracket
 * clamped between the throat and the driver. `mount` is the box under the horn: its width draws the full-width
 * concept, and a mount's foot or base stays on its lid.
 */
function addThroatParts(
  ctx: SceneContext,
  horn: Horn,
  cd: Pick<CompressionDriver, "body" | "exit">,
  at: HornAxis,
  lidY: number | null,
  mount: Pick<Dims3, "w" | "d">,
  hornMount: HornMountId | undefined,
  backRoundover: number,
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
  } else if (lidY !== null) {
    // the lid's flat top ends at the roundover on its back edge (boxes are centered on z = 0)
    const lidBackZ = -mount.d / 2 + backRoundover;
    const ply = hornMount === HORN_MOUNT_PLY ? plyMountFit(horn, cd, mount.w) : null;
    const plate = ply ? null : plateFit(horn, cd, mount.w);
    if (ply) buildPlyMount(ctx, ply, { cd, at, lidY, lidBackZ });
    else if (plate) buildPlate(ctx, plate, { at, lidY, lidBackZ });
    else cdFront = buildClampedBracket(ctx, cd, at, lidY);
  }
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
    hornMount,
    backRoundover = ROUNDOVER_IN,
  }: {
    horn: Horn;
    cd: Pick<CompressionDriver, "body" | "exit">;
    y: number;
    xs?: number[];
    mount: Pick<Dims3, "w" | "d">;
    tower?: { cy: number; width: number; sectionH: number };
    /** what holds a driver bolted straight to the horn on the lid; absent: the aluminum plate */
    hornMount?: HornMountId;
    /** the roundover on the lid's back edge, where its flat top ends (default: the PA frame's `ROUNDOVER_IN`) */
    backRoundover?: number;
  },
): { top: number; axes: HornAxis[] } {
  const { hornShell } = ctx.materials;
  const hz = horn.size;
  // every horn's mouth plane on the box's front plane (the frame front, `mount.d / 2`), the throat `hz.d` behind it
  const throatZ = mount.d / 2 - hz.d;
  const cy = tower ? tower.cy : hornY + HORN_LIFT_IN + hornAxisUp(horn);
  const axes = xs.map((x) => ({ x, y: cy, throatZ }));
  for (const at of axes) {
    const { body } = hornBody(horn, horn.rect ? (tower ? tower.width : mount.w) : hz.w, hornShell);
    body.position.set(at.x, at.y, at.throatZ);
    body.name = HORN_MESH_NAME;
    ctx.group.add(body);
    addThroatParts(ctx, horn, cd, at, tower ? null : hornY, mount, hornMount, backRoundover);
  }
  return { top: hornY + (tower ? tower.sectionH : HORN_LIFT_IN + hz.h), axes };
}
