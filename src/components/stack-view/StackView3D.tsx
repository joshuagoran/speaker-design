import { buildStackScene, type Props } from "./buildStackScene";
import { SceneView3D } from "./SceneView3D";

/** Rotatable 3D view of the PA stack. */
export function StackView3D(props: Props) {
  // the parent recreates these objects every render; the view rebuilds only when their JSON changes
  return <SceneView3D buildKey={JSON.stringify(props)} build={() => buildStackScene(props)} />;
}
