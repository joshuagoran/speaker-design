import type { DispersionPlane } from "../../../types.ts";
import { useEffect, useState } from "react";

export interface StackViewOptions {
  dispersionPlane: DispersionPlane;
  setDispersionPlane: React.Dispatch<React.SetStateAction<DispersionPlane>>;
  showDetails: boolean;
  setShowDetails: React.Dispatch<React.SetStateAction<boolean>>;
  isFull3d: boolean;
  setIsFull3d: React.Dispatch<React.SetStateAction<boolean>>;
}

/** View toggles on the PA stack page: dispersion plane, details panel and full-screen 3D. */
export function useStackViewOptions(): StackViewOptions {
  const [dispersionPlane, setDispersionPlane] = useState<DispersionPlane>("v"); // dispersion map: vertical (lobing) or horizontal
  const [showDetails, setShowDetails] = useState(false);
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
    showDetails,
    setShowDetails,
    isFull3d,
    setIsFull3d,
  };
}
