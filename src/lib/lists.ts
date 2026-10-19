/** The list with `item` added at the end, or taken out if it is already in it (tap order). */
export const toggled = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
