import { useId } from "react";
import type { FoldPathSection, HornSegment } from "../../types";
import {
  FOLD_AREA_GRID_STEPS_IN2,
  FOLD_CHART_MAX_LINES,
  FOLD_PATH_GRID_STEPS_IN,
} from "../../constants/chartScales";
import { FOLD_CHART_TEXT } from "../../constants/speakerPage";
import { targetPathPoints } from "../../lib/speaker/foldMatch";
import { useElementWidth } from "../../hooks/useElementWidth";
import { usePalette } from "../../hooks/useTheme";
import { FONT, SVG_FONT } from "../../styles/fonts";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import { alpha, type Palette } from "../../styles/palette";

/** A point on the chart: the distance from the closed end, in, and the area there, in². */
type PathPoint = Pick<FoldPathSection, "sIn" | "areaIn2">;

interface Props {
  /** the traced passage, every 0.5 in from the closed end (the solid line) */
  sections: readonly FoldPathSection[];
  /** the straight horn the fold should match, throat first (the dashed line) */
  target: readonly HornSegment[];
  /** where the cones open, in from the closed end; null: that side has no cone */
  taps: { front: number | null; back: number | null };
  /** the place pointed at, in from the closed end; null: none (the chart's own pointer or a linked view's) */
  hoverIn: number | null;
  /** called with the distance under the pointer, null when it leaves or is past the path */
  onHover: (sIn: number | null) => void;
}

/** Chart height, px. */
const HEIGHT = 240;

/** The chart's axes: each one's top and gridline spacing, in along the path and in² of area. */
export interface FoldPathAxes {
  pathMaxIn: number;
  pathGridIn: number;
  areaMaxIn2: number;
  areaGridIn2: number;
}

/** The smallest spacing in `steps` that covers `top` in at most `FOLD_CHART_MAX_LINES` gridlines, and the axis top. */
function axisOf(top: number, steps: readonly number[]): { max: number; grid: number } {
  const grid =
    steps.find((g) => Math.ceil(top / g) <= FOLD_CHART_MAX_LINES) ?? steps[steps.length - 1];
  return { max: Math.max(grid, Math.ceil(top / grid) * grid), grid };
}

/** The axes that fit the traced passage and the straight horn: each to the next gridline past the larger. */
export function foldPathAxes(
  sections: readonly FoldPathSection[],
  target: Props["target"],
): FoldPathAxes {
  const points = [...sections, ...targetPathPoints(target)];
  const path = axisOf(Math.max(1, ...points.map((p) => p.sIn)), FOLD_PATH_GRID_STEPS_IN);
  const area = axisOf(Math.max(1, ...points.map((p) => p.areaIn2)), FOLD_AREA_GRID_STEPS_IN2);
  return {
    pathMaxIn: path.max,
    pathGridIn: path.grid,
    areaMaxIn2: area.max,
    areaGridIn2: area.grid,
  };
}

/**
 * The distance along the path, in from the closed end, under a pointer at `xPx` on an axis that runs from `x0` to `x1`
 * (0 to `maxIn`); null off the plot or past the path's end `pathEndIn`.
 */
export function distanceAtPointer(
  xPx: number,
  x0: number,
  x1: number,
  pathEndIn: number,
  maxIn: number,
): number | null {
  const sIn = ((xPx - x0) / (x1 - x0)) * maxIn;
  return sIn >= 0 && sIn <= Math.min(pathEndIn, maxIn) ? sIn : null;
}

/** The section nearest a distance along the path, in; null for a path with no sections. */
export function nearestSection(
  sections: readonly FoldPathSection[],
  sIn: number,
): FoldPathSection | null {
  return sections.reduce<FoldPathSection | null>(
    (best, section) =>
      best === null || Math.abs(section.sIn - sIn) < Math.abs(best.sIn - sIn) ? section : best,
    null,
  );
}

/** The size of the drawing and its margins, px. */
interface Frame {
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  B: number;
}

