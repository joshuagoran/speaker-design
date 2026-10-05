import type { DispersionPlane, Setter } from "../../../types";
import { useEffect, useState } from "react";

export interface StackViewOptions {
  dispersionPlane: DispersionPlane;
  setDispersionPlane: Setter<DispersionPlane>;
  isFull3d: boolean;
  setIsFull3d: Setter<boolean>;
}

/** View toggles on the PA stack page: dispersion plane and full-screen 3D. */
export function useStackViewOptions(): StackViewOptions {
  const [dispersionPlane, setDispersionPlane] = useState<DispersionPlane>("h"); // dispersion map: horizontal (first, as on Hi-fi) or vertical (lobing)
  const [isFull3d, setIsFull3d] = useState(false);
  useEffect(() => {
    if (!isFull3d) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFull3d(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [isFull3d]);
  return {
    dispersionPlane,
    setDispersionPlane,
    isFull3d,
    setIsFull3d,
  };
}
