import { DEFAULT_PA } from "../../../lib/defaults";
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
  const [cornerJoint, setCornerJoint] = useState<CornerJoint>(DEFAULT_PA.joint); // cutlist corner joints
  const [plywoodSheetKind, setPlywoodSheetKind] = useState<PlywoodSheetKind>(
    DEFAULT_PA.plywoodSheetKind,
  );
  const [boxSetCount, setBoxSetCount] = useState(DEFAULT_PA.boxSetCount); // how many sets of boxes the cutlist covers
  return {
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
  };
}
