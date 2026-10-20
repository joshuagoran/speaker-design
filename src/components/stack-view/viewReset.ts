import { createContext } from "react";

/**
 * How many times the 3D view's card asked its view to put the camera back where it started (Viewer3DCard's reset
 * button): each new count resets the camera in SceneView3D; the design stays as it is.
 */
export const ViewResetContext = createContext(0);
