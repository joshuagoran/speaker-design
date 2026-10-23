import * as THREE from "three";
import { createContext } from "react";

/** Whether the 3D view's card asks its view for Outlines only (Viewer3DCard's settings menu). */
export const ViewOutlinesContext = createContext(false);

/**
 * The angle two faces of a part make before Outlines only draws a line along their edge, degrees: a curved horn or a
 * cone shows its outline and its corners, not each facet.
 */
const OUTLINE_EDGE_DEG = 20;

/** The opacity of a see-through part's lines (the cutaway's shell, a room's walls), so the parts behind them read. */
const SEE_THROUGH_LINE_OPACITY = 0.3;

/**
 * Turns a built scene into Outlines only: each part's faces stop drawing color, and its edges draw as lines in `color`.
 * An opaque part's faces still write depth, so they hide the lines behind them and only the front edges show. A
 * see-through part (all its materials transparent) draws fainter lines and hides nothing. A face that shows data (a
 * texture: the Space's coverage floor) and a part's hole mask (no color already) stay as they are. The edges are
 * children of their parts, so the view frees them with the scene.
 */
export function outlineScene(group: THREE.Object3D, color: THREE.ColorRepresentation): void {
  const solid = new THREE.LineBasicMaterial({ color });
  const faint = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: SEE_THROUGH_LINE_OPACITY,
    depthWrite: false,
  });
  // pushed back in depth, so a part's own edges, on its faces, are not hidden by them
  const depthOnly = new THREE.MeshBasicMaterial({
    colorWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  const replaced = new Set<THREE.Material>();
  const kept = new Set<THREE.Material>();
  for (const mesh of meshes) {
    const materials: THREE.Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const showsData = materials.some((m) => m instanceof THREE.MeshBasicMaterial && m.map);
    if (showsData || materials.some((m) => !m.colorWrite)) {
      materials.forEach((m) => kept.add(m));
      continue;
    }
    const seeThrough = materials.every((m) => m.transparent);
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, OUTLINE_EDGE_DEG),
        seeThrough ? faint : solid,
      ),
    );
    materials.forEach((m) => replaced.add(m));
    mesh.material = seeThrough ? hidden : depthOnly;
  }
  // the parts' own materials, no longer drawn (a material a kept face still uses stays)
  replaced.forEach((m) => {
    if (!kept.has(m)) m.dispose();
  });
}
