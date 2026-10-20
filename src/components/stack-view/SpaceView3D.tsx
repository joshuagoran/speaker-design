import { useThemeName } from "../../hooks/useTheme";
import { buildSpaceScene, spaceSceneKey, type SpaceSceneProps } from "./buildSpaceScene";
import { SceneView3D, type SceneControls, type SceneStart } from "./SceneView3D";

/** The Space's camera: it zooms in close to a box and out past the room, and tilts to look down on it. */
const SPACE_CONTROLS: SceneControls = { zoom: [0.15, 2], tiltMax: 1.45 };
/** Where it starts: from behind the audience, looking over the room toward the front wall. */
const SPACE_START: Partial<SceneStart> = { rotY: 0.5, rotX: 0.6 };

/** Rotatable 3D view of a Space (the Space page's): the room, its boxes, the listener and the beams. View only. */
export function SpaceView3D(props: Omit<SpaceSceneProps, "theme">) {
  // the walls and marks follow the theme
  const scene = { ...props, theme: useThemeName() };
  // the parent recreates these objects every render; the view rebuilds only when what the scene reads changes
  return (
    <SceneView3D
      buildKey={spaceSceneKey(scene)}
      build={() => buildSpaceScene(scene)}
      stage={false}
      controls={SPACE_CONTROLS}
      start={SPACE_START}
    />
  );
}
