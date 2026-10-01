import { MID_OPTIONS, MID_BOXES } from "../../../lib/data.js";
const { useState } = React;

/** State for the mid-bass box: driver, size class, box dimensions, amp power and music balance. */
export function useMidDesign() {
  const [midDriver, setMidDriver] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12"));
  const [midBoxPreset, setMidBoxPreset] = useState(MID_BOXES.find((o) => o.id === "b15"));   // last preset loaded
  const [midBoxDims, setMidBoxDims] = useState({ ...MID_BOXES.find((o) => o.id === "b15").box });
  const [midAmpWatts, setMidAmpWatts] = useState(400);       // amp power per mid channel, into 8 Ω
  const [midBandTiltDb, setMidBandTiltDb] = useState(6);           // how much less the mid band needs than the sub band, dB
  const setMidBoxDim = (k, v) => setMidBoxDims((p) => ({ ...p, [k]: v }));
  const [midSize, setMidSize] = useState(12);
  return {
    midDriver,
    setMidDriver,
    midBoxPreset,
    setMidBoxPreset,
    midBoxDims,
    setMidBoxDims,
    midAmpWatts,
    setMidAmpWatts,
    midBandTiltDb,
    setMidBandTiltDb,
    setMidBoxDim,
    midSize,
    setMidSize,
  };
}
