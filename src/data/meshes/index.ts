// The parts drawn from their CAD models in the 3D view, by catalog id (data/catalog); every other part is drawn from
// its listed sizes. Adding one: mesh its STEP file (build/handle-mesh.mjs for cabinet hardware, build/horn-mesh.mjs
// for a horn; the STEP files stay out of the repo), commit the generated mesh and list it here.
import type { CabinetPart, HardwareMesh } from "../../types";
import { H1105_MESH } from "./h1105";

export const HARDWARE_MESHES: Partial<Record<CabinetPart["id"], HardwareMesh>> = {
  H1105: H1105_MESH,
};
