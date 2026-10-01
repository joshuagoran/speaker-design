import { Tooltip } from "../ui/Tooltip.jsx";

/** Plain-language help for the stat labels, shown as a tooltip on the label */
export const STAT_TIPS = {
  "Gross internal": "Inside volume of the box (outside size minus the walls), before the driver and port take their share.",
  "Net volume": "Air volume left inside the box once the driver and port have taken their share.",
  "Port area": "Total cross-section of the port or ports, shown against the cone area. Too small and the air speeds up and gets noisy.",
  "Hydraulic diameter": "Port cross-section area times four, divided by its perimeter. A small value means more air turbulence; flaring the mouths helps.",
  "Midband sensitivity": "How loud it plays in the middle of its range for a fixed input voltage. Higher means louder for the same power.",
  "First limit, music": "What runs out first when playing music at the amp's power: cone travel (Xmax), port air speed, or something else.",
  "Peak port velocity": "Fastest air speed in the port. High speeds cause chuffing noise and compression.",
  "Peak excursion": "How far the cone moves at the loudest point, and how much of its rated travel (Xmax) that uses.",
  "Qtc": "Damping of a sealed box. About 0.7 is flat; higher sounds boomy, lower sounds dry.",
  "Tuning Fb": "Frequency the port resonates at. Output falls away quickly below it.",
  "F3 in room": "Frequency where output is 3 dB down from the midband, as heard in the room.",
  "Max at the seat": "Clean level at the seat with both speakers playing, before a driver or port limit.",
  "Pair": "Cost of the drivers for both speakers, at the listed prices.",
};

/** Statistic name, with a tooltip when one exists. */
export function StatLabel({ k, extra }) {
  const def = STAT_TIPS[k] || (/^Max SPL at /.test(k) ? "Loudest output at this frequency from a steady sine tone, before the named limit is reached." : null);
  const tip = [def, extra].filter(Boolean).join(" ");
  return tip ? <Tooltip tip={tip}>{k}</Tooltip> : k;
}

/** One statistic: name, value and note. */
export function StatRow({ k, v, note, tip }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-300 py-1">
      <span className="text-stone-500 shrink-0"><StatLabel k={k} extra={tip} /></span>
      <span className="text-right min-w-0">
        <span className="font-medium tabular-nums">{v}</span>
        {note ? <span className="block text-xs text-stone-500 whitespace-nowrap">{note}</span> : null}
      </span>
    </div>
  );
}
