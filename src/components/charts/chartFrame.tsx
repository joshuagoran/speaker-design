import { FREQUENCY_AXIS_TITLE } from "../../constants/chartScales";
import { SVG_FONT } from "../../styles/fonts";
import type { Palette } from "../../styles/palette";

/**
 * What every chart shares, so the charts on a page read as one: the text style, the plot's margins (a frequency sits at
 * the same x on every frequency chart of the same width), the frequency axis and the legend row. A chart file never sets
 * its own text size, weight or plot margin (tests/chart-frame.test.ts).
 */

/** Every chart's text size, px: tick labels, axis titles, marks, in-chart labels and readouts. */
export const CHART_FONT_PX = 12;

/** A small chart's text size, px: the chart on an optimizer result card, 150 px tall. */
export const SMALL_CHART_FONT_PX = 8.5;

/** The weight of a label that names a part on a chart (a box on the coverage map). */
export const CHART_LABEL_WEIGHT = 600;

/** The SVG text attributes every chart's text takes. */
export const CHART_TEXT = { fontSize: CHART_FONT_PX, fontFamily: SVG_FONT } as const;

/** The width a chart draws at before its box is measured, px. */
export const CHART_FALLBACK_WIDTH_PX = 760;

/** The legend row under a chart (its items' alignment is the chart's). */
export const CHART_LEGEND_CLASS =
  "flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-stone-500";

/** Below this width a chart takes its narrow margins and fewer frequency ticks, px. */
const NARROW_CHART_PX = 500;

/** A chart's least width, px. */
const MIN_CHART_WIDTH_PX = 280;

/** The plot's margins, px: room for the y labels (left), the readout (top), and the x labels and axis title (bottom). */
const PLOT_MARGIN = {
  wide: { left: 52, right: 14, top: 16, bottom: 36 },
  narrow: { left: 44, right: 8, top: 16, bottom: 36 },
} as const;

/** The frequency axis's labeled ticks, Hz (those inside the chart's range are drawn). */
const FREQ_TICKS_HZ = {
  wide: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
  narrow: [20, 50, 100, 200, 1000, 5000, 20000],
} as const;

/** A chart's drawing size and its plot area, px. */
export interface PlotFrame {
  W: number;
  H: number;
  narrow: boolean;
  /** the plot area: left, right, top and bottom edges */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Whether a chart `width` px wide takes the narrow margins and fewer frequency ticks. */
export const isNarrowChart = (width: number) => width < NARROW_CHART_PX;

/** The plot frame for a chart `width` px wide (its box's width) and `H` px tall. */
export function plotFrame(width: number, H: number): PlotFrame {
  const narrow = isNarrowChart(width);
  const W = Math.max(MIN_CHART_WIDTH_PX, width);
  const m = PLOT_MARGIN[narrow ? "narrow" : "wide"];
  return { W, H, narrow, x0: m.left, x1: W - m.right, y0: m.top, y1: H - m.bottom };
}

/** Where a frequency sits across the plot: the log axis from `fmin` to `fmax`, Hz. */
export function frequencyX(frame: PlotFrame, fmin: number, fmax: number): (f: number) => number {
  return (f) => frame.x0 + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (frame.x1 - frame.x0);
}

/** A frequency as a tick label: "50", "1k", "20k". */
const frequencyTick = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

/**
 * The frequency axis under a plot: a gridline and a label at each tick, and the axis title. `gridStroke` is the
 * gridlines' color (default the palette's edge; a map draws them over its colors).
 */
export function FrequencyAxis({
  frame,
  fmin,
  fmax,
  pal,
  gridStroke = pal.edge,
}: {
  frame: PlotFrame;
  fmin: number;
  fmax: number;
  pal: Palette;
  gridStroke?: string;
}) {
  const { W, H, x0, x1, y0, y1, narrow } = frame;
  const fx = frequencyX(frame, fmin, fmax);
  const ticks = FREQ_TICKS_HZ[narrow ? "narrow" : "wide"].filter((f) => f >= fmin && f <= fmax);
  return (
    <g>
      {ticks.map((f) => {
        const X = fx(f);
        return (
          <g key={f}>
            <line x1={X} y1={y0} x2={X} y2={y1} stroke={gridStroke} strokeWidth="1" />
            <text
              x={X}
              y={y1 + 18}
              textAnchor={X > x1 - 12 ? "end" : X < x0 + 12 ? "start" : "middle"}
              fill={pal.muted}
              {...CHART_TEXT}
            >
              {frequencyTick(f)}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" fill={pal.muted} {...CHART_TEXT}>
        {FREQUENCY_AXIS_TITLE}
      </text>
    </g>
  );
}

/** How far a y tick label ends left of the plot, px. */
export const Y_TICK_GAP_PX = 8;

/** A y axis's title, turned to run up the left margin. */
export function YAxisTitle({
  frame,
  label,
  pal,
}: {
  frame: PlotFrame;
  label: string;
  pal: Palette;
}) {
  return (
    <text
      transform={`translate(13,${(frame.y0 + frame.y1) / 2}) rotate(-90)`}
      textAnchor="middle"
      fill={pal.muted}
      {...CHART_TEXT}
    >
      {label}
    </text>
  );
}
