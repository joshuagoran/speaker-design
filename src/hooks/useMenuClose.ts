import { useEffect, type RefObject } from "react";

/**
 * Closes an open menu (`setOpen(false)`): on a click outside `root`, or on Escape wherever focus is. Escape is caught
 * before anything else hears it, so it closes the menu only (not an expanded view under it), and focus goes back to the
 * menu's button (the first button in `root`).
 */
export function useMenuClose(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open, root, setOpen]);
}
