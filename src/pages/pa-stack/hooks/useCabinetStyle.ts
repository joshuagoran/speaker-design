import { DEFAULT_PA } from "../../../lib/defaults";
import type { BraceStyleId, Cabinet, Format, PaLayout, PanelNominal, Setter } from "../../../types";
import { useState } from "react";
import { defaultBraceStyle } from "../../../lib/bracing";

export interface CabinetStyle {
  plinthHeightIn: number;
  cutaway: boolean;
  setCutaway: Setter<boolean>;
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
  baffleInsetIn: number;
  setBaffleInsetIn: Setter<number>;
  baffleColor: string;
  setBaffleColor: Setter<string>;
  /** a `FinishId` or a paint colour (hex) */
  cabinetFinish: string;
  setCabinetFinish: Setter<string>;
  spacerHeightIn: number;
  setSpacerHeightIn: Setter<number>;
}

/** Cabinet construction and look: plywood, baffle inset, finish, layout and the fixed plinth. */
export function useCabinetStyle(): CabinetStyle {
  const plinthHeightIn = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState<boolean>(DEFAULT_PA.cutaway);
  const [layout, setLayout] = useState<PaLayout>(DEFAULT_PA.layout);
  const [wallPanel, setWallPanel] = useState<PanelNominal>(DEFAULT_PA.panel); // side/top/bottom/back ply
  const [braceStyle, setBraceStyle] = useState<BraceStyleId | undefined>(undefined);
  const [baffleInsetIn, setBaffleInsetIn] = useState(DEFAULT_PA.inset); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(DEFAULT_PA.baffleColor);
  const [cabinetFinish, setCabinetFinish] = useState(DEFAULT_PA.cabFinish);
  const [spacerHeightIn, setSpacerHeightIn] = useState(DEFAULT_PA.spacerH);
  return {
    plinthHeightIn,
    cutaway,
    setCutaway,
    cabinet: DEFAULT_PA.cabinet,
    layout,
    setLayout,
    format: DEFAULT_PA.format, // 18″ sub + compression driver; mid is 12″ or 15″
    wallPanel,
    setWallPanel,
    braceStyle,
    setBraceStyle,
    effectiveBraceStyle: braceStyle ?? defaultBraceStyle(wallPanel),
    baffleInsetIn,
    setBaffleInsetIn,
    baffleColor,
    setBaffleColor,
    cabinetFinish,
    setCabinetFinish,
    spacerHeightIn,
    setSpacerHeightIn,
  };
}
