import { DEFAULT_PA } from "../../../lib/defaults";
import type { CompressionDriver, Horn, Setter } from "../../../types";
import type { PaDesignInputs } from "../../../lib/pa/paDesign";
import { useState } from "react";

export interface HornDesign extends Pick<
  PaDesignInputs,
  "hornOption" | "compressionDriver" | "hornAmpWatts"
> {
  setHornOption: Setter<Horn>;
  setCompressionDriver: Setter<CompressionDriver>;
  setHornAmpWatts: Setter<number>;
  hornBelowMidDb: number;
  setHornBelowMidDb: Setter<number>;
}

/** State for the horn and compression driver: parts, HF amp power and music balance. */
export function useHornDesign(): HornDesign {
  const [hornOption, setHornOption] = useState(DEFAULT_PA.horn);
  const [compressionDriver, setCompressionDriver] = useState(DEFAULT_PA.cd);
  const [hornAmpWatts, setHornAmpWatts] = useState(DEFAULT_PA.hfAmpW); // amp power per HF channel, rated into 8 Ω
  const [hornBelowMidDb, setHornBelowMidDb] = useState(DEFAULT_PA.hfTilt); // the music balance: the horn band level below the mid, dB
  return {
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBelowMidDb,
    setHornBelowMidDb,
  };
}
