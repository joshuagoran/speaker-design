import * as THREE from "three";
import { bracingRegions } from "../../lib/bracing";
import { BAFFLE_THICKNESS_IN } from "./buildCabinet";
import type { SceneContext } from "./sceneContext";
import type { BoxAxis, BoxBracing, BoxKeepOut, BoxRegion, Dims3 } from "../../types";

/** The name the brace and rib meshes carry, so a check can find them in the scene. */
export const BRACE_MESH_NAME = "brace";
/** The name the driver bodies drawn in the cutaway carry. */
export const DRIVER_BODY_MESH_NAME = "driverBody";
/** The name the vent's parts inside the sub carry (duct walls, shelves, fins, dividers, tubes). */
export const VENT_MESH_NAME = "vent";

/**
 * Inside coordinates to the scene's, for the cabinet `box` whose bottom is at `y` and center at `x`: x from the left
 * wall, y up from the bottom, z back from the baffle's rear face (the scene's -z).
 */
export function insideToScene(ctx: SceneContext, box: Dims3, y: number, x: number) {
  const T = ctx.wall;
  const iw = box.w - 2 * T,
    zFront = box.d / 2 - ctx.inset - BAFFLE_THICKNESS_IN;
  return (r: BoxRegion) => ({
    size: [r.x[1] - r.x[0], r.y[1] - r.y[0], r.z[1] - r.z[0]] as const,
    at: new THREE.Vector3(
      x - iw / 2 + (r.x[0] + r.x[1]) / 2,
      y + T + (r.y[0] + r.y[1]) / 2,
      zFront - (r.z[0] + r.z[1]) / 2,
    ),
  });
}

/**
 * The braces and ribs of a box whose inside (`inner`, in) has its left wall at `corner.x`, its floor at `corner.y` and
 * the baffle's rear face at `corner.z`, in `parent`'s coordinates.
 */
export function buildBracesAt(
  ctx: SceneContext,
  {
    bracing,
    inner,
    corner,
    parent,
  }: {
    bracing: Pick<BoxBracing, "windows" | "notch" | "ribs">;
    inner: Record<BoxAxis, number>;
    corner: { x: number; y: number; z: number };
    parent: THREE.Object3D;
  },
) {
  for (const r of bracingRegions(bracing, inner, ctx.wall)) {
    const size = [r.x[1] - r.x[0], r.y[1] - r.y[0], r.z[1] - r.z[0]] as const;
    if (size.some((s) => s <= 0)) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), ctx.materials.brace);
    m.name = BRACE_MESH_NAME;
    m.position.set(
      corner.x + (r.x[0] + r.x[1]) / 2,
      corner.y + (r.y[0] + r.y[1]) / 2,
      corner.z - (r.z[0] + r.z[1]) / 2,
    );
    parent.add(m);
  }
}

/**
 * The driver's body behind the baffle in the cutaway (the cone is drawn only on the closed cabinet): each box of its
 * keep-out (lib/pa/calc driverKeepOut) less the clearance, as a disc of the basket stepping in to the magnet.
 */
export function buildDriverBody(
  ctx: SceneContext,
  {
    keepOut,
    box,
    y,
    x = 0,
    parent,
    clearance,
  }: {
    keepOut: BoxKeepOut;
    box: Dims3;
    y: number;
    x?: number;
    parent: THREE.Object3D;
    /** the keep-out's margin round the driver, in */
    clearance: number;
  },
) {
  if (!ctx.cutaway) return;
  const place = insideToScene(ctx, box, y, x);
  const last = keepOut.driver.length - 1;
  keepOut.driver.forEach((d, i) => {
    const r = (d.x[1] - d.x[0]) / 2 - clearance,
      len = d.z[1] - d.z[0] - (i === last ? clearance : 0);
    if (r <= 0 || len <= 0) return;
    const { at } = place(d);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 32), ctx.materials.black);
    m.name = DRIVER_BODY_MESH_NAME;
    m.rotation.x = Math.PI / 2; // the cylinder's axis along the scene's z
    m.position.set(at.x, at.y, at.z + (i === last ? clearance / 2 : 0));
    parent.add(m);
  });
}
