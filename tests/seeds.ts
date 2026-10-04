/**
 * The saved seed designs (data/configs-seed.json) the tests pick by name. The names are the seeds' own, so golden.json
 * keys on them too; a test refers to a seed through this table, never by typing its name.
 */
export const SEED_NAMES = {
  lilBlockOptimized: "lil block stack LE (optimized)",
  lilBlock: "lil block stack LE",
  lightBlock: "light block",
  blocky: "blocky",
  lilTower: "lil tower",
} as const;
