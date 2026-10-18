interface Props {
  /** the band's color (lib/speaker/bandColor `bandColor`, or a chart series' stroke and dash) */
  stroke: string;
  /** a hollow ring (a dashed band's line); false: a filled dot */
  ring: boolean;
}

/**
 * A band's swatch: a small dot in its color, or a hollow ring for a band whose line is dashed. The chart legends, the
 * Bands section and the driver summaries show it.
 */
export function BandSwatch({ stroke, ring }: Props) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={ring ? { border: `2px solid ${stroke}` } : { background: stroke }}
    />
  );
}
