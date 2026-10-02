import { DEFAULT_PA } from "../../../lib/defaults";
import { useState } from "react";
import type { CrossoverOrder, Setter } from "../../../types";

export interface Crossovers {
  subMidCrossoverHz: number;
  setSubMidCrossoverHz: Setter<number>;
  midHornCrossoverHz: number;
  setMidHornCrossoverHz: Setter<number>;
  subMidCrossoverOrder: CrossoverOrder;
  setSubMidCrossoverOrder: Setter<CrossoverOrder>;
  midHornCrossoverOrder: CrossoverOrder;
  setMidHornCrossoverOrder: Setter<CrossoverOrder>;
}

/** Crossover frequencies and their Linkwitz-Riley orders (LR24 or LR48), one per crossover. */
export function useCrossovers(): Crossovers {
  const [subMidCrossoverHz, setSubMidCrossoverHz] = useState(DEFAULT_PA.xoLo); // sub -> mid crossover
  const [midHornCrossoverHz, setMidHornCrossoverHz] = useState(DEFAULT_PA.xoHi); // mid -> horn crossover
  const [subMidCrossoverOrder, setSubMidCrossoverOrder] = useState<CrossoverOrder>(
    DEFAULT_PA.xoLoOrder,
  );
  const [midHornCrossoverOrder, setMidHornCrossoverOrder] = useState<CrossoverOrder>(
    DEFAULT_PA.xoHiOrder,
  );
  return {
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
    subMidCrossoverOrder,
    setSubMidCrossoverOrder,
    midHornCrossoverOrder,
    setMidHornCrossoverOrder,
  };
}
