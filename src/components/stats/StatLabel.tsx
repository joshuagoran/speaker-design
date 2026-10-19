import { Tooltip } from "../ui/Tooltip";
import { SUB_BASS_BAND_HZ } from "../../lib/acoustics/boxModels";
import { UI_TEXT } from "../../constants/uiText";

/** A statistic with plain-language help: its label, and the tooltip shown on it. */
export interface StatDef {
  label: string;
  tip: string;
}
/** The statistics that carry help, by id: a row or tile names one of these (or gives a plain label, with no tooltip). */
export const STATS = {
  grossInternal: {
    label: "Gross internal",
    tip: "Inside volume, before the driver and port.",
  },
  netVolume: {
    label: "Net volume",
    tip: "Air volume after the driver and port.",
  },
  portArea: {
    label: "Port area",
    tip: "Total port area, against cone area. Too small: fast, noisy air.",
  },
  hydraulicDiameter: {
    label: "Hydraulic diameter",
    tip: "4 × area ÷ perimeter. Small values mean turbulence; flared mouths help.",
  },
  midbandSensitivity: {
    label: "Midband sensitivity",
    tip: "Level for a fixed voltage. Higher is louder for the same power.",
  },
  firstLimit: {
    label: "First limit, music",
    tip: "What limits first with music: Xmax, port air speed or other.",
  },
  peakPortVelocity: {
    label: "Peak port velocity",
    tip: "Maximum port air speed. High speed: chuffing and compression.",
  },
  peakExcursion: {
    label: "Peak excursion",
    tip: "Maximum cone travel and its share of Xmax.",
  },
  qtc: {
    label: "Qtc",
    tip: "Sealed-box damping. 0.7 is flat; higher is boomy, lower dry.",
  },
  tuningFb: {
    label: "Tuning Fb",
    tip: "Port resonance. Output drops quickly below it.",
  },
  systemF3: {
    label: "System F3",
    tip: "−3 dB point against this driver's midband, with the highpass. Shape, not level.",
  },
  subBass: {
    label: `Sub-bass ${SUB_BASS_BAND_HZ[0]}–${SUB_BASS_BAND_HZ[1]} Hz`,
    tip: `Average of the max SPL curve from ${SUB_BASS_BAND_HZ[0]} to ${SUB_BASS_BAND_HZ[1]} Hz, with the highpass: steady sine level at the first limit.`,
  },
  f3InRoom: {
    label: "F3 in room",
    tip: "In-room −3 dB point.",
  },
  maxAtSeat: {
    label: "Max at the seat",
    tip: "Clean level at the seat from both speakers.",
  },
  pairPrice: {
    label: "Pair",
    tip: "Driver cost for both speakers.",
  },
  partsPrice: {
    label: "Price",
    tip: `The purchased parts on the Cutlist tab, without the plywood. A ${UI_TEXT.partialPriceMark} shows that some parts have no price.`,
  },
  stackHeight: {
    label: "Height",
    tip: "From the stack's base to its highest point, with a horn on a top. A plinth or stand under the stack is not included.",
  },
} as const satisfies Record<string, StatDef>;
/** A row's or tile's name: a statistic from STATS (with its tooltip) or a plain label. */
export type StatName = StatDef | string;
export const statLabel = (k: StatName) => (typeof k === "string" ? k : k.label);
interface StatLabelProps {
  k: StatName;
  extra?: string;
}

/** Statistic name, with a tooltip when one exists. */
export function StatLabel({ k, extra }: StatLabelProps) {
  const tip = [typeof k === "string" ? null : k.tip, extra].filter(Boolean).join(" ");
  return tip ? <Tooltip tip={tip}>{statLabel(k)}</Tooltip> : statLabel(k);
}
