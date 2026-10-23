import { POINTER_MOUSE } from "../../constants/pointer";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkedText, plainText } from "./MarkedText";

interface Props {
  /** a string's control names (`**name**`) show in semibold */
  tip: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * the term is a control of its own (a button): a hover, a tap or keyboard focus on it opens the tip, and a click
   * stays its own. Its wrapper takes no box, so the control sits in its layout as it would alone.
   */
  control?: boolean;
  /** a control's description id: a hidden copy of the tip, for screen readers, that the control names in `aria-describedby` */
  describes?: string;
}

/** A tip's gap from the window's edge and from its term, px. */
const TIP_EDGE_PX = 8;
const TIP_GAP_PX = 4;

/** A tip's box, drawn above the whole page: the term tooltips' and the icon buttons' names. */
export const TIP_CLASS =
  "fixed z-50 w-max max-w-[min(18rem,calc(100vw-16px))] rounded bg-stone-900 text-stone-50 text-xs font-normal normal-case tracking-normal leading-snug px-2 py-1.5 text-left pointer-events-none";

/**
 * Puts a tip under its term, kept inside the window: it shifts left or right at the window's sides, and it goes over the
 * term when there is no space under it. `center`: centered on the term; else at the term's left.
 */
export function placeTip(term: DOMRect, tip: HTMLElement, center = false) {
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.max(
    TIP_EDGE_PX,
    Math.min(
      center ? term.left + term.width / 2 - w / 2 : term.left,
      window.innerWidth - w - TIP_EDGE_PX,
    ),
  );
  const below = term.bottom + TIP_GAP_PX;
  const above = term.top - TIP_GAP_PX - h;
  const top = below + h > window.innerHeight - TIP_EDGE_PX && above >= TIP_EDGE_PX ? above : below;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.style.visibility = "visible";
}

/**
 * Term with a tooltip. Opens on a mouse hover, keyboard focus or tap; Esc or a tap elsewhere closes it. The tip is drawn
 * above the whole page (a portal), so a scrolling pane does not clip it; it follows its term as the page scrolls, and
 * it stays inside the window. A disabled control shows its tip too: browsers send pointer events to it.
 */
export function Tooltip({ tip, children, className = "", control = false, describes }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      // a control's wrapper takes no box: the control is the term
      const term = control ? ref.current?.firstElementChild : ref.current;
      if (term && box.current) placeTip(term.getBoundingClientRect(), box.current);
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, control]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      // boundary cast: a DOM event's target is typed EventTarget, here it is always a node
      if (!ref.current?.contains(e.target as Node | null)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", off);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", off);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <span
      ref={ref}
      className={control ? "contents" : `relative inline-block ${className}`}
      // a mouse hover; a touch opens the tip with its tap, and a tap elsewhere closes it
      onPointerEnter={(e) => e.pointerType === POINTER_MOUSE && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === POINTER_MOUSE && setOpen(false)}
      onPointerDown={control ? (e) => e.pointerType !== POINTER_MOUSE && setOpen(true) : undefined}
      // keyboard focus; a click's focus leaves the tip as the pointer set it
      onFocus={control ? (e) => e.target.matches(":focus-visible") && setOpen(true) : undefined}
      onBlur={control ? () => setOpen(false) : undefined}
    >
      {control ? (
        children
      ) : (
        <span
          role="button"
          tabIndex={0}
          aria-describedby={open ? id : undefined}
          onFocus={(e) => e.target.matches(":focus-visible") && setOpen(true)}
          onBlur={() => setOpen(false)}
          // a tap opens it (a mouse's hover has); a tap elsewhere closes it
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="cursor-help border-b-2 border-dotted border-soft"
        >
          {children}
        </span>
      )}
      {describes && typeof tip === "string" && (
        <span id={describes} hidden>
          {plainText(tip)}
        </span>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={box}
            role="tooltip"
            id={id}
            className={TIP_CLASS}
            style={{ left: 0, top: 0, visibility: "hidden" }}
          >
            {typeof tip === "string" ? <MarkedText text={tip} /> : tip}
          </span>,
          document.body,
        )}
    </span>
  );
}
