/** The list with `item` added at the end, or taken out if it is already in it (tap order). */
export const toggled = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** How many locks are set: each on/off lock that is on, and each box dimension whose lock is not free. */
export const countLocks = (locks: object): number => {
  const values: unknown[] = Object.values(locks);
  return values.reduce<number>(
    (n, v) =>
      n +
      (typeof v === "object" && v !== null
        ? Object.values(v).filter((m) => m && m !== "free").length
        : v
          ? 1
          : 0),
    0,
  );
};
