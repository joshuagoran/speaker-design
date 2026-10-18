import { useState } from "react";
import { HOVER_TRANSITION } from "./buttonStyles";
import { GAP_Y } from "../../styles/layout";

interface Props {
  /** the box's name in bold, shown open and closed ("Vent"); absent: the summary is the line's main text */
  title?: string;
  /** the box's key facts in one line: after the title while closed, or the line's main text when it has no title */
  summary: React.ReactNode;
  /** marks before the summary (a band's dot) */
  lead?: React.ReactNode;
  /** buttons at the right end of the line (a trash icon) */
  actions?: React.ReactNode;
  /** whether it starts open (default closed) */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * A box that folds to one summary line, for a group of settings most designs set once (a vent, a driver, a band): a
 * chevron, the title and the summary (wrapped to two lines at most), and buttons at the right. Click the line to open
 * it. Closed, its settings stay mounted but hidden, so they keep their state.
 */
export function FoldBox({ title, summary, lead, actions, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded border border-stone-300 focus-within:border-stone-500 pl-1.5 pr-1 py-1 ${HOVER_TRANSITION}`}
    >
      <div className="flex items-center gap-1.5 min-h-8">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex-1 min-w-0 flex items-start gap-1.5 py-1 text-left"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={`shrink-0 w-3.5 h-3.5 mt-0.5 fill-none stroke-stone-500 group-hover:stroke-stone-900 ${open ? "rotate-90" : ""} ${HOVER_TRANSITION}`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
          <span className="min-w-0 line-clamp-2 text-sm leading-snug">
            {title && <span className="font-bold mr-2">{title}</span>}
            {lead}
            {title ? (
              !open && <span className="text-[13px] text-stone-500">{summary}</span>
            ) : (
              <span>{summary}</span>
            )}
          </span>
        </button>
        {actions}
      </div>
      <div className={`pt-1.5 pb-1.5 pr-1 ${GAP_Y} ${open ? "" : "hidden"}`}>{children}</div>
    </div>
  );
}
