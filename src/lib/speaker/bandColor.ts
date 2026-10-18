// A Speaker page band's one color, the same everywhere it shows: its chart line (styles/palette `bandLine`), the swatch
// in the chart legends, the Bands section and the driver summaries, and its drivers in the 2D views.
import { bandLine, type Palette } from "../../styles/palette";
import type { BandId, SpeakerBand } from "../../types";

/** A band's color: its line's stroke and dash, and whether its swatch is a hollow ring (a dashed band) or a filled dot. */
export interface BandColor {
  stroke: string;
  /** the line's SVG dash pattern; absent: solid */
  dash?: string;
  /** the swatch is a hollow ring (the band's line is dashed); false: a filled dot */
  ring: boolean;
}

/**
 * The color of band `bandId` by its place among `bands`, low to high (`bandLine`): the lowest yellow, the highest cyan,
 * the ones between magenta, every second one dashed. A band id the list doesn't have takes the muted gray.
 */
export function bandColor(
  bands: readonly Pick<SpeakerBand, "id">[],
  bandId: BandId,
  pal: Pick<Palette, "yellowLine" | "magenta" | "cyan" | "muted">,
): BandColor {
  const index = bands.findIndex((b) => b.id === bandId);
  if (index < 0) return { stroke: pal.muted, ring: false };
  const line = bandLine(pal, index, bands.length);
  return { ...line, ring: line.dash !== undefined };
}
