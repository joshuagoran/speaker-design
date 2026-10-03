import type { CrossoverOrder } from "../types";

/** The crossover slopes the PA stack and Hi-fi pages offer, with their names. */
export const CROSSOVER_SLOPES = [
  [4, "LR24"],
  [8, "LR48"],
] as const satisfies readonly (readonly [CrossoverOrder, string])[];

/** A crossover order's name: "LR24" or "LR48". */
export const crossoverSlopeName = (order: CrossoverOrder = 4) => (order === 8 ? "LR48" : "LR24");
