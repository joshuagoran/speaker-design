import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** How long a fold takes to open or close, ms. */
const FOLD_MS = 200;

/** Whether the viewer allows motion and the browser can animate an element. */
const motionAllowed = () =>
  typeof window !== "undefined" &&
  typeof Element.prototype.animate === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates an element's height between 0 and its natural height when `open` changes, and returns whether to render it
 * open: on close it stays rendered until the animation ends. `animates` says whether the change shows at all (a fold that
 * doesn't fold at this width changes nothing); without it, or with reduced motion, the change is instant.
 */
export function useHeightAnimation(
  open: boolean,
  animates: () => boolean = () => true,
): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [phase, setPhase] = useState<"opening" | "closing" | null>(null);
  // set during render, so the render that closes the fold still shows it (no frame without it)
  if (open !== prevOpen) {
    setPrevOpen(open);
    setPhase(motionAllowed() && animates() ? (open ? "opening" : "closing") : null);
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !phase) return;
    // from where it is now: mid-way through a fold that turned back, else shut (opening) or full (closing)
    const now = running.current ? el.getBoundingClientRect().height : null;
    running.current?.cancel();
    // clip first, then measure: clipping stops child margins collapsing through, which changes the height
    el.style.overflow = "hidden";
    const full = el.scrollHeight;
    const from = now ?? (phase === "opening" ? 0 : full);
    const a = el.animate(
      [{ height: `${from}px` }, { height: `${phase === "opening" ? full : 0}px` }],
      {
        duration: FOLD_MS,
        easing: "ease-out",
      },
    );
    running.current = a;
    a.onfinish = () => {
      running.current = null;
      el.style.overflow = "";
      // hold it shut until the closed render hides it, so it doesn't flash open for a frame
      if (phase === "closing") el.style.height = "0px";
      setPhase(null);
    };
  }, [phase]);
  useLayoutEffect(() => {
    if (!phase && ref.current) ref.current.style.height = "";
  }, [phase]);
  return [ref, open || phase === "closing"];
}
