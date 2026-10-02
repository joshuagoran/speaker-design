import { DEFAULT_PA } from "../../../lib/defaults";
import type { Dims3, HighpassType, PortStyle, SubDriver, Setter, VentSpec } from "../../../types";
import { useState } from "react";

export interface SubwooferDesign {
  subDriver: SubDriver;
  setSubDriver: Setter<SubDriver>;
  portStyle: PortStyle;
  setPortStyle: Setter<PortStyle>;
  subBoxDims: Dims3;
  setSubBoxDims: Setter<Dims3>;
  subVentSpec: VentSpec;
  setSubVentSpec: Setter<VentSpec>;
  subHighpassHz: number;
  setSubHighpassHz: Setter<number>;
  subHighpassType: HighpassType;
  setSubHighpassType: Setter<HighpassType>;
  subAmpWatts: number;
  setSubAmpWatts: Setter<number>;
  maxPortAirSpeedMs: number;
  setMaxPortAirSpeedMs: Setter<number>;
  setSubBoxDim: (k: keyof Dims3, v: number) => void;
  setSubVentField: (k: keyof VentSpec, v: number) => void;
}

/** State for the subwoofer box: driver, port style, box size, vent, highpass and amp. Every cabinet is custom; presets are only a starting point. */
export function useSubwooferDesign(): SubwooferDesign {
  const [subDriver, setSubDriver] = useState(DEFAULT_PA.sub);
  const [portStyle, setPortStyle] = useState<PortStyle>(DEFAULT_PA.portStyle);
  const [subBoxDims, setSubBoxDims] = useState<Dims3>(DEFAULT_PA.cDim);
  const [subVentSpec, setSubVentSpec] = useState<VentSpec>(DEFAULT_PA.cVent);
  const [subHighpassHz, setSubHighpassHz] = useState(DEFAULT_PA.hpf);
  const [subHighpassType, setSubHighpassType] = useState<HighpassType>(DEFAULT_PA.hpType); // sub highpass alignment
  const [subAmpWatts, setSubAmpWatts] = useState(DEFAULT_PA.ampW); // amp power per sub channel, into 8 Ω
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(DEFAULT_PA.portMax); // peak port air speed allowed, m/s
  const setSubBoxDim = (k: keyof Dims3, v: number) => setSubBoxDims((p) => ({ ...p, [k]: v }));
  const setSubVentField = (k: keyof VentSpec, v: number) =>
    setSubVentSpec((p) => ({ ...p, [k]: v }));
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
