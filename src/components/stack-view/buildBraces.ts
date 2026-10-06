import * as THREE from "three";
import { RIB_DEPTH_IN, WINDOW_RAIL_IN } from "../../lib/bracing";
import type { SceneContext } from "./sceneContext";
import type { BoxAxis, BoxBracing, BracePanelId, Dims3 } from "../../types";

const BAFFLE_THICKNESS_IN = 0.75;
type Range = readonly [number, number];
type Ranges = Record<BoxAxis, Range>;
/** A slab's extent on each axis, from the axes given once each. */
const ranges = (on: [BoxAxis, Range][]): Ranges => {
  const r: Ranges = { x: [0, 0], y: [0, 0], z: [0, 0] };
  for (const [a, v] of on) r[a] = v;
  return r;
};

// the wall each ribbed panel is, as a range on its normal axis: ribs stand RIB_DEPTH_IN off it
const PANEL_NORMAL: Record<Exclude<BracePanelId, "baffle">, { axis: BoxAxis; far: boolean }> = {
  sideL: { axis: "x", far: false },
  sideR: { axis: "x", far: true },
  top: { axis: "y", far: true },
  bottom: { axis: "y", far: false },
  back: { axis: "z", far: true },
};

/**
 * A box's window braces and ribs (lib/bracing) inside the cabinet `box` whose bottom is at `y` and centre at `x`, in the
 * finish's inner shade like the duct parts, so they show in the cutaway. The bracing's axes run from the box's inside
 * corner: x from the left wall, y up from the bottom, z back from the baffle's rear face.
 */
export function buildBraces(
  ctx: SceneContext,
  {
    bracing,
    box,
    y,
    x = 0,
    parent,
  }: { bracing: BoxBracing; box: Dims3; y: number; x?: number; parent: THREE.Object3D },
) {
  const T = ctx.wall;
  const inner = {
    x: box.w - 2 * T,
    y: box.h - 2 * T,
    z: box.d - ctx.inset - BAFFLE_THICKNESS_IN - T,
  };
  // inside coordinates to the scene's: x across from the left wall, y up, z back from the baffle (the scene's -z)
  const zFront = box.d / 2 - ctx.inset - BAFFLE_THICKNESS_IN;
  const slab = (r: Ranges) => {
    const sx = r.x[1] - r.x[0],
      sy = r.y[1] - r.y[0],
      sz = r.z[1] - r.z[0];
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), ctx.materials.inner);
    m.position.set(
      x - inner.x / 2 + (r.x[0] + r.x[1]) / 2,
      y + T + (r.y[0] + r.y[1]) / 2,
      zFront - (r.z[0] + r.z[1]) / 2,
    );
    parent.add(m);
  };
  const AXES: readonly BoxAxis[] = ["x", "y", "z"];
  for (const axis of AXES) {
    const [P, Q] = AXES.filter((a) => a !== axis);
    const R = WINDOW_RAIL_IN,
      lp = inner[P],
      lq = inner[Q];
    for (const at of bracing.windows[axis]) {
      const across: Range = [at - T / 2, at + T / 2];
      const rail = (p: Range, q: Range) =>
        slab(
          ranges([
            [axis, across],
            [P, p],
            [Q, q],
          ]),
        );
      rail([0, lp], [0, R]);
      rail([0, lp], [lq - R, lq]);
      rail([0, R], [R, lq - R]);
      rail([lp - R, lp], [R, lq - R]);
    }
  }
  for (const r of bracing.ribs) {
    if (r.panel === "baffle") continue; // the rule never ribs the baffle
    const n = PANEL_NORMAL[r.panel];
    const run = AXES.find((a) => a !== n.axis && a !== r.across) ?? r.across;
    const off: Range = n.far ? [inner[n.axis] - RIB_DEPTH_IN, inner[n.axis]] : [0, RIB_DEPTH_IN];
    for (const at of r.at)
      slab(
        ranges([
          [n.axis, off],
          [r.across, [at - T / 2, at + T / 2]],
          [run, [0, r.len]],
        ]),
      );
  }
}
