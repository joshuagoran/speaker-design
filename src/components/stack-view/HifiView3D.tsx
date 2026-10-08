import { buildHifiScene, type HifiSceneProps } from "./buildHifiScene";
import { SceneView3D } from "./SceneView3D";
import { fitSphere } from "./sceneFraming";
import type { SceneStart } from "./SceneView3D";

/** Rotatable 3D view of one Hi-fi speaker, framed so the single box fills the view. */
export function HifiView3D({
  start,
  ...props
}: HifiSceneProps & {
  /** where the camera starts (default: the view's own) */
  start?: Partial<SceneStart>;
}) {
  // the parent recreates these objects every render; the view rebuilds only when their JSON changes
  return (
    <SceneView3D
      buildKey={JSON.stringify(props)}
      build={() => buildHifiScene(props)}
      fit={fitSphere}
      start={start}
    />
  );
}
