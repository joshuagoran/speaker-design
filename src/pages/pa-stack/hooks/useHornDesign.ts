import { CD_OPTIONS, HORN_OPTIONS } from "../../../lib/data";
import { defaultOf } from "../../../lib/tables";
import type { CompressionDriver, Horn, Setter } from "../../../types";
import { useState } from "react";

export interface HornDesign {
  hornOption: Horn;
  setHornOption: Setter<Horn>;
  compressionDriver: CompressionDriver;
  setCompressionDriver: Setter<CompressionDriver>;
  hornAmpWatts: number;
  setHornAmpWatts: Setter<number>;
  hornBandTiltDb: number;
  setHornBandTiltDb: Setter<number>;
}

/** State for the horn and compression driver: parts, HF amp power and music balance. */
export function useHornDesign(): HornDesign {
  const [hornOption, setHornOption] = useState(() => defaultOf(HORN_OPTIONS, "horns"));
  const [compressionDriver, setCompressionDriver] = useState(() =>
    defaultOf(CD_OPTIONS, "compression drivers"),
  );
  const [hornAmpWatts, setHornAmpWatts] = useState(100); // amp power per HF channel, rated into 8 Ω
  const [hornBandTiltDb, setHornBandTiltDb] = useState(6); // how much less the horn band needs than the mid band, dB
  return {
    hornOption,
    setHornOption,
    compressionDriver,
    setCompressionDriver,
    hornAmpWatts,
    setHornAmpWatts,
    hornBandTiltDb,
    setHornBandTiltDb,
  };
}
