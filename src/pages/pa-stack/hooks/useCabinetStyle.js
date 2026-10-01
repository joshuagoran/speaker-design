import { PAINT_SWATCHES, CABINETS, FORMATS } from "../../../lib/data.js";
const { useState } = React;

/** Cabinet construction and look: plywood, baffle inset, finish, layout and the fixed plinth. */
export function useCabinetStyle() {
  const plinthHeightIn = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet] = useState(CABINETS[0]);
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [wallThicknessIn, setWallThicknessIn] = useState(0.75);   // side/top/bottom/back ply, in
  const [baffleInsetIn, setBaffleInsetIn] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState(PAINT_SWATCHES.find(([, name]) => name === "Dusty pink")[0]);
  const [cabinetFinish, setCabinetFinish] = useState("birch");
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
