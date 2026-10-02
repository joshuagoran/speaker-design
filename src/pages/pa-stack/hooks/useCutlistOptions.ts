import type { CornerJoint, PlywoodSheetKind, Setter } from "../../../types";
import { useState } from "react";

export interface CutlistOptions {
  cornerJoint: CornerJoint;
  setCornerJoint: Setter<CornerJoint>;
  plywoodSheetKind: PlywoodSheetKind;
  setPlywoodSheetKind: Setter<PlywoodSheetKind>;
  boxSetCount: number;
  setBoxSetCount: Setter<number>;
}

/** Cutlist choices: corner joint, plywood sheet size and how many sets of boxes to cut. */
export function useCutlistOptions(): CutlistOptions {
  const [cornerJoint, setCornerJoint] = useState<CornerJoint>("butt"); // cutlist corner joints
  const [plywoodSheetKind, setPlywoodSheetKind] = useState<PlywoodSheetKind>("4x8");
  const [boxSetCount, setBoxSetCount] = useState(2); // how many sets of boxes the cutlist covers
  return {
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
  };
}
