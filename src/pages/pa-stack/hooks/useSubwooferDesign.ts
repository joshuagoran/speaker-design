import { DEFAULT_PA } from "../../../lib/defaults";
import type {
  Dims3,
  HighpassType,
  PanelNominal,
  PortStyle,
  SubDriver,
  Setter,
  VentSpec,
} from "../../../types";
import type { PaDesignInputs } from "../../../lib/pa/paDesign";
import { useState } from "react";

export interface SubwooferDesign extends Pick<
  PaDesignInputs,
  | "subDriver"
  | "portStyle"
  | "subBoxDims"
  | "subVentSpec"
  | "subHighpassHz"
  | "subHighpassType"
  | "subAmpWatts"
  | "maxPortAirSpeedMs"
> {
  setSubDriver: Setter<SubDriver>;
  setPortStyle: Setter<PortStyle>;
  setSubBoxDims: Setter<Dims3>;
  setSubVentSpec: Setter<VentSpec>;
  /** the side ducts' dividers' nominal size (their exact thickness is the Cutlist page's, `subVentSpec.div`) */
  ductDividerPanel: PanelNominal;
  setDuctDividerPanel: Setter<PanelNominal>;
  setSubHighpassHz: Setter<number>;
  setSubHighpassType: Setter<HighpassType>;
  setSubAmpWatts: Setter<number>;
  setMaxPortAirSpeedMs: Setter<number>;
  setSubBoxDim: (k: keyof Dims3, v: number) => void;
  setSubVentField: (k: Exclude<keyof VentSpec, "div">, v: number) => void;
}

/** State for the subwoofer box: driver, port style, box size, vent, highpass and amp. Every cabinet is custom; presets are only a starting point. */
export function useSubwooferDesign(): SubwooferDesign {
  const [subDriver, setSubDriver] = useState(DEFAULT_PA.sub);
  const [portStyle, setPortStyle] = useState<PortStyle>(DEFAULT_PA.portStyle);
  const [subBoxDims, setSubBoxDims] = useState<Dims3>(DEFAULT_PA.cDim);
  const [subVentSpec, setSubVentSpec] = useState<VentSpec>(DEFAULT_PA.cVent);
  const [ductDividerPanel, setDuctDividerPanel] = useState<PanelNominal>(DEFAULT_PA.divider);
  const [subHighpassHz, setSubHighpassHz] = useState(DEFAULT_PA.hpf);
  const [subHighpassType, setSubHighpassType] = useState<HighpassType>(DEFAULT_PA.hpType); // sub highpass alignment
  const [subAmpWatts, setSubAmpWatts] = useState(DEFAULT_PA.ampW); // amp power per sub channel, W into the driver
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(DEFAULT_PA.portMax); // peak port air speed allowed, m/s
  const setSubBoxDim = (k: keyof Dims3, v: number) => setSubBoxDims((p) => ({ ...p, [k]: v }));
  const setSubVentField = (k: Exclude<keyof VentSpec, "div">, v: number) =>
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
    ductDividerPanel,
    setDuctDividerPanel,
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
