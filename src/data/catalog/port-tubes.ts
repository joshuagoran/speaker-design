// Round port tubes for the PA sub: the stock pipe the round vents are cut from, as the optimizer's search tries them.
// Each entry is a tube count (`nt`) and the tube's inside diameter in inches (`dia`), smallest total area first; the
// search keeps the first that doesn't limit, so keep the order by area when adding one. The compiler checks the shape
// (PortTubeSet in src/types.ts). The rectangular vents are ply ducts, not stock parts: their sizes stay in the search.
// Every size here has its pipe in PORT_PIPES below; the planner's tube sliders run over what this table holds.
import type { PortElbow, PortPipe, PortTubeSet } from "../../types";

export const PORT_TUBES: readonly PortTubeSet[] = [
  { nt: 1, dia: 3 },
  { nt: 1, dia: 4 },
  { nt: 2, dia: 3 },
  { nt: 2, dia: 3.5 },
  { nt: 1, dia: 5 },
  { nt: 2, dia: 4 },
  { nt: 1, dia: 6 },
  { nt: 3, dia: 4 },
  { nt: 2, dia: 5 },
  { nt: 4, dia: 4 },
  { nt: 1, dia: 8 },
  { nt: 2, dia: 6 },
  { nt: 3, dia: 5 },
  { nt: 4, dia: 5 },
  { nt: 1, dia: 10 },
  { nt: 3, dia: 6 },
  { nt: 2, dia: 8 },
  { nt: 4, dia: 6 },
  { nt: 2, dia: 10 },
];

// Schedule 40 PVC (DWV foam core has the same bore): the inside diameter is Spears' average for Sch 40
// (parts.spearsmfg.com/sourcebook/SCH40TECH_40WHTPIPE-1_T_PVC40_T.pdf). Prices seen Oct 2026.
const PFO = "https://www.pvcfittingsonline.com/products/";

/** The stock pipe for each tube size: its bore and outside diameter, and a stick's length and price. */
export const PORT_PIPES: readonly PortPipe[] = [
  {
    dia: 3,
    idIn: 3.042,
    odIn: 3.5,
    stickFt: 5,
    price: 37.66,
    src: `${PFO}4004-030ab-3-schedule-40-pvc-pipe-5-ft-section`,
    note: "Sch 40 PVC, 5 ft section. 10 ft DWV foam core is about $22 at Home Depot.",
  },
  {
    dia: 3.5,
    idIn: 3.521,
    odIn: 4,
    stickFt: 10,
    price: 49.99,
    src: "https://www.pvcpipesupplies.com/3-1-2-x-10-schedule-40-pvc-pipe-h0400350pw1000.html",
    note: "Sch 40 PVC (GF Harvel), 10 ft. A specialty size: no DWV version, and no 90° elbow from a US vendor.",
  },
  {
    dia: 4,
    idIn: 3.998,
    odIn: 4.5,
    stickFt: 5,
    price: 50.55,
    src: `${PFO}4004-040ab-4-schedule-40-pvc-pipe-5-ft-section`,
    note: "Sch 40 PVC, 5 ft section. 10 ft DWV foam core is about $43 at Home Depot.",
  },
  {
    dia: 5,
    idIn: 5.016,
    odIn: 5.563,
    stickFt: 5,
    price: 120.17,
    src: `${PFO}5-schedule-40-pvc-pipe-4004-050ab-5ft`,
    note: "Sch 40 PVC, 5 ft section (backordered when seen). No DWV pipe in 5″.",
  },
  {
    dia: 6,
    idIn: 6.031,
    odIn: 6.625,
    stickFt: 5,
    price: 95.31,
    src: `${PFO}4004-060ab-6-schedule-40-pvc-pipe-5-ft-section`,
    note: "Sch 40 PVC, 5 ft section. 10 ft DWV foam core is listed at Home Depot for less.",
  },
  {
    dia: 8,
    idIn: 7.942,
    odIn: 8.625,
    stickFt: 5,
    price: 148.8,
    src: `${PFO}4004-080ab-8-schedule-40-pvc-pipe-5-ft-section`,
    note: "Sch 40 PVC, 5 ft section.",
  },
  {
    dia: 10,
    idIn: 9.976,
    odIn: 10.75,
    stickFt: 5,
    price: 203,
    src: `${PFO}4004-100ab-10-schedule-40-pvc-pipe-5-ft-section`,
    note: "Sch 40 PVC, 5 ft section.",
  },
];

/**
 * The 90° elbow for each tube size (Spears Sch 40 socket 90°, part 406-0xx). The fold rule (lib/tubeFold) takes a leg
 * past an elbow as at least a diameter, about a short-radius fitting's center-to-socket-face length.
 */
export const PORT_ELBOWS: readonly PortElbow[] = [
  {
    dia: 3,
    price: 8.59,
    src: `${PFO}3-sch-40-pvc-90-elbow-soc-406-030`,
    note: "Sch 40 90°, 406-030.",
  },
  {
    dia: 3.5,
    price: null,
    src: null,
    note: "No 3-1/2″ 90° elbow from a US vendor (Spears lists none).",
  },
  {
    dia: 4,
    price: 15.37,
    src: `${PFO}406-040-4-schedule-40-pvc-90-ell`,
    note: "Sch 40 90°, 406-040.",
  },
  {
    dia: 5,
    price: 36.75,
    src: `${PFO}5-sch-40-pvc-90-elbow-soc-406-050`,
    note: "Sch 40 90°, 406-050.",
  },
  {
    dia: 6,
    price: 49.12,
    src: `${PFO}406-060-6-schedule-40-pvc-90-ell`,
    note: "Sch 40 90°, 406-060.",
  },
  {
    dia: 8,
    price: 125.99,
    src: `${PFO}406-080-8-schedule-40-pvc-90-ell`,
    note: "Sch 40 90°, 406-080.",
  },
  {
    dia: 10,
    price: 604.05,
    src: `${PFO}406-100-10-schedule-40-pvc-90-ell`,
    note: "Sch 40 90°, 406-100. A DWV 1/4 bend costs less where a plumbing supplier stocks one.",
  },
];
