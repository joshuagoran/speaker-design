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

/** The PA stack's two slopes in words: one name when they match, else each crossover's. */
export const crossoverSlopesText = (lo: CrossoverOrder, hi: CrossoverOrder) =>
  lo === hi
    ? crossoverSlopeName(lo)
    : `sub to mid ${crossoverSlopeName(lo)}, mid to horn ${crossoverSlopeName(hi)}`;

/** A saved crossover order: LR48 when it says 8, else LR24 (saves from before the setting have none). */
export const savedCrossoverOrder = (order: unknown): CrossoverOrder => (order === 8 ? 8 : 4);
