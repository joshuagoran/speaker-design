import { Tooltip } from "../ui/Tooltip";

/** A statistic with plain-language help: its label, and the tooltip shown on it. */
export interface StatDef {
  label: string;
  tip: string;
}
/** The statistics that carry help, by id: a row or tile names one of these (or gives a plain label, with no tooltip). */
export const STATS = {
  grossInternal: {
    label: "Gross internal",
    tip: "Inside volume of the box (outside size minus the walls), before the driver and port take their share.",
  },
  netVolume: {
    label: "Net volume",
    tip: "Air volume left inside the box once the driver and port have taken their share.",
  },
  portArea: {
    label: "Port area",
    tip: "Total cross-section of the port or ports, shown against the cone area. Too small and the air speeds up and gets noisy.",
  },
  hydraulicDiameter: {
    label: "Hydraulic diameter",
    tip: "Port cross-section area times four, divided by its perimeter. A small value means more air turbulence; flaring the mouths helps.",
  },
  midbandSensitivity: {
    label: "Midband sensitivity",
    tip: "How loud it plays in the middle of its range for a fixed input voltage. Higher means louder for the same power.",
  },
  firstLimit: {
    label: "First limit, music",
    tip: "What runs out first when playing music at the amp's power: cone travel (Xmax), port air speed, or something else.",
  },
  peakPortVelocity: {
    label: "Peak port velocity",
    tip: "Fastest air speed in the port. High speeds cause chuffing noise and compression.",
  },
  peakExcursion: {
    label: "Peak excursion",
    tip: "How far the cone moves at the loudest point, and how much of its rated travel (Xmax) that uses.",
  },
  qtc: {
    label: "Qtc",
    tip: "Damping of a sealed box. About 0.7 is flat; higher sounds boomy, lower sounds dry.",
  },
  tuningFb: {
    label: "Tuning Fb",
    tip: "Frequency the port resonates at. Output falls away quickly below it.",
  },
  f3InRoom: {
    label: "F3 in room",
    tip: "Frequency where output is 3 dB down from the midband, as heard in the room.",
  },
  maxAtSeat: {
    label: "Max at the seat",
    tip: "Clean level at the seat with both speakers playing, before a driver or port limit.",
  },
  pairPrice: {
    label: "Pair",
    tip: "Cost of the drivers for both speakers, at the listed prices.",
  },
} as const satisfies Record<string, StatDef>;
/** A row's or tile's name: a statistic from STATS (with its tooltip) or a plain label. */
export type StatName = StatDef | string;
export const statLabel = (k: StatName) => (typeof k === "string" ? k : k.label);
/** The tooltip of a "Max SPL at … Hz" row (its name carries the frequency, so the row passes it as its own tip). */
export const MAX_SPL_TIP =
  "Loudest output at this frequency from a steady sine tone, before the named limit is reached.";

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
