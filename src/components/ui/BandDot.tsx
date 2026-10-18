import { usePalette } from "../../hooks/useTheme";
import { bandLine } from "../../styles/palette";
import { BandSwatch } from "./BandSwatch";

interface Props {
  /** the band's place among the speaker's bands, low to high */
  index: number;
  /** how many bands the speaker has */
  count: number;
}

/**
 * A band's swatch (`BandSwatch`) by its place among the bands (`bandLine`), before the band's name or a driver's
 * summary.
 */
export function BandDot({ index, count }: Props) {
  const line = bandLine(usePalette(), index, count);
  return <BandSwatch stroke={line.stroke} ring={line.dash !== undefined} />;
}
