import { PAINT_SWATCHES, CABINETS, FORMATS } from "../../../lib/data";
import type { Cabinet, FinishId, Format, PaLayout } from "../../../types";
import { useState } from "react";

export interface CabinetStyle {
  plinthHeightIn: number;
  cutaway: boolean;
  setCutaway: React.Dispatch<React.SetStateAction<boolean>>;
  cabinet: Cabinet;
  layout: PaLayout;
  setLayout: React.Dispatch<React.SetStateAction<PaLayout>>;
  format: Format;
  wallThicknessIn: number;
  setWallThicknessIn: React.Dispatch<React.SetStateAction<number>>;
  baffleInsetIn: number;
  setBaffleInsetIn: React.Dispatch<React.SetStateAction<number>>;
  baffleColor: string;
  setBaffleColor: React.Dispatch<React.SetStateAction<string>>;
  cabinetFinish: FinishId;
  setCabinetFinish: React.Dispatch<React.SetStateAction<FinishId>>;
  spacerHeightIn: number;
  setSpacerHeightIn: React.Dispatch<React.SetStateAction<number>>;
}

/** Cabinet construction and look: plywood, baffle inset, finish, layout and the fixed plinth. */
export function useCabinetStyle(): CabinetStyle {
  const plinthHeightIn = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet] = useState(CABINETS[0]);
  const [layout, setLayout] = useState<PaLayout>("stack");
  const format = FORMATS[0]; // 18″ sub + compression driver; mid is 12″ or 15″
  const [wallThicknessIn, setWallThicknessIn] = useState(0.75); // side/top/bottom/back ply, in
  const [baffleInsetIn, setBaffleInsetIn] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(
    // `!`: "Dusty pink" is one of the swatches
    PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")![0],
  );
  const [cabinetFinish, setCabinetFinish] = useState<FinishId>("birch");
  const [spacerHeightIn, setSpacerHeightIn] = useState(20);
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
