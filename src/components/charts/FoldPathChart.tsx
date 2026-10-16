import { useId } from "react";
import type { FoldPathSection, HornSegment } from "../../types";
import {
  FOLD_AREA_GRID_IN2,
  FOLD_AREA_MAX_IN2,
  FOLD_PATH_GRID_IN,
  FOLD_PATH_MAX_IN,
} from "../../constants/chartScales";
import { FOLD_CHART_TEXT } from "../../constants/speakerPage";
import { CM2_PER_IN2, CM_PER_IN } from "../../constants/units";
import { isSizedSegment, segmentAreaAt } from "../../lib/acoustics/hornSegments";
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

/** The target line is sampled about this often along each segment, in. */
const TARGET_STEP_IN = 0.5;

/** Chart height, px. */
const HEIGHT = 240;

/**
 * The straight horn's area along its length, sampled about every `TARGET_STEP_IN` and at each segment's ends, with the
 * distance from the throat in inches and the area in in². Each segment follows its own flare (`segmentAreaAt`). A
 * segment without sizes (a gap) is left out, so the line never carries NaN.
 */
export function targetPathPoints(target: readonly HornSegment[]): PathPoint[] {
  const points: PathPoint[] = [];
  let startCm = 0;
  for (const segment of target.filter(isSizedSegment)) {
    const steps = Math.max(1, Math.ceil(segment.length / CM_PER_IN / TARGET_STEP_IN));
    for (let k = 0; k <= steps; k++) {
      const alongCm = (k / steps) * segment.length;
      points.push({
        sIn: (startCm + alongCm) / CM_PER_IN,
        areaIn2: segmentAreaAt(segment, alongCm) / CM2_PER_IN2,
      });
    }
    startCm += segment.length;
  }
  return points;
}

/**
 * The distance along the path, in from the closed end, under a pointer at `xPx` on an axis that runs from `x0` to `x1`
 * (the chart's fixed `FOLD_PATH_MAX_IN`); null off the plot or past the path's end `pathEndIn`.
 */
export function distanceAtPointer(
  xPx: number,
  x0: number,
  x1: number,
  pathEndIn: number,
): number | null {
  const sIn = ((xPx - x0) / (x1 - x0)) * FOLD_PATH_MAX_IN;
  return sIn >= 0 && sIn <= Math.min(pathEndIn, FOLD_PATH_MAX_IN) ? sIn : null;
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
}: Pick<Props, "sections" | "target" | "taps" | "hoverIn"> & {
  pal: Palette;
  frame: Frame;
  /** the id of the plot area's clip, unique on the page */
  clipId: string;
}) {
  const { W, H, L, R, T, B } = frame;
  const x0 = L,
    x1 = W - R,
    y0 = T,
    y1 = H - B;
  // past the axes nothing is drawn (the clip); the fixed ranges never follow the data
  const px = (sIn: number) => x0 + (sIn / FOLD_PATH_MAX_IN) * (x1 - x0);
  const py = (areaIn2: number) => y1 - (areaIn2 / FOLD_AREA_MAX_IN2) * (y1 - y0);
  const line = (points: readonly PathPoint[]) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${px(p.sIn).toFixed(1)},${py(p.areaIn2).toFixed(1)}`)
      .join("");
  const traced = sections.filter((s) => s.sIn <= FOLD_PATH_MAX_IN + 1);
  const targetPoints = targetPathPoints(target).filter((p) => p.sIn <= FOLD_PATH_MAX_IN + 1);
  // a cone with no tap (null) or one past the axis draws no marker
  const tapMarks = [
    { sIn: taps.front, label: FOLD_CHART_TEXT.front },
    { sIn: taps.back, label: FOLD_CHART_TEXT.back },
  ].flatMap((t) =>
    t.sIn !== null && t.sIn >= 0 && t.sIn <= FOLD_PATH_MAX_IN
      ? [{ sIn: t.sIn, label: t.label }]
      : [],
  );
  const near = hoverIn === null ? null : nearestSection(sections, hoverIn);
  const grid: React.ReactElement[] = [];
  for (let s = 0; s <= FOLD_PATH_MAX_IN; s += FOLD_PATH_GRID_IN) {
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
        textAnchor={s === FOLD_PATH_MAX_IN ? "end" : "middle"}
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {s}
      </text>,
    );
  }
  for (let a = 0; a <= FOLD_AREA_MAX_IN2; a += FOLD_AREA_GRID_IN2) {
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
 * A folded horn's passage area along its path, in² against in from the closed end, on fixed axes (`FOLD_PATH_MAX_IN`,
 * `FOLD_AREA_MAX_IN2`) so folds compare by eye: the traced passage solid, the straight horn it should match dashed, the
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
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onHover(
      distanceAtPointer(
        ((e.clientX - r.left) / r.width) * frame.W,
        frame.L,
        frame.W - frame.R,
        pathEndIn,
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
