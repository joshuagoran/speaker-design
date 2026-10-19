import type {
  CornerJoint,
  CutStyle,
  GrainSettings,
  OffcutShape,
  PanelExactIn,
  PlywoodSheetKind,
  Setter,
} from "../../types";
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
  cutStyle: CutStyle;
  setCutStyle: Setter<CutStyle>;
  /** the measured thickness of each nominal panel size (lib/build/panel) */
  panelExactIn: PanelExactIn;
  setPanelExactIn: Setter<PanelExactIn>;
}
