import { useEffect, useState } from "react";

/**
 * The height a floor map may take, px: on phones, half the screen, so it stays in view above the open settings sheet;
 * from md up, most of the window. It follows the window's size.
 */
export function useMapMaxHeight() {
  const read = () =>
    typeof window === "undefined"
      ? 640
      : window.innerWidth < 768
        ? Math.max(260, window.innerHeight * 0.5 - 40)
        : Math.max(420, Math.min(760, window.innerHeight * 0.8));
  const [h, setH] = useState(read);
  useEffect(() => {
    const on = () => setH(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return h;
}
