import { MID_OPTIONS, MID_BOXES } from "../../../lib/data";
import type { Dims3, MidBox, MidDriver, MidSize } from "../../../types";
import { useState } from "react";

export interface MidDesign {
  midDriver: MidDriver;
  setMidDriver: React.Dispatch<React.SetStateAction<MidDriver>>;
  midBoxPreset: MidBox;
  setMidBoxPreset: React.Dispatch<React.SetStateAction<MidBox>>;
  midBoxDims: Dims3;
  setMidBoxDims: React.Dispatch<React.SetStateAction<Dims3>>;
  midAmpWatts: number;
  setMidAmpWatts: React.Dispatch<React.SetStateAction<number>>;
  midBandTiltDb: number;
  setMidBandTiltDb: React.Dispatch<React.SetStateAction<number>>;
  setMidBoxDim: (k: keyof Dims3, v: number) => void;
  midSize: MidSize;
  setMidSize: React.Dispatch<React.SetStateAction<MidSize>>;
}

/** State for the mid-bass box: driver, size class, box dimensions, amp power and music balance. */
export function useMidDesign(): MidDesign {
  // `!` on the finds: the ids are in the tables
  const [midDriver, setMidDriver] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12")!);
  const [midBoxPreset, setMidBoxPreset] = useState(MID_BOXES.find((o) => o.id === "b15")!); // last preset loaded
  const [midBoxDims, setMidBoxDims] = useState({ ...MID_BOXES.find((o) => o.id === "b15")!.box });
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
