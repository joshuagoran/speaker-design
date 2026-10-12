import { buildSpeakerScene, speakerSceneKey, type SpeakerSceneProps } from "./buildSpeakerScene";
import { SceneView3D, type SceneStart } from "./SceneView3D";
import { fitSphere } from "./sceneFraming";

/** Rotatable 3D view of any speaker spec (the Speaker page's), framed so the speaker fills the view. */
export function SpeakerView3D({
  start,
  ...props
}: SpeakerSceneProps & {
  /** where the camera starts (default: the view's own) */
  start?: Partial<SceneStart>;
}) {
  // the parent recreates these objects every render; the view rebuilds only when what the scene reads changes
  return (
    <SceneView3D
      buildKey={speakerSceneKey(props)}
      build={() => buildSpeakerScene(props)}
      fit={fitSphere}
      start={start}
    />
  );
}