/** The chart as drawn in one palette: everything but the pointer and the element's measuring. */
export function FoldPathDrawing({
  pal,
  frame,
  clipId,
  sections,
  target,
  taps,
  hoverIn,
  axes,
}: Pick<Props, "sections" | "target" | "taps" | "hoverIn"> & {
  pal: Palette;
  frame: Frame;
  axes: FoldPathAxes;
  /** the id of the plot area's clip, unique on the page */
  clipId: string;
}) {
  const { W, H, L, R, T, B } = frame;
  const x0 = L,
    x1 = W - R,
    y0 = T,
    y1 = H - B;
  const { pathMaxIn, pathGridIn, areaMaxIn2, areaGridIn2 } = axes;
  // past the axes nothing is drawn (the clip)
  const px = (sIn: number) => x0 + (sIn / pathMaxIn) * (x1 - x0);
  const py = (areaIn2: number) => y1 - (areaIn2 / areaMaxIn2) * (y1 - y0);
  const line = (points: readonly PathPoint[]) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${px(p.sIn).toFixed(1)},${py(p.areaIn2).toFixed(1)}`)
      .join("");
  const traced = sections.filter((s) => s.sIn <= pathMaxIn + 1);
  const targetPoints = targetPathPoints(target).filter((p) => p.sIn <= pathMaxIn + 1);
  // a cone with no tap (null) or one past the axis draws no marker
  const tapMarks = [
    { sIn: taps.front, label: FOLD_CHART_TEXT.front },
    { sIn: taps.back, label: FOLD_CHART_TEXT.back },
  ].flatMap((t) =>
    t.sIn !== null && t.sIn >= 0 && t.sIn <= pathMaxIn ? [{ sIn: t.sIn, label: t.label }] : [],
  );
  const near = hoverIn === null ? null : nearestSection(sections, hoverIn);
  const grid: React.ReactElement[] = [];
  for (let s = 0; s <= pathMaxIn; s += pathGridIn) {
    grid.push(
      <line
        key={"v" + s}
        x1={px(s)}
        y1={y0}
        x2={px(s)}
        y2={y1}
        stroke={pal.edge}
        strokeWidth="1"
      />,
      <text
        key={"vt" + s}
        x={px(s)}
        y={y1 + 18}
        textAnchor={s === pathMaxIn ? "end" : "middle"}
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {s}
      </text>,
    );
  }
  for (let a = 0; a <= areaMaxIn2; a += areaGridIn2) {
    grid.push(
      <line
        key={"h" + a}
        x1={x0}
        y1={py(a)}
        x2={x1}
        y2={py(a)}
        stroke={pal.edge}
        strokeWidth="1"
      />,
      <text
        key={"ht" + a}
        x={x0 - 8}
        y={py(a) + 3.5}
        textAnchor="end"
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {a}
      </text>,
    );
  }
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} />
        </clipPath>
      </defs>
      {grid}
      <g clipPath={`url(#${clipId})`}>
        {traced.length > 0 && (
          <>
            <path
              d={`${line(traced)}L${px(traced[traced.length - 1].sIn).toFixed(1)},${y1} L${px(traced[0].sIn).toFixed(1)},${y1} Z`}
              fill={alpha(pal.cyan, 0.15)}
            />
            <path
              data-line="traced"
              d={line(traced)}
              fill="none"
              stroke={pal.cyan}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </>
        )}
        {targetPoints.length > 0 && (
          <path
            data-line="target"
            d={line(targetPoints)}
            fill="none"
            stroke={pal.ink}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        )}
      </g>
      {tapMarks.map((t) => (
        <g key={t.label} data-tap={t.label}>
          <line
            x1={px(t.sIn)}
            y1={y0}
            x2={px(t.sIn)}
            y2={y1}
            stroke={pal.magenta}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <text x={px(t.sIn) + 4} y={y1 - 5} fill={pal.magenta} fontSize="12" fontFamily={SVG_FONT}>
            {t.label}
          </text>
        </g>
      ))}
      {hoverIn !== null && near && (
        <g pointerEvents="none" data-hover="">
          <line
            x1={px(hoverIn)}
            y1={y0}
            x2={px(hoverIn)}
            y2={y1}
            stroke={pal.ink}
            strokeWidth="1"
          />
          <circle cx={px(hoverIn)} cy={py(near.areaIn2)} r="3.5" fill={pal.ink} />
          <text
            x={x1}
            y={y0 - 4}
            textAnchor="end"
            fontSize="12"
            fontFamily={SVG_FONT}
            fill={pal.ink}
            stroke={pal.white}
            strokeWidth="3"
            paintOrder="stroke"
          >
            {FOLD_CHART_TEXT.at(
              hoverIn.toFixed(1),
              near.widthIn.toFixed(1),
              near.areaIn2.toFixed(0),
            )}
          </text>
        </g>
      )}
      <text
        x={(x0 + x1) / 2}
        y={H - 4}
        textAnchor="middle"
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {FOLD_CHART_TEXT.xAxis}
      </text>
      <text
        transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`}
        textAnchor="middle"
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {FOLD_CHART_TEXT.yAxis}
      </text>
    </>
  );
}

/**
 * A folded horn's passage area along its path, in² against in from the closed end, on axes that fit the passage and the
 * straight horn (`foldPathAxes`): the traced passage solid, the straight horn it should match dashed, the
 * places the cones open marked. The hover is linked: the pointer reports the distance it is over, and `hoverIn` draws it.
 */
export function FoldPathChart({ sections, target, taps, hoverIn, onHover }: Props) {
  const pal = usePalette();
  const clipId = useId();
  // drawn in real pixels so text stays 12 px at any width
  const [box, cw] = useElementWidth(760);
  const narrow = cw < 500;
  const frame: Frame = {
    W: Math.max(280, cw),
    H: HEIGHT,
    L: narrow ? 44 : 52,
    R: narrow ? 8 : 14,
    T: 16,
    B: 36,
  };
  const pathEndIn = sections.length ? sections[sections.length - 1].sIn : 0;
  const axes = foldPathAxes(sections, target);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onHover(
      distanceAtPointer(
        ((e.clientX - r.left) / r.width) * frame.W,
        frame.L,
        frame.W - frame.R,
        pathEndIn,
        axes.pathMaxIn,
      ),
    );
  };
  return (
    <div ref={box} className={RESULT_MAX_WIDTH}>
      <svg
        viewBox={`0 0 ${frame.W} ${frame.H}`}
        role="img"
        aria-label={FOLD_CHART_TEXT.label}
        className="select-none"
        style={{ display: "block", width: "100%", height: "auto", touchAction: "pan-y" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => onHover(null)}
      >
        <FoldPathDrawing
          pal={pal}
          frame={frame}
          clipId={clipId}
          sections={sections}
          target={target}
          taps={taps}
          hoverIn={hoverIn}
          axes={axes}
        />
      </svg>
      <div
        className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 text-xs text-stone-500"
        style={{ fontFamily: FONT }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ background: pal.cyan }} />
          {FOLD_CHART_TEXT.traced}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${pal.ink}` }} />
          {FOLD_CHART_TEXT.target}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-0.5"
            style={{ borderTop: `2px dashed ${pal.magenta}` }}
          />
          {FOLD_CHART_TEXT.taps}
        </span>
      </div>
    </div>
  );
}
