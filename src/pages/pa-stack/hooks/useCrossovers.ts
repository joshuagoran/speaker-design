import { useState } from "react";

export interface Crossovers {
  subMidCrossoverHz: number;
  setSubMidCrossoverHz: React.Dispatch<React.SetStateAction<number>>;
  midHornCrossoverHz: number;
  setMidHornCrossoverHz: React.Dispatch<React.SetStateAction<number>>;
}

/** Crossover frequencies, both Linkwitz-Riley 24 dB. */
export function useCrossovers(): Crossovers {
  const [subMidCrossoverHz, setSubMidCrossoverHz] = useState(120); // sub -> mid crossover, LR24
  const [midHornCrossoverHz, setMidHornCrossoverHz] = useState(900); // mid -> horn crossover, LR24
  return {
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
  };
}
