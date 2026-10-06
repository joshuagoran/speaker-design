// The parts drawn from their makers' CAD models in the 3D view, by catalog id (data/catalog); every other part is
// drawn from its listed sizes. Adding one: put its STEP file in build/assets, mesh it (build/handle-mesh.mjs) and list
// the generated mesh here.
import type { CabinetPart, HardwareMesh } from "../../types";
import { H1105_MESH } from "./h1105";

export const HARDWARE_MESHES: Partial<Record<CabinetPart["id"], HardwareMesh>> = {
  H1105: H1105_MESH,
};
