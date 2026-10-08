import { buildHifiScene, type HifiSceneProps } from "./buildHifiScene";
import { SceneView3D } from "./SceneView3D";
import { fitSphere } from "./sceneFraming";

/** Rotatable 3D view of one Hi-fi speaker, framed so the single box fills the view. */
export function HifiView3D(props: HifiSceneProps) {
  // the parent recreates these objects every render; the view rebuilds only when their JSON changes
  return (
    <SceneView3D
      buildKey={JSON.stringify(props)}
      build={() => buildHifiScene(props)}
      fit={fitSphere}
    />
  );
}
