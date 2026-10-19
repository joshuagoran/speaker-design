import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches now, kept current as the window changes (false where there is no window). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== "function") return () => {};
      const media = matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => typeof matchMedia === "function" && matchMedia(query).matches,
    () => false,
  );
}
