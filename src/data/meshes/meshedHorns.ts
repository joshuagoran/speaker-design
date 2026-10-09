// The horns drawn from a CAD mesh (HORN_MESHES in ./index), by id, without loading the meshes: what code outside the
// 3D view reads (the tower's baffle cutout follows a meshed horn's mouth), so the workers don't carry the meshes. A
// meshed horn's catalog `size` is its mesh's, so its bounds need no mesh either. tests/tower.test.ts checks the two
// lists match.
import type { Horn } from "../../types";
import { DIY_OS90X50, DIY_OS90X70, DIY_ROSSE110X50 } from "../catalog/horns";

export const MESHED_HORN_IDS: ReadonlySet<Horn["id"]> = new Set([
  DIY_OS90X50.id,
  DIY_ROSSE110X50.id,
  DIY_OS90X70.id,
]);
