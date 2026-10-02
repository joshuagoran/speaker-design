/** `Object.keys` typed to the record's key union. TypeScript widens keys to string because an object can carry extra keys at runtime; the tables this is used on are closed literals. */
export const keysOf = <K extends string>(o: Record<K, unknown>): K[] => Object.keys(o) as K[]; // boundary cast, see above

/** `Object.entries` typed to the record's key union, for the same reason as `keysOf`. */
export const entriesOf = <K extends string, V>(o: Record<K, V>): [K, V][] =>
  Object.entries(o) as [K, V][]; // boundary cast, see above
