import type { DispersionPlane, Setter } from "../../../types";
import { useState } from "react";

export interface StackViewOptions {
  dispersionPlane: DispersionPlane;
  setDispersionPlane: Setter<DispersionPlane>;
}

/** View toggles on the PA stack page: the dispersion plane (the 3D view's cutaway and full screen are its card's). */
export function useStackViewOptions(): StackViewOptions {
  const [dispersionPlane, setDispersionPlane] = useState<DispersionPlane>("h"); // dispersion map: horizontal (first, as on Hi-fi) or vertical (lobing)
  return {
    dispersionPlane,
    setDispersionPlane,
  };
}
