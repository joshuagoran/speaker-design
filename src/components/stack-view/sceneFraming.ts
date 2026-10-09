import * as THREE from "three";

/** The 3D view's camera: its vertical field of view, degrees. */
export const VIEW_FOV_DEG = 32;

/** How far back the camera sits at zoom 1 for a scene's bounding box, at an aspect ratio (width / height). */
export type SceneFit = (bbox: THREE.Box3) => (aspect: number) => number;

const tanHalfFov = Math.tan((VIEW_FOV_DEG * Math.PI) / 360);

/**
 * The PA stack's fit: the box's height and, across, the diagonal of its footprint (so the fit holds through a full turn
 * rather than only head-on), each seen head-on, with a margin. Right for a tall stack seen from well back; a small box
 * seen from close up overflows it, its near corners enlarged by the perspective.
 */
export const fitFootprint: SceneFit = (bbox) => {
  const size = bbox.getSize(new THREE.Vector3());
  const halfH = size.y / 2;
  const halfW = Math.sqrt(size.x * size.x + size.z * size.z) / 2;
  return (aspect) => Math.max(halfH / tanHalfFov, halfW / (aspect * tanHalfFov)) * 1.18;
};

/** The sphere fit's margin round the scene's bounding sphere. */
const SPHERE_MARGIN = 1.04;

/**
 * A single box's fit: the bounding box's circumscribed sphere, kept inside the narrower of the two fields of view at
 * any turn and tilt. Exact under perspective, so a small box seen from close up fills the view without being cropped.
 */
export const fitSphere: SceneFit = (bbox) => {
  const r = bbox.getSize(new THREE.Vector3()).length() / 2;
  return (aspect) => {
    const half = Math.min(Math.atan(tanHalfFov), Math.atan(aspect * tanHalfFov));
    return (r / Math.sin(half)) * SPHERE_MARGIN;
  };
};
