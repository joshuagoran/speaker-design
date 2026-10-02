import { CABINETS, FORMATS } from "../../../lib/data";
import { DEFAULT_PA } from "../../../lib/defaults";
import type { Cabinet, Format, PaLayout, Setter } from "../../../types";
import { useState } from "react";

export interface CabinetStyle {
  plinthHeightIn: number;
  cutaway: boolean;
  setCutaway: Setter<boolean>;
  cabinet: Cabinet;
  layout: PaLayout;
  setLayout: Setter<PaLayout>;
  format: Format;
  wallThicknessIn: number;
  setWallThicknessIn: Setter<number>;
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
  const [cabinet] = useState(CABINETS[0]);
  const [layout, setLayout] = useState<PaLayout>(DEFAULT_PA.layout);
  const format = FORMATS[0]; // 18″ sub + compression driver; mid is 12″ or 15″
  const [wallThicknessIn, setWallThicknessIn] = useState(DEFAULT_PA.wall); // side/top/bottom/back ply, in
  const [baffleInsetIn, setBaffleInsetIn] = useState(DEFAULT_PA.inset); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(DEFAULT_PA.baffleColor);
  const [cabinetFinish, setCabinetFinish] = useState(DEFAULT_PA.cabFinish);
  const [spacerHeightIn, setSpacerHeightIn] = useState(DEFAULT_PA.spacerH);
  return {
    plinthHeightIn,
    cutaway,
    setCutaway,
    cabinet,
    layout,
    setLayout,
    format,
    wallThicknessIn,
    setWallThicknessIn,
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
