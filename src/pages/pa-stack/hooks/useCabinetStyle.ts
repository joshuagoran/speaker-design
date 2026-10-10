import { DEFAULT_PA } from "../../../lib/defaults";
import type {
  BackJointId,
  BraceStyleId,
  Cabinet,
  Format,
  HornMountId,
  PaHardware,
  PaDesignConfig,
  PaLayout,
  PanelNominal,
  Setter,
} from "../../../types";
import { useState } from "react";
import { defaultBraceStyle } from "../../../lib/bracing";

export interface CabinetStyle {
  plinthHeightIn: number;
  cabinet: Cabinet;
  layout: PaLayout;
  setLayout: Setter<PaLayout>;
  format: Format;
  /** the walls' nominal size (the exact thickness is the Cutlist page's, `PaDesign.wallThicknessIn`) */
  wallPanel: PanelNominal;
  setWallPanel: Setter<PanelNominal>;
  /** the boxes' bracing style as chosen (one for the stack); absent: the plywood's default (`defaultBraceStyle`) */
  braceStyle: BraceStyleId | undefined;
  setBraceStyle: Setter<BraceStyleId | undefined>;
  /** the style both boxes are braced with: the one chosen, else the nominal plywood size's default */
  effectiveBraceStyle: BraceStyleId;
  /** how both boxes' backs are fixed (glued, or screwed on) */
  backJoint: BackJointId;
  setBackJoint: Setter<BackJointId>;
  baffleInsetIn: number;
  setBaffleInsetIn: Setter<number>;
  baffleColor: string;
  setBaffleColor: Setter<string>;
  /** the horn body's picked color; undefined: the horn's catalog finish */
  hornColor: PaDesignConfig["hornColor"];
  setHornColor: Setter<PaDesignConfig["hornColor"]>;
  /** what holds a driver bolted straight to its horn on the lid (lib/pa/hornMount `takesHornMount`) */
  hornMount: HornMountId;
  setHornMount: Setter<HornMountId>;
  /** a `FinishId` or a paint color (hex) */
  cabinetFinish: string;
  setCabinetFinish: Setter<string>;
  spacerHeightIn: number;
  setSpacerHeightIn: Setter<number>;
  /** each box's handles and their offsets (lib/pa/hardware) */
  hardware: PaHardware;
  setHardware: Setter<PaHardware>;
}

/** Cabinet construction and look: plywood, baffle inset, finish, layout and the fixed plinth. */
export function useCabinetStyle(): CabinetStyle {
  const plinthHeightIn = 3; // fixed, matches the duct height
  const [layout, setLayout] = useState<PaLayout>(DEFAULT_PA.layout);
  const [wallPanel, setWallPanel] = useState<PanelNominal>(DEFAULT_PA.panel); // side/top/bottom/back ply
  const [braceStyle, setBraceStyle] = useState<BraceStyleId | undefined>(undefined);
  const [backJoint, setBackJoint] = useState<BackJointId>(DEFAULT_PA.backJoint);
  const [baffleInsetIn, setBaffleInsetIn] = useState(DEFAULT_PA.inset); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(DEFAULT_PA.baffleColor);
  const [hornColor, setHornColor] = useState<PaDesignConfig["hornColor"]>(undefined);
  const [hornMount, setHornMount] = useState<HornMountId>(DEFAULT_PA.hornMount);
  const [cabinetFinish, setCabinetFinish] = useState(DEFAULT_PA.cabFinish);
  const [spacerHeightIn, setSpacerHeightIn] = useState(DEFAULT_PA.spacerH);
  const [hardware, setHardware] = useState<PaHardware>(DEFAULT_PA.hardware);
  return {
    plinthHeightIn,
    cabinet: DEFAULT_PA.cabinet,
    layout,
    setLayout,
    format: DEFAULT_PA.format, // 18″ sub + compression driver; mid is 12″ or 15″
    wallPanel,
    setWallPanel,
    braceStyle,
    setBraceStyle,
    effectiveBraceStyle: braceStyle ?? defaultBraceStyle(wallPanel),
    backJoint,
    setBackJoint,
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    hornColor,
    setHornColor,
    hornMount,
    setHornMount,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
    hardware,
    setHardware,
  };
}
