import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Width of an element in CSS px, kept current with a ResizeObserver. */
export function useElementWidth(fallback: number): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      if (cw) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Whether an element is at least `px` CSS px wide, kept current with a ResizeObserver. Measured before the first paint,
 * so a layout that switches on it draws right the first time, and it re-renders only when the answer flips, not on
 * every pixel of a resize.
 */
export function useWidthAtLeast(px: number): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [atLeast, setAtLeast] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      if (cw) setAtLeast(cw >= px);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [px]);
  return [ref, atLeast];
}
