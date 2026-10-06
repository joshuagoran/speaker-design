/** `Object.keys` typed to the record's key union. TypeScript widens keys to string because an object can carry extra keys at runtime; the tables this is used on are closed literals. */
export const keysOf = <K extends string>(o: Record<K, unknown>): K[] => Object.keys(o) as K[]; // boundary cast, see above

/** `Object.entries` typed to the record's key union, for the same reason as `keysOf`. */
export const entriesOf = <K extends string, V>(o: Record<K, V>): [K, V][] =>
  Object.entries(o) as [K, V][]; // boundary cast, see above

/** The fields of `o` under `keys` that are set, and no others (a stored record less what an older version kept). */
export function pickDefined<T extends object, K extends keyof T>(
  o: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
