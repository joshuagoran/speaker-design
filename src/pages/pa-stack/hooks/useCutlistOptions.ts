import { DEFAULT_PA } from "../../../lib/defaults";
import type {
  CornerJoint,
  GrainSettings,
  OffcutShape,
  PlywoodSheetKind,
  Setter,
} from "../../../types";
import { useState } from "react";

export interface CutlistOptions {
  cornerJoint: CornerJoint;
  setCornerJoint: Setter<CornerJoint>;
  plywoodSheetKind: PlywoodSheetKind;
  setPlywoodSheetKind: Setter<PlywoodSheetKind>;
  boxSetCount: number;
  setBoxSetCount: Setter<number>;
  kerfIn: number;
  setKerfIn: Setter<number>;
  edgeTrimIn: number;
  setEdgeTrimIn: Setter<number>;
  grain: GrainSettings;
  setGrain: Setter<GrainSettings>;
  waterfall: boolean;
  setWaterfall: Setter<boolean>;
  offcutShape: OffcutShape;
  setOffcutShape: Setter<OffcutShape>;
}

/** Cutlist choices: corner joint, plywood sheet size, how many sets of boxes to cut, kerf, edge trim, grain, waterfall and offcut. */
export function useCutlistOptions(): CutlistOptions {
  const [cornerJoint, setCornerJoint] = useState<CornerJoint>(DEFAULT_PA.joint); // cutlist corner joints
  const [plywoodSheetKind, setPlywoodSheetKind] = useState<PlywoodSheetKind>(
    DEFAULT_PA.plywoodSheetKind,
  );
  const [boxSetCount, setBoxSetCount] = useState(DEFAULT_PA.boxSetCount); // how many sets of boxes the cutlist covers
  const [kerfIn, setKerfIn] = useState(DEFAULT_PA.kerf);
  const [edgeTrimIn, setEdgeTrimIn] = useState(DEFAULT_PA.trim);
  const [grain, setGrain] = useState<GrainSettings>(DEFAULT_PA.grain);
  const [waterfall, setWaterfall] = useState<boolean>(DEFAULT_PA.waterfall);
  const [offcutShape, setOffcutShape] = useState<OffcutShape>(DEFAULT_PA.offcut);
  return {
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
    kerfIn,
    setKerfIn,
    edgeTrimIn,
    setEdgeTrimIn,
    grain,
    setGrain,
    waterfall,
    setWaterfall,
    offcutShape,
    setOffcutShape,
  };
}
