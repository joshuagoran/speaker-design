// The phone summary strip's words and figures (components/ui/SummaryStrip): the PA page's and the Stack page's.

/** Where the strip reads the low end's maximum output, Hz. */
export const SUMMARY_LOW_HZ = 35;

export const SUMMARY_STRIP_TEXT = {
  fb: "Fb",
  low: `${SUMMARY_LOW_HZ} Hz`,
  limit: "Limit",
  /** the PA page's sub box weight, by its layout */
  tower: "Tower",
  sub: "Sub",
  /** the Stack page's weight: the members' */
  weight: "Weight",
  /** a figure the model doesn't give */
  none: "—",
} as const;
