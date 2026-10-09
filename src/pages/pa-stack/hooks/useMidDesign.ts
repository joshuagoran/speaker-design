import { DEFAULT_PA } from "../../../lib/defaults";
import type { Dims3, MidBox, MidDriver, MidSize, Setter } from "../../../types";
import { useState } from "react";

export interface MidDesign {
  midDriver: MidDriver;
  setMidDriver: Setter<MidDriver>;
  midBoxPreset: MidBox;
  setMidBoxPreset: Setter<MidBox>;
  midBoxDims: Dims3;
  setMidBoxDims: Setter<Dims3>;
  midAmpWatts: number;
  setMidAmpWatts: Setter<number>;
  midBelowSubDb: number;
  setMidBelowSubDb: Setter<number>;
  setMidBoxDim: (k: keyof Dims3, v: number) => void;
  midSize: MidSize;
  setMidSize: Setter<MidSize>;
}

/** State for the mid-bass box: driver, size class, box dimensions, amp power and music balance. */
export function useMidDesign(): MidDesign {
  const [midDriver, setMidDriver] = useState(DEFAULT_PA.mid);
  const [midBoxPreset, setMidBoxPreset] = useState(DEFAULT_PA.midBox); // last preset loaded
  const [midBoxDims, setMidBoxDims] = useState<Dims3>(DEFAULT_PA.mDim);
  const [midAmpWatts, setMidAmpWatts] = useState(DEFAULT_PA.mAmpW); // amp power per mid channel, into 8 Ω
  const [midBelowSubDb, setMidBelowSubDb] = useState(DEFAULT_PA.tilt); // the music balance: the mid band level below the sub, dB
  const setMidBoxDim = (k: keyof Dims3, v: number) => setMidBoxDims((p) => ({ ...p, [k]: v }));
  const [midSize, setMidSize] = useState<MidSize>(DEFAULT_PA.midSize);
  return {
    midDriver,
    setMidDriver,
    midBoxPreset,
    setMidBoxPreset,
    midBoxDims,
    setMidBoxDims,
    midAmpWatts,
    setMidAmpWatts,
    midBelowSubDb,
    setMidBelowSubDb,
    setMidBoxDim,
    midSize,
    setMidSize,
  };
}
