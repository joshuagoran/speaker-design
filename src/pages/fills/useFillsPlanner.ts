import { DEFAULT_FILL } from "../../lib/defaults";
import type {
  Dims3,
  FillBoxType,
  FillDesignState,
  FillDriver,
  FillPort,
  Setter,
} from "../../types";
import { useState } from "react";

export interface FillsPlanner extends FillDesignState {
  setDriver: Setter<FillDriver>;
  setBoxType: Setter<FillBoxType>;
  setBoxDims: Setter<Dims3>;
  setBoxDim: (k: keyof Dims3, v: number) => void;
  setPortSpec: Setter<FillPort>;
  setPortField: (k: keyof FillPort, v: number) => void;
  setHighpassHz: Setter<number>;
  setAmpWatts: Setter<number>;
  setMaxPortAirSpeedMs: Setter<number>;
}

/** The Fills page's design. Held by App so it survives switching tabs, like the PA and Hi-fi designs. */
export function useFillsPlanner(): FillsPlanner {
  const [driver, setDriver] = useState<FillDriver>(DEFAULT_FILL.driver);
  const [boxType, setBoxType] = useState<FillBoxType>(DEFAULT_FILL.boxType);
  const [boxDims, setBoxDims] = useState<Dims3>(DEFAULT_FILL.boxDims);
  const [portSpec, setPortSpec] = useState<FillPort>(DEFAULT_FILL.portSpec);
  const [highpassHz, setHighpassHz] = useState(DEFAULT_FILL.highpassHz);
  const [ampWatts, setAmpWatts] = useState(DEFAULT_FILL.ampWatts);
  const [maxPortAirSpeedMs, setMaxPortAirSpeedMs] = useState(DEFAULT_FILL.maxPortAirSpeedMs);
  const setBoxDim = (k: keyof Dims3, v: number) => setBoxDims((p) => ({ ...p, [k]: v }));
  const setPortField = (k: keyof FillPort, v: number) => setPortSpec((p) => ({ ...p, [k]: v }));
  return {
    driver,
    setDriver,
    boxType,
    setBoxType,
    boxDims,
    setBoxDims,
    setBoxDim,
    portSpec,
    setPortSpec,
    setPortField,
    highpassHz,
    setHighpassHz,
    ampWatts,
    setAmpWatts,
    maxPortAirSpeedMs,
    setMaxPortAirSpeedMs,
  };
}
