import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkedText } from "./MarkedText";

interface Props {
  /** a string's control names (`**name**`) show in semibold */
  tip: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** the term is a control of its own (a button): a hover or focus on it opens the tip, and a click stays its own */
  control?: boolean;
}

/** The tooltip's widest, px (`max-w-[18rem]`), and a tip's gap from the window's edge, px. */
const TIP_W = 288;
export const TIP_EDGE_PX = 8;

/** A tip's box, drawn above the whole page: the term tooltips' and the icon buttons' names. */
export const TIP_CLASS =
  "fixed z-50 w-max max-w-[18rem] rounded bg-stone-900 text-stone-50 text-xs font-normal normal-case tracking-normal leading-snug px-2 py-1.5 text-left pointer-events-none";

/**
 * Term with a tooltip. Opens on hover, keyboard focus or tap; Esc or a tap elsewhere closes it. The tip is drawn above
 * the whole page (a portal), so a scrolling pane does not clip it; it follows its term as the page scrolls.
 */
export function Tooltip({ tip, children, className = "", control = false }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  /** where the tip sits in the window, px */
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      setAt({
        left: Math.max(TIP_EDGE_PX, Math.min(r.left, window.innerWidth - TIP_W - TIP_EDGE_PX)),
        top: r.bottom + 4,
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      // boundary cast: a DOM event's target is typed EventTarget, here it is always a node
      if (!ref.current?.contains(e.target as Node | null)) setOpen(false);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  return (
    <span
      ref={ref}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={control ? () => setOpen(true) : undefined}
      onBlur={control ? () => setOpen(false) : undefined}
    >
      {control ? (
        children
      ) : (
        <span
          role="button"
          tabIndex={0}
          aria-describedby={open ? id : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="cursor-help border-b-2 border-dotted border-soft"
        >
          {children}
        </span>
      )}
      {open &&
        at &&
        typeof document !== "undefined" &&
        createPortal(
          <span role="tooltip" id={id} style={{ left: at.left, top: at.top }} className={TIP_CLASS}>
            {typeof tip === "string" ? <MarkedText text={tip} /> : tip}
          </span>,
          document.body,
        )}
    </span>
  );
}
