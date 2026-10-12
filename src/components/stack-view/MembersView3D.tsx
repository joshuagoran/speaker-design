import { buildMembersScene, membersSceneKey, type MembersSceneProps } from "./buildMembersScene";
import { SceneView3D } from "./SceneView3D";

/** Rotatable 3D view of a stack's members (the Stack page's), framed as the PA stack's view. */
export function MembersView3D(props: MembersSceneProps) {
  // the parent recreates these objects every render; the view rebuilds only when what the scene reads changes
  return <SceneView3D buildKey={membersSceneKey(props)} build={() => buildMembersScene(props)} />;
}
