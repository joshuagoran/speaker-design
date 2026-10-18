import { usePalette } from "../../hooks/useTheme";
import { bandLine } from "../../styles/palette";

interface Props {
  /** the band's place among the speaker's bands, low to high */
  index: number;
  /** how many bands the speaker has */
  count: number;
}

/**
 * A small dot in a band's chart color (`bandLine`), before the band's name or a driver's summary: filled, or a hollow
 * ring for a band whose line is dashed.
 */
export function BandDot({ index, count }: Props) {
  const line = bandLine(usePalette(), index, count);
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      className="inline-block shrink-0 w-[9px] h-[9px] align-middle mr-1.5"
    >
      {line.dash ? (
        <circle cx="5" cy="5" r="3.9" fill="none" stroke={line.stroke} strokeWidth="1.8" />
      ) : (
        <circle cx="5" cy="5" r="5" fill={line.stroke} />
      )}
    </svg>
  );
}
