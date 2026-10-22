// The parts bought for a speaker, as the Cutlist page's purchased parts table and its CSV name them
// (lib/speaker/speakerBuild speakerPurchasedParts).
import type { PortPipe } from "../types";
import { formatInches } from "../lib/format";

/** Each bought part's kind, by id. */
export const PURCHASED_PART = {
  driver: "driver",
  horn: "horn",
  radiator: "radiator",
  portTube: "portTube",
  portElbow: "portElbow",
  hardware: "hardware",
} as const;

/** The name the purchased parts table shows for each kind. */
export const PURCHASED_PART_NAMES = {
  driver: "Driver",
  horn: "Horn",
  radiator: "Passive radiator",
  portTube: "Port tube",
  portElbow: "Port elbow",
  hardware: "Hardware",
} as const satisfies Record<keyof typeof PURCHASED_PART, string>;

/** A PA port's stock pipe, as a row names it: its bore and a stick's length. */
export const purchasedPipeName = (pipe: Pick<PortPipe, "dia" | "stickFt">) =>
  `${formatInches(pipe.dia)} PVC pipe (Sch 40), ${pipe.stickFt} ft stick`;

/** A PA port's 90° elbow, as a row names it. */
export const purchasedElbowName = (dia: number) => `${formatInches(dia)} PVC elbow, 90°`;

/** A Hi-fi round port's flared tube, as a row names it: its bore and length. */
export const purchasedTubeName = (dia: number, len: number) =>
  `${formatInches(dia)} flared port tube, ${formatInches(len)} long`;

/** The purchased parts table's column headings, and the CSV's. */
export const PURCHASED_COLUMNS = {
  part: "Part",
  model: "Maker and model",
  count: "Count",
  unit: "Unit price",
  total: "Total",
  vendor: "Vendor",
} as const;

/** Under the purchased parts' total, and as the CSV's row after it, when some part has no price. */
export const PURCHASED_PARTIAL_NOTE = "Some parts have no price. The real total is higher.";
