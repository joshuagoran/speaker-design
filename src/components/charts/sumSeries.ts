// The sum's curve on the Speaker and Stack pages' response charts: one look on both.
import type { FrequencyPoint } from "../../types";
import type { Palette } from "../../styles/palette";
import { alpha } from "../../styles/palette";
import type { Series } from "./ResponseChart";

/** The sum's key on the charts: no band's or member's key takes it (band ids, the Stack's "m0", "m1"…). */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its parts' lines (2 px). */
const SUM_LINE_PX = 4;

/**
 * A sum's series under `label`: in ink, wider than its parts, with a light tint, and left out below the chart's floor
 * (there it would run along the axis as if it were data). `ghost`: faint, so a previewed curve stands out.
 */
export const sumSeries = (
  curve: readonly FrequencyPoint[],
  label: string,
  pal: Pick<Palette, "ink">,
  ghost = false,
): Series => ({
  curve,
  id: SUM_SERIES_ID,
  label,
  stroke: pal.ink,
  width: SUM_LINE_PX,
  tint: alpha(pal.ink, 0.05),
  clipAtFloor: true,
  ghost,
});
