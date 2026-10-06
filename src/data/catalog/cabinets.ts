// Sub cabinet shapes for the PA planner. Dimensions are outer inches per sub size (dims[18], dims[15]).
// To add one, append to the table; the compiler checks the shape (Cabinet in src/types.ts): vents lists the vent
// kinds it offers (VentKind), vent an optional fixed slot {slotH, len} in.
import type { Cabinet } from "../../types";

export const CABINETS: readonly Cabinet[] = [
  {
    id: "column",
    name: "Upright column",
    vents: ["slots", "round1", "round2"],
    dims: { 18: { w: 21, h: 35, d: 21 }, 15: { w: 19, h: 28, d: 19 } },
    note: "Tallest, smallest footprint, stacks into itself. 174 L for an 18.",
  },
  {
    id: "compactColumn",
    name: "Compact column",
    vents: ["slots", "round1", "round2"],
    dims: { 18: { w: 21, h: 31, d: 21 }, 15: { w: 19, h: 26, d: 19 } },
    note: 'The column at the compact volume. 155 L net, 4" shorter and 6 lb lighter than the tall one for 0.9 dB at 35 Hz. Best duct hydraulic diameter of any option.',
  },
  {
    id: "blockTall",
    name: "Block, tall",
    vents: ["vslots"],
    dims: { 18: { w: 25, h: 28, d: 24 }, 15: { w: 22, h: 25, d: 21 } },
    note: "Full-height side ducts, no braces needed. 178 L for an 18.",
  },
  {
    id: "blockCompact",
    name: "Compact block",
    vents: ["vslots"],
    dims: { 18: { w: 26, h: 26, d: 21 }, 15: { w: 22, h: 22, d: 19 } },
    note: "Squarest of the vented blocks. 159 L net, Fb 34.3 Hz, 121.0 dB at 35 Hz. Two flared side ducts.",
  },
  {
    id: "wideCompact",
    name: "Compact wide",
    vents: ["vslots"],
    dims: { 18: { w: 32, h: 22, d: 20 }, 15: { w: 27, h: 19, d: 18 } },
    note: "Block-wide proportions at the compact volume. 159 L net, widest ducts of the compact set.",
  },
  {
    id: "blockWide",
    name: "Block, wide",
    vents: ["vslots"],
    dims: { 18: { w: 32, h: 22, d: 24 }, 15: { w: 28, h: 20, d: 21 } },
    note: "Low and wide, widest ducts of any version. 181 L for an 18.",
  },
  {
    id: "towerCol",
    name: "Tower column, 18 deep",
    vents: ["slots"],
    dims: { 18: { w: 21, h: 37, d: 18 }, 15: { w: 19, h: 31, d: 16 } },
    note: "For the Tower layout. 155 L net in an 18 in deep shell; the letterbox duct runs back along the floor and, once it is longer than the depth holds, turns up the back wall to get its length.",
  },
  {
    id: "es18app",
    name: "18Sound reflex (app note)",
    vents: ["slots"],
    dims: { 18: { w: 23.25, h: 35.5, d: 19.75 }, 15: { w: 23.25, h: 35.5, d: 19.75 } },
    note: "18Sound's published 905 H \u00d7 590 W \u00d7 500 D mm reflex box, 15 mm birch, ~230 L gross, 28 Hz HPF. Their vent isn't modeled; a bottom slot is loaded instead.",
  },
  // internal 22.5 x 28.5 x 20.875 in; external adds two 3/4" walls and the 3/4" baffle recess
  {
    id: "ciareRef",
    name: "Ciare 18.00SW reflex (vendor)",
    vents: ["slots"],
    vent: { slotH: 2, len: 16.625 },
    dims: { 18: { w: 24, h: 30, d: 23 }, 15: { w: 24, h: 30, d: 23 } },
    note: "Vendor-suggested box for the Ciare 18.00SW: 7.55 ft\u00b3 internal, 22 \u00d7 2 in slot, 16.625 in deep, tuned 29 Hz, F3 28.5 Hz.",
  },
  {
    id: "cube",
    name: "Cube",
    vents: ["round4"],
    dims: { 18: { w: 25, h: 25, d: 25 }, 15: { w: 23, h: 23, d: 19 } },
    note: "Square baffle, centered driver, corner ports. Reads the same in any rotation.",
  },
];
