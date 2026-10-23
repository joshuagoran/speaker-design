import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UI_TEXT } from "../../constants/uiText";
import { Button } from "./Button";
import { Icon, IconButton } from "./IconButton";
import { SectionHeading } from "./SectionHeading";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/**
 * An expanded view's box: the whole screen on a phone, and from md up a large box in the middle of the window, over
 * `EXPAND_BACKDROP_CLASS`.
 */
export const EXPANDED_PANEL_CLASS =
  "fixed z-50 inset-0 md:inset-[5vh_5vw] md:rounded-md md:border md:border-stone-300 md:shadow-dialog";

/** What is behind an expanded view from md up: the page, faded; a click on it closes the view. */
const EXPAND_BACKDROP_CLASS = "hidden md:block fixed inset-0 z-40 bg-stone-50/80";

/** The key an expanded view's browser history entry carries, so the back gesture closes the view. */
const HISTORY_KEY = "expandedView";

/**
 * Whether a view is expanded, and the way to open or close it. While it is open, Escape or the back gesture (a
 * history entry pushed on open, at the same address) closes it.
 */
export function useExpanded(): [open: boolean, setOpen: (open: boolean) => void] {
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    if (!open) return;
    try {
      if (!isExpandedEntry(history.state)) history.pushState({ [HISTORY_KEY]: true }, "");
    } catch {
      // an address that cannot change: Escape and the close button still work
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const back = () => setOpenState(false);
    window.addEventListener("keydown", esc);
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("popstate", back);
    };
  }, [open]);
  /** closes the view: back past its history entry, if the entry is still the current one */
  function close() {
    if (isExpandedEntry(history.state)) history.back();
    else setOpenState(false);
  }
  return [open, (next) => (next ? setOpenState(true) : close())];
}

/** Whether a history entry is an expanded view's own. */
function isExpandedEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && HISTORY_KEY in state;
}

/** The page faded behind an expanded view, from md up; a click on it closes the view. */
export function ExpandBackdrop({ onClose }: { onClose: () => void }) {
  return <div aria-hidden="true" className={EXPAND_BACKDROP_CLASS} onClick={onClose} />;
}

/** The expand icon: four corners pointing out. */
export function ExpandIcon() {
  return (
    <Icon>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </Icon>
  );
}

/** The close icon: an X. */
export function CloseIcon() {
  return (
    <Icon>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

/** The height an expanded chart may take, px (a chart then fills the dialog); null: the chart's own size. */
const ExpandedChartContext = createContext<number | null>(null);

/** The expanded chart's height, px, when the chart is in an expanded dialog; null on the page. */
export function useExpandedChartHeight(): number | null {
  return useContext(ExpandedChartContext);
}

/**
 * The room the expand button takes at a chart's top-right corner, px: a chart on the page keeps its readout (the values
 * under the pointer) out of it.
 */
export const EXPAND_BUTTON_ROOM_PX = 36;

/** The room a chart's own rows take in the dialog (its title row above it and its legend under it), px. */
const CHART_ROWS_PX = 96;

/** The smallest height an expanded chart takes, px (a phone held sideways). */
const MIN_EXPANDED_CHART_PX = 200;

interface Props {
  /** the chart's name: the dialog's heading */
  title: string;
  /** the chart: drawn on the page, and again, larger, in the dialog */
  children: React.ReactNode;
}

/**
 * A chart with an expand button on its top-right corner. The button opens the chart in a dialog: the whole screen on a
 * phone, a large box from md up. The chart there is wider and taller, on the same fixed axes, and still works.
 */
export function ExpandableChart({ title, children }: Props) {
  const [open, setOpen] = useExpanded();
  return (
    <div className={`relative min-w-0 ${RESULT_MAX_WIDTH}`}>
      {children}
      <div className="absolute top-0 right-0">
        <IconButton label={UI_TEXT.expandChart} size="sm" onClick={() => setOpen(true)}>
          <ExpandIcon />
        </IconButton>
      </div>
      {open && (
        <ChartDialog title={title} onClose={() => setOpen(false)}>
          {children}
        </ChartDialog>
      )}
    </div>
  );
}

/** The expanded chart's dialog: its heading, the close button, and the chart, sized to the room left. */
function ChartDialog({ title, onClose, children }: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  // the chart's height follows the dialog's
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () =>
      setHeight(Math.max(MIN_EXPANDED_CHART_PX, el.clientHeight - CHART_ROWS_PX));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // focus goes to the close button, and back to the expand button when the dialog closes
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  return createPortal(
    <>
      <ExpandBackdrop onClose={onClose} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${EXPANDED_PANEL_CLASS} bg-stone-50 flex flex-col`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <SectionHeading>{title}</SectionHeading>
          <Button onClick={onClose}>{UI_TEXT.close}</Button>
        </div>
        <div ref={body} className="flex-1 min-h-0 overflow-auto px-4 pb-4">
          {height !== null && (
            <ExpandedChartContext.Provider value={height}>{children}</ExpandedChartContext.Provider>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
