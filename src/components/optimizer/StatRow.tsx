import { Tooltip } from "../ui/Tooltip";
import { SUB_BASS_BAND_HZ } from "../../lib/pa/calc";

/** A statistic with plain-language help: its label, and the tooltip shown on it. */
export interface StatDef {
  label: string;
  tip: string;
}
/** The statistics that carry help, by id: a row or tile names one of these (or gives a plain label, with no tooltip). */
export const STATS = {
  grossInternal: {
    label: "Gross internal",
    tip: "Inside volume of the box, before the driver and port.",
  },
  netVolume: {
    label: "Net volume",
    tip: "Air volume in the box, after the driver and port.",
  },
  portArea: {
    label: "Port area",
    tip: "Total port area, against the cone area. A small port is fast and noisy.",
  },
  hydraulicDiameter: {
    label: "Hydraulic diameter",
    tip: "4 × port area ÷ perimeter. A small value gives turbulence; flared mouths help.",
  },
  midbandSensitivity: {
    label: "Midband sensitivity",
    tip: "Midband level for a fixed input voltage. Higher is louder for the same power.",
  },
  firstLimit: {
    label: "First limit, music",
    tip: "The first limit with music at the amp's power: cone travel (Xmax), port air speed, or other.",
  },
  peakPortVelocity: {
    label: "Peak port velocity",
    tip: "Maximum port air speed. High speed causes chuffing and compression.",
  },
  peakExcursion: {
    label: "Peak excursion",
    tip: "Maximum cone travel, and its share of the rated travel (Xmax).",
  },
  qtc: {
    label: "Qtc",
    tip: "Sealed-box damping. About 0.7 is flat; higher is boomy, lower is dry.",
  },
  tuningFb: {
    label: "Tuning Fb",
    tip: "Port resonance frequency. Output drops quickly below it.",
  },
  systemF3: {
    label: "System F3",
    tip: "Frequency 3 dB below this driver's midband, with the highpass. It compares the low-end shape, not the level.",
  },
  subBass: {
    label: `Sub-bass ${SUB_BASS_BAND_HZ[0]}–${SUB_BASS_BAND_HZ[1]} Hz`,
    tip: `Average of the max SPL curve from ${SUB_BASS_BAND_HZ[0]} to ${SUB_BASS_BAND_HZ[1]} Hz, with the highpass: the steady sine level at the first limit (excursion, port air speed or amp).`,
  },
  f3InRoom: {
    label: "F3 in room",
    tip: "Frequency 3 dB below the midband, in the room.",
  },
  maxAtSeat: {
    label: "Max at the seat",
    tip: "Clean level at the seat from both speakers, below a driver or port limit.",
  },
  pairPrice: {
    label: "Pair",
    tip: "Driver cost for both speakers, at the listed prices.",
  },
} as const satisfies Record<string, StatDef>;
/** A row's or tile's name: a statistic from STATS (with its tooltip) or a plain label. */
export type StatName = StatDef | string;
export const statLabel = (k: StatName) => (typeof k === "string" ? k : k.label);
/** The tooltip of a "Max SPL at … Hz" row (its name carries the frequency, so the row passes it as its own tip). */
export const MAX_SPL_TIP = "Maximum steady sine level at this frequency, below the named limit.";

interface StatLabelProps {
  k: StatName;
  extra?: string;
}

/** Statistic name, with a tooltip when one exists. */
export function StatLabel({ k, extra }: StatLabelProps) {
  const tip = [typeof k === "string" ? null : k.tip, extra].filter(Boolean).join(" ");
  return tip ? <Tooltip tip={tip}>{statLabel(k)}</Tooltip> : statLabel(k);
}

interface StatRowProps {
  k: StatName;
  v: React.ReactNode;
  note?: React.ReactNode;
  tip?: string;
}

/** One statistic: name, value and note. */
export function StatRow({ k, v, note, tip }: StatRowProps) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-300 py-1">
      <span className="text-stone-500 shrink-0">
        <StatLabel k={k} extra={tip} />
      </span>
      <span className="text-right min-w-0">
        <span className="font-medium tabular-nums">{v}</span>
        {note ? (
          <span className="block text-xs text-stone-500 whitespace-nowrap">{note}</span>
        ) : null}
      </span>
    </div>
  );
}
