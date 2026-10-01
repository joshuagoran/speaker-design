const { useEffect, useRef, useState } = React;

/** Width of an element in CSS px, kept current with a ResizeObserver. */
export function useElementWidth(fallback) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const cw = el.clientWidth; if (cw) setW(cw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
