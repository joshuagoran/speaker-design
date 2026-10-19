import type { CrossoverOrder, HighpassType } from "../types";

/** The crossover slopes the PA stack and Hi-fi pages offer, with their names: one row per order. */
export const CROSSOVER_SLOPES = [
  [4, "LR24"],
  [8, "LR48"],
] as const satisfies readonly (readonly [CrossoverOrder, HighpassType])[];

/** A crossover slope's name, as the table spells it. */
export type CrossoverSlopeName = (typeof CROSSOVER_SLOPES)[number][1];

/** A crossover order's name: "LR24" or "LR48". */
export function crossoverSlopeName(order: CrossoverOrder): CrossoverSlopeName {
  for (const [o, name] of CROSSOVER_SLOPES) if (o === order) return name;
  throw new Error(`No crossover slope for order ${order}`);
}
