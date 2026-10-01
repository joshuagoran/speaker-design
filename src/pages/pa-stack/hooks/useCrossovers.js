const { useState } = React;

/** Crossover frequencies, both Linkwitz-Riley 24 dB. */
export function useCrossovers() {
  const [subMidCrossoverHz, setSubMidCrossoverHz] = useState(120);         // sub -> mid crossover, LR24
  const [midHornCrossoverHz, setMidHornCrossoverHz] = useState(900);         // mid -> horn crossover, LR24
  return {
    subMidCrossoverHz,
    setSubMidCrossoverHz,
    midHornCrossoverHz,
    setMidHornCrossoverHz,
  };
}
