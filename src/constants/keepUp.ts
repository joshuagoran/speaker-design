// The keep-up check's words (lib/speaker/keepUp): the Speaker page's bands and the Stack page's members, as the PA
// page's "Mid limits first" and "Horn limits first" checks say them (lib/pa/chips).

export const KEEP_UP_TEXT = {
  /** the upper part limits first: its name */
  shortTitle: (upper: string) => `${upper} limits first`,
  /** how short it is, dB (already formatted), where, and the part under it */
  shortDetail: (gap: string, hz: string, upper: string, lower: string) =>
    `${upper} is ${gap} dB short at ${hz} when ${lower} is at its music limit. Raise the crossover, give ${upper} more amp power, or use a driver that plays louder.`,
  /** the upper part keeps up: the part under it */
  okTitle: (lower: string) => `Keeps up with ${lower}`,
  okDetail: (gap: string, hz: string, lower: string) =>
    `${gap} dB to spare at ${hz} when ${lower} is at its music limit.`,
} as const;
