import { SUB_OPTIONS } from "../../../lib/data";
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
  // `!`: the id is in the table
  const [subDriver, setSubDriver] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18")!);
  const [portStyle, setPortStyle] = useState<PortStyle>("slots");
  const [subBoxDims, setSubBoxDims] = useState<Dims3>({ w: 28, h: 32, d: 24 });
  const [subVentSpec, setSubVentSpec] = useState<VentSpec>({
    slotH: 3,
    nt: 2,
    dia: 6,
    throat: 3,
    len: 14,
  });
  const [subHighpassHz, setSubHighpassHz] = useState(33);
  const [subHighpassType, setSubHighpassType] = useState<HighpassType>("BW24"); // sub highpass alignment
  const [subAmpWatts, setSubAmpWatts] = useState(800); // amp power per sub channel, into 8 Ω
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(20); // peak port air speed allowed, m/s
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
