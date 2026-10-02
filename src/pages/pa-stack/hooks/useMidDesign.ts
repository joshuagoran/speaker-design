import { midBoxesOfSize, midDriversOfSize } from "../../../lib/data";
import { defaultOf } from "../../../lib/tables";
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
  midBandTiltDb: number;
  setMidBandTiltDb: Setter<number>;
  setMidBoxDim: (k: keyof Dims3, v: number) => void;
  midSize: MidSize;
  setMidSize: Setter<MidSize>;
}

/** State for the mid-bass box: driver, size class, box dimensions, amp power and music balance. */
export function useMidDesign(): MidDesign {
  const [midDriver, setMidDriver] = useState(() => defaultOf(midDriversOfSize(12), "mid drivers"));
  const [midBoxPreset, setMidBoxPreset] = useState(() =>
    defaultOf(midBoxesOfSize(12), "mid boxes"),
  ); // last preset loaded
  const [midBoxDims, setMidBoxDims] = useState(() => ({
    ...defaultOf(midBoxesOfSize(12), "mid boxes").box,
  }));
  const [midAmpWatts, setMidAmpWatts] = useState(400); // amp power per mid channel, into 8 Ω
  const [midBandTiltDb, setMidBandTiltDb] = useState(6); // how much less the mid band needs than the sub band, dB
  const setMidBoxDim = (k: keyof Dims3, v: number) => setMidBoxDims((p) => ({ ...p, [k]: v }));
  const [midSize, setMidSize] = useState<MidSize>(12);
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
