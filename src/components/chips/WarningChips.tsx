import type { Chip, ChipId } from "../../types";
import { Tooltip } from "../ui/Tooltip";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** Background and border classes for each warning-chip status: a light tint of the status color with a matching border. */
export const CHIP_BACKGROUND_CLASSES = {
  ok: "bg-green-50 border-green-200 border-l-4 border-l-green-300",
  warn: "bg-amber-50 border-amber-200 border-l-4 border-l-amber-300",
  bad: "bg-red-50 border-red-200 border-l-4 border-l-red-300",
};

interface Props {
  chips: readonly Chip[];
  className?: string;
  /** a tooltip on the title of each chip with one of these ids */
  tips?: Partial<Record<ChipId, string>>;
  /**
   * one compact row under this label: each chip shows its title only, its text (and its `tips` line) in the title's
   * tooltip, so no text block stays on the page; absent: a stack of chips, each with its text
   */
  row?: string;
}

/** Each status's title color. */
const CHIP_TITLE_CLASSES = {
  ok: "text-green-800",
  warn: "text-amber-700",
  bad: "text-red-700",
};

/** Stack of warning chips, each `[status, heading, text, id]` as the pages' chip lists return them. */
export function WarningChips({ chips, tips, row }: Props) {
  if (row !== undefined)
    return (
      <div className={`${RESULT_MAX_WIDTH} flex flex-wrap items-center gap-1.5`}>
        <span className="text-xs font-semibold text-stone-500 mr-1">{row}</span>
        {chips.map(([kind, head, body, id]) => (
          <span
            key={id}
            className={`inline-block text-xs px-2 py-1 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}
          >
            <Tooltip tip={tips?.[id] ? `${body} ${tips[id]}` : body}>
              <b className={`font-semibold ${CHIP_TITLE_CLASSES[kind]}`}>{head}</b>
            </Tooltip>
          </span>
        ))}
      </div>
    );
  return (
    <div className={`${RESULT_MAX_WIDTH} flex flex-col gap-1.5`}>
      {chips.map(([kind, head, body, id]) => (
        <div
          key={id}
          className={`block text-xs leading-relaxed px-3 py-2 rounded border ${CHIP_BACKGROUND_CLASSES[kind] || CHIP_BACKGROUND_CLASSES.ok}`}
        >
          <b className={`font-semibold mr-1.5 ${CHIP_TITLE_CLASSES[kind]}`}>
            {tips?.[id] ? <Tooltip tip={tips[id]}>{head}</Tooltip> : head}
          </b>
          <span className="text-stone-500">{body}</span>
        </div>
      ))}
    </div>
  );
}
