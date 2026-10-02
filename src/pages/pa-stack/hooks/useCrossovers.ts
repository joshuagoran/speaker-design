import { DEFAULT_PA } from "../../../lib/defaults";
import { useState } from "react";
import type { Setter } from "../../../types";

export interface Crossovers {
  subMidCrossoverHz: number;
  setSubMidCrossoverHz: Setter<number>;
  midHornCrossoverHz: number;
  setMidHornCrossoverHz: Setter<number>;
}

/** Crossover frequencies, both Linkwitz-Riley 24 dB. */
export function useCrossovers(): Crossovers {
  const [subMidCrossoverHz, setSubMidCrossoverHz] = useState(DEFAULT_PA.xoLo); // sub -> mid crossover, LR24
  const [midHornCrossoverHz, setMidHornCrossoverHz] = useState(DEFAULT_PA.xoHi); // mid -> horn crossover, LR24
  return {
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
  };
}
