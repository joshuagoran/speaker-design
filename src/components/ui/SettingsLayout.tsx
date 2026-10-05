import { useEffect, useRef, useState } from "react";
import { PAGE_WIDTH } from "../../styles/layout";
import { FONT } from "../../styles/fonts";
import { useStoredState } from "../../hooks/useStoredState";

/** The narrowest the settings column goes, px: below this its controls get cramped. */
const SETTINGS_MIN_PX = 300;
/** How far one arrow-key press moves the divider, px. */
const KEY_STEP_PX = 16;

/**
 * The settings column's width as the grid reads it: the width the viewer dragged it to (kept between the narrowest
 * width and half the page), else the default (`--settings-default`, set per breakpoint on the page, but never under the
 * narrowest width).
 */
const settingsWidth = (px: number | null) =>
  px == null
    ? `max(${SETTINGS_MIN_PX}px, var(--settings-default))`
    : `clamp(${SETTINGS_MIN_PX}px, ${Math.round(px)}px, 50%)`;

interface Props {
  /** the results pane: charts, totals and anything above them */
  results: React.ReactNode;
  /** the settings column (a `SettingsColumn`) */
  settings: React.ReactNode;
  /** extra classes on the page (the room a phone settings sheet needs at the bottom) */
  className?: string;
}

/**
 * A page with a settings column. From md up the page itself doesn't scroll: the results and the settings are two panes
 * below the header, each with its own scrollbar at its own right edge. The divider between them drags (or takes the
 * arrow keys) to set the settings column's width, remembered per browser for every page; a double-click resets it. On
 * phones, one column that scrolls as a page.
 */
export function SettingsLayout({ results, settings, className = "" }: Props) {
  const [widthPx, setWidthPx] = useStoredState<number | null>("layout.settingsWidth", null);
  const page = useRef<HTMLElement>(null);
  /** the pointer dragging the divider, and whether it has moved (a click alone stores nothing) */
  const drag = useRef<{ id: number; moved: boolean } | null>(null);
  /** the settings column's drawn width and the widest it may go (half the page), px: the divider's value for screen readers */
  const [size, setSize] = useState({ now: 0, max: 0 });
  useEffect(() => {
    const el = page.current,
      aside = el?.querySelector("aside");
    if (!el || !aside || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setSize({ now: Math.round(aside.getBoundingClientRect().width), max: Math.round(inner / 2) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(aside);
    return () => ro.disconnect();
  }, []);
  /** the settings width that puts the divider's centre at `x` (a pointer's clientX) */
  const widthAt = (x: number) => {
    const el = page.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.right - parseFloat(getComputedStyle(el).paddingRight) - x - 12;
  };
  /** the settings column's width as drawn now, px */
  const drawnWidth = () => page.current?.querySelector("aside")?.getBoundingClientRect().width ?? 0;
  // while dragging, the width is written straight to the page's style (no re-render per pointer move); it is stored on release
  const show = (px: number | null) =>
    page.current?.style.setProperty("--settings-w", settingsWidth(px));
  return (
    <main
      ref={page}
      className={`${PAGE_WIDTH} pb-16 grid grid-cols-1 gap-8 md:h-full md:pb-0 md:gap-0 md:grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_1.5rem_var(--settings-w)] md:[--settings-default:40%] xl:[--settings-default:26rem] ${className}`}
      style={{ fontFamily: FONT, ["--settings-w" as string]: settingsWidth(widthPx) }} // boundary cast: React's style type has no custom properties
    >
      {/* the pane scrolls, so it clips whatever is drawn past its edges: 4 px of room on the left (taken back from the
          page's gutter, so the content stays put) keep a focus ring there whole */}
      <div className="min-w-0 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable] md:-ml-1 md:pl-1 md:pr-2 md:pb-16">
        {results}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Settings width (drag, or use the arrow keys; double-click to reset)"
        aria-valuemin={SETTINGS_MIN_PX}
        aria-valuemax={size.max}
        aria-valuenow={size.now}
        tabIndex={0}
        className="group max-md:hidden flex justify-center cursor-col-resize touch-none select-none mb-4 rounded"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { id: e.pointerId, moved: false };
        }}
        onPointerMove={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          const px = widthAt(e.clientX);
          if (px == null) return;
          drag.current.moved = true;
          show(px);
        }}
        onPointerUp={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          const { moved } = drag.current;
          drag.current = null;
          // keep what the clamp actually drew, so the stored width is one the page can show
          if (moved) setWidthPx(drawnWidth());
        }}
        onPointerCancel={() => {
          drag.current = null;
          show(widthPx); // back to the width before the drag
        }}
        onDoubleClick={() => {
          show(null);
          setWidthPx(null);
        }}
        onKeyDown={(e) => {
          const step =
            e.key === "ArrowLeft" ? KEY_STEP_PX : e.key === "ArrowRight" ? -KEY_STEP_PX : 0;
          if (!step) return;
          e.preventDefault();
          show(drawnWidth() + step);
          setWidthPx(drawnWidth());
        }}
      >
        <div className="w-px h-full bg-stone-300 group-hover:w-0.5 group-hover:bg-stone-900 group-focus-visible:w-0.5 group-focus-visible:bg-stone-900 group-active:w-0.5 group-active:bg-stone-900" />
      </div>
      {settings}
    </main>
  );
}
