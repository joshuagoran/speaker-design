// Cabinet hardware for the PA boxes: recessed handles, the input dish and its Speakon jacks, and the horn's binding-post
// cup, all from Parts Express (US dollars, the price and month in `src`, the product page in `url`). Sizes in inches
// as the listing gives them (W × H), `upright` naming the one that runs up the panel as mounted,
// weights in lb (Parts Express's listed weight). A figure the listing doesn't give is null and named in `note`; the
// part is kept. The compiler checks the shape (CabinetPart in src/types.ts); lib/pa/hardware places them on the boxes.
import type { CabinetPart } from "../../types";

const PE = "https://www.parts-express.com/";
/** Millimetres to inches, for the parts dimensioned in mm. */
const MM = 1 / 25.4;

/** The recessed handles a box can take, two per box (one each side). */
export const HANDLES = [
  {
    id: "H1105",
    name: "Penn Elcom H1105",
    sku: "260-705",
    price: 8.71,
    src: "Parts Express 260-705, Oct 2026",
    url: `${PE}Penn-Elcom-H1105-Recessed-Steel-PA-Cabinet-Handle-260-705`,
    // sizes from Parts Express's dimensioned drawing for 260-705 (in mm, which govern):
    // https://www.parts-express.com/SSP%20Applications/PartsExpress@SuiteCentric/SCA%202019.1/img/260-705_ALT_1.jpg
    // cutout 175 × 115 mm, flange 220 × 162 mm, recess 63 mm, 5.5 mm screw holes. The listing's text (cutout
    // 6 3/4 × 4 1/4″) is smaller again. Penn Elcom's STEP model (build/assets) has a recess body 168 mm up but 122 mm
    // across, wider than the drawing's 115 mm cutout: the gap is open, so check the part before cutting.
    cutout: { w: 175 * MM, h: 115 * MM },
    flange: { w: 220 * MM, h: 162 * MM },
    // mounted tall: the 175 mm side runs up the panel and the grip bar across it (Parts Express's photos)
    upright: "w",
    // the drawing's 63 mm runs from the flange's face: the STEP model's 5 mm flange on the panel and its recess 58 mm
    // into it (depthIn is from the panel's face)
    depthIn: 58 * MM,
    lb: 1,
    screws: "5.5 mm holes in the flange (the drawing doesn't dimension their pattern)",
    note: "All steel, black. Parts Express's drawing gives the flange (220 × 162 mm), the cutout (175 × 115 mm), the depth (63 mm over the 5 mm flange, so the recess goes 58 mm into the panel) and 5.5 mm screw holes. Its cutout's 115 mm across is narrower than the 122 mm recess body in Penn Elcom's CAD model: check the part before cutting. Takes the H1105/BP backplate and the H1105G airtight gasket (not in the catalogue).",
  },
  {
    id: "30769",
    name: "Penn Elcom 30769",
    sku: "262-319",
    price: 10.39,
    src: "Parts Express 262-319, Oct 2026",
    url: `${PE}Penn-Elcom-30769-Compact-PA-Cabinet-Handle-6-x-7-262-319`,
    cutout: { w: 5.25, h: 4.25 },
    flange: { w: 6.75, h: 5.875 },
    // mounted wide: the 5 1/4″ side and the grip bar run across, 4 1/4″ up (Parts Express's drawing)
    upright: "h",
    depthIn: 2,
    lb: 0.369,
    screws: null,
    note: "Compact PA cabinet handle: ABS dish with a removable metal grip. Parts Express lists the outside size (6 3/4 × 5 7/8 × 2″) and the cutout (5 1/4 × 4 1/4″); the screw pattern is not listed.",
  },
] as const satisfies readonly CabinetPart[];

/**
 * The input dish on each box's back: a recessed steel dish punched for two Neutrik D-size connectors (Speakon NL4MP),
 * one in and one link. Its jacks are sold separately (INPUT_JACK).
 */
export const INPUT_PLATE = {
  id: "D0604K",
  name: "Penn Elcom D0604K",
  sku: "262-334",
  price: 4.79,
  src: "Parts Express 262-334, Oct 2026",
  url: `${PE}Penn-Elcom-D0604K-Dish-Two-Neutrik-D-Black-3-1-2-x-5-1-8-262-334`,
  cutout: { w: 4, h: 2.5 },
  flange: { w: 5.125, h: 3.5 },
  // the two connectors side by side: 4″ across, 2 1/2″ up (the listing's W × H)
  upright: "h",
  depthIn: 33 / 64,
  lb: 0.28,
  screws: null,
  note: "1.2 mm black powder-coated steel, punched for two Neutrik D-size or Speakon NL2/NL4 panel connectors (sold separately). Parts Express lists the outside size (3 1/2 × 5 1/8″) and the cutout (2 1/2″ H × 4″ W); the dish depth (33/64″) is Penn Elcom's. Screws not listed.",
} as const satisfies CabinetPart;

/** The Speakon jacks the input dish takes, two per box (in and link). */
export const INPUT_JACK = {
  id: "NL4MPXX",
  name: "Neutrik NL4MPXX",
  sku: "092-052",
  price: 2.94,
  src: "Parts Express 092-052, Oct 2026",
  url: `${PE}Neutrik-NL4MP-Speakon-4-Pole-Panel-Mount-092-052`,
  cutout: null,
  flange: null,
  upright: "h",
  depthIn: null,
  lb: 0.05,
  screws: null,
  note: "speakON 4-pole male panel connector, D-size flange; the cheapest NL4 chassis jack at Parts Express. Mounts in the dish's punched holes, so it takes no cutout of its own. Its depth behind the dish is not listed.",
} as const satisfies CabinetPart;

/**
 * The binding posts on top of the mid box for the horn, which sits on top: a recessed cup, so nothing stands proud of
 * the lid under the horn.
 */
export const HORN_POSTS = {
  id: "260-303",
  name: "Parts Express recessed binding-post cup",
  sku: "260-303",
  price: 3.98,
  src: "Parts Express 260-303, Oct 2026",
  url: `${PE}Recessed-Speaker-Terminal-Banana-5-Way-Binding-Posts-260-303`,
  cutout: { w: 2.875, h: 2.125 },
  flange: { w: 3.625, h: 3.125 },
  // on the lid: 2 7/8″ across, 2 1/8″ front to back
  upright: "h",
  depthIn: null,
  lb: 0.152,
  screws: null,
  note: "Recessed 5-way binding posts, angled, 10–12 AWG, with a gasket. Parts Express lists the outside size (3 1/8 × 3 5/8″) and the cutout (2 7/8 × 2 1/8″); the cup's depth and the screws are not listed, so its recess counts no volume.",
} as const satisfies CabinetPart;
