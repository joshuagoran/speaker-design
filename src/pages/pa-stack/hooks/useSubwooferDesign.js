import { SUB_OPTIONS } from "../../../lib/data.js";
const { useState } = React;

/** State for the subwoofer box: driver, port style, box size, vent, highpass and amp. Every cabinet is custom; presets are only a starting point. */
export function useSubwooferDesign() {
  const [subDriver, setSubDriver] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18"));
  const [portStyle, setPortStyle] = useState("slots");
  const [subBoxDims, setSubBoxDims] = useState({ w: 28, h: 32, d: 24 });
  const [subVentSpec, setSubVentSpec] = useState({ slotH: 3, nt: 2, dia: 6, throat: 3, len: 14 });
  const [subHighpassHz, setSubHighpassHz] = useState(33);
  const [subHighpassType, setSubHighpassType] = useState("BW24");   // sub highpass alignment
  const [subAmpWatts, setSubAmpWatts] = useState(800);   // amp power per sub channel, into 8 Ω
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(20);   // peak port air speed allowed, m/s
  const setSubBoxDim = (k, v) => setSubBoxDims((p) => ({ ...p, [k]: v }));
  const setSubVentField = (k, v) => setSubVentSpec((p) => ({ ...p, [k]: v }));
  return {
    subDriver,
    setSubDriver,
    portStyle,
    setPortStyle,
    subBoxDims,
    setSubBoxDims,
    subVentSpec,
    setSubVentSpec,
    subHighpassHz,
    setSubHighpassHz,
    subHighpassType,
    setSubHighpassType,
    subAmpWatts,
    setSubAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
    setSubBoxDim,
    setSubVentField,
  };
}
