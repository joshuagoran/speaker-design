import type { Chip } from "../../types";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** Background and border classes for each warning-chip status: a light tint of the status colour with a matching border. */
export const CHIP_BACKGROUND_CLASSES = {
  ok: "bg-green-50 border-green-200 border-l-4 border-l-green-300",
  warn: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-300",
  bad: "bg-red-50 border-red-200 border-l-4 border-l-red-300",
};

interface Props {
  chips: readonly Chip[];
  className?: string;
}

/** Stack of warning chips, each `[status, heading, text, id]` as returned by subChips, midChips, hornChips, fillChips and hifiChips. */
export function WarningChips({ chips, className = "" }: Props) {
  return (
    <div className={`${RESULT_MAX_WIDTH} flex flex-col gap-1.5 ${className}`.trim()}>
      {chips.map(([kind, head, body, id]) => (
        <div
          key={id}
          className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}
        >
          <b
            className={`font-semibold mr-1.5 ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}
          >
            {head}
          </b>
          <span className="text-stone-500">{body}</span>
        </div>
      ))}
    </div>
  );
}
