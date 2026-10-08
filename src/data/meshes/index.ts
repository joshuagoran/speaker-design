// The parts drawn from their CAD models in the 3D view, by catalog id (data/catalog); every other part is drawn from
// its listed sizes. Adding one: mesh its STEP file (build/handle-mesh.mjs for cabinet hardware, build/horn-mesh.mjs
// for a horn; the STEP files stay out of the repo), commit the generated mesh and list it here.
import type { CabinetPart, HardwareMesh, Horn, PartMesh } from "../../types";
import { DIY_OS90X50, DIY_OS90X70, DIY_ROSSE110X50 } from "../catalog/horns";
import { DIY_OS90X50_MESH } from "./diy_os90x50";
import { DIY_OS90X70_MESH } from "./diy_os90x70";
import { DIY_ROSSE110X50_MESH } from "./diy_rosse110x50";
import { H1105_MESH } from "./h1105";

export const HARDWARE_MESHES: Partial<Record<CabinetPart["id"], HardwareMesh>> = {
  H1105: H1105_MESH,
};

/**
 * The horns drawn from their CAD models, on build/horn-mesh.mjs' axes: x across the mouth, y up it, z along the axis
 * from the throat flange's back face (z = 0, where the driver bolts on) to the mouth. The mesh is drawn at its own
 * size, which the horn's catalog `size` gives.
 */
export const HORN_MESHES: Partial<Record<Horn["id"], PartMesh>> = {
  [DIY_OS90X50.id]: DIY_OS90X50_MESH,
  [DIY_ROSSE110X50.id]: DIY_ROSSE110X50_MESH,
  [DIY_OS90X70.id]: DIY_OS90X70_MESH,
};
