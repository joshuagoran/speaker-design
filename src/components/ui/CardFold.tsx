import { AnimatedDetails } from "./AnimatedDetails";
import { Card } from "./Card";
import { HOVER_TRANSITION } from "./buttonStyles";
import { GAP_Y } from "../../styles/layout";

interface Props {
  /** the DOM id, to scroll it into view */
  id?: string;
  /** the item's name, in bold */
  title: string;
  /** the item's values in one line, after the name (cut off with an ellipsis when too long) */
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * A card that folds, for a list of like items (a placement): its row shows the name and a one-line summary and opens to
 * the item's controls. The parent says which items are open.
 */
export function CardFold({ id, title, summary, open, onOpenChange, children }: Props) {
  return (
    <Card id={id} pad="none">
      <AnimatedDetails
        open={open}
        onOpenChange={onOpenChange}
        summary={
          <>
            <span className="min-w-0 flex-1 truncate">
              <b className="font-semibold">{title}</b>
              {summary && <span className="text-sm text-stone-500"> · {summary}</span>}
            </span>
            <span
              className={`text-stone-500 text-base group-hover:text-stone-900 ${HOVER_TRANSITION}`}
              aria-hidden="true"
            >
              {open ? "−" : "+"}
            </span>
          </>
        }
        summaryClassName={`flex items-center gap-3 min-h-11 px-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden group rounded ${HOVER_TRANSITION}`}
      >
        <div className={`px-3 pb-3 ${GAP_Y}`}>{children}</div>
      </AnimatedDetails>
    </Card>
  );
}
