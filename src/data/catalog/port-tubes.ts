// Round port tubes for the PA sub: the stock pipe the round vents are cut from, as the optimizer's search tries them.
// Each entry is a tube count (`nt`) and the tube's inside diameter in inches (`dia`), smallest total area first; the
// search keeps the first that doesn't limit, so keep the order by area when adding one. The compiler checks the shape
// (PortTubeSet in src/types.ts). The rectangular vents are ply ducts, not stock parts: their sizes stay in the search.
import type { PortTubeSet } from "../../types";

export const PORT_TUBES: readonly PortTubeSet[] = [
  { nt: 1, dia: 3 },
  { nt: 1, dia: 4 },
  { nt: 2, dia: 3 },
  { nt: 2, dia: 3.5 },
  { nt: 1, dia: 5 },
  { nt: 2, dia: 4 },
  { nt: 3, dia: 4 },
  { nt: 2, dia: 5 },
  { nt: 4, dia: 4 },
  { nt: 2, dia: 6 },
  { nt: 3, dia: 5 },
  { nt: 4, dia: 5 },
  { nt: 3, dia: 6 },
  { nt: 4, dia: 6 },
];
