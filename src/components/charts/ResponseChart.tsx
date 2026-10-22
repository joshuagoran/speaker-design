import type { BandCurves, FrequencyPoint } from "../../types";
import { MAX_OUTPUT_BOT, MAX_OUTPUT_TOP } from "../../constants/chartScales";
import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useElementWidth } from "../../hooks/useElementWidth";
import { useState } from "react";
import { SVG_FONT, FONT } from "../../styles/fonts";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import { HOVER_TRANSITION } from "../ui/buttonStyles";
import { BandSwatch } from "../ui/BandSwatch";

/**
 * One curve on the chart: its points, legend label, line color and fill color. `band` shades the curve at the low and
 * high ends of an estimated Xmax (see `lib/xmax`); null or absent when the driver's Xmax is exact.
 */
interface Series {
  /** a stable key where labels can repeat (user-named bands); absent: the label */
  id?: string;
  curve: readonly FrequencyPoint[];
  label: string;
  stroke: string;
  tint: string;
  band?: BandCurves<FrequencyPoint> | null;
  /** a dashed line (its SVG dash pattern), for a curve that shares another's color; absent: solid */
  dash?: string;
  /** the line's width, px; absent: 2 (a sum drawn over its parts takes more) */
  width?: number;
  /** the legend's swatch: "dot", a band's dot (a hollow ring when dashed, `BandSwatch`); absent: a short line */
  swatch?: "dot";
  /**
   * leave the line out where it is below the chart's floor, so it does not run along the axis as if it were data;
   * absent: drawn along the floor
   */
  clipAtFloor?: boolean;
  /**
   * a placeholder: no line, and its legend item keeps its room but shows nothing, so a curve that comes and goes (a
   * previewed option) doesn't move what is under the pointer
   */
  hidden?: boolean;
  /**
   * its legend item takes one line of its own, cut to the width: the legend's height then never hangs on the label (a
   * previewed option's name), so nothing below it moves
   */
  ownLine?: boolean;
  /** drawn faint, so another curve stands out against it (your design's curves while an option is previewed) */
  ghost?: boolean;
}

/** A ghosted curve's opacity, and any curve's while another curve's legend item is under the pointer. */
const FADED_OPACITY = 0.2;

/** A labeled vertical line at a frequency. */
interface Mark {
  f: number;
  label: string;
}

interface Props {
  series: readonly Series[];
  marks?: readonly Mark[];
  /** a shaded frequency range (the band a map averages), Hz */
  span?: { lo: number; hi: number };
  fmax?: number;
  fmin?: number;
  /** fixed y axis, dB (or degrees for a beamwidth chart): defaults to the maximum-output scale (MAX_OUTPUT_TOP / MAX_OUTPUT_BOT); a response chart passes HIFI_TOP / HIFI_BOT */
  top?: number;
  bot?: number;
  /** gridline spacing on the y axis */
  step?: number;
  yLabel?: string;
  /** what the hover readout puts after each value: " dB", or "°" on a beamwidth chart */
  unit?: string;
  /** height in px */
  H?: number;
}

/** Max-SPL chart: one or more curves ({f, spl}), on a fixed scale so setups compare directly. */
export function ResponseChart({
  series,
  marks = [],
  span,
  fmax = 200,
  fmin = 15,
  top = MAX_OUTPUT_TOP,
  bot = MAX_OUTPUT_BOT,
  step = 5,
  yLabel = "max dB SPL @ 1 m",
  unit = " dB",
  H = 300,
}: Props) {
  const pal = usePalette();
  // drawn in real pixels so text stays 11 px at any width
  const [box, cw] = useElementWidth(760);
  const narrow = cw < 500;
  const W = Math.max(280, cw),
    L = narrow ? 44 : 52,
    R = narrow ? 8 : 14,
    TT = 16,
    B = 36;
  if (narrow && H >= 300) H = Math.round(H * 0.8);
  const x0 = L,
    x1 = W - R,
    y0 = TT,
    y1 = H - B;
  const TOP = top,
    BOT = bot;
  const px = (f: number) => x0 + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (x1 - x0);
  const py = (v: number) =>
    y1 - ((Math.max(BOT, Math.min(TOP, v)) - BOT) / (TOP - BOT)) * (y1 - y0);
  const paths = series.map((sr) => {
    const pts = sr.curve.filter((o) => o.f >= fmin && o.f <= fmax);
    /** where the line between two points crosses the floor, on the log frequency axis */
    const atFloor = (a: FrequencyPoint, b: FrequencyPoint): FrequencyPoint => {
      const t = (BOT - a.spl) / (b.spl - a.spl);
      return { f: a.f * (b.f / a.f) ** t, spl: BOT };
    };
    // the runs of points the line draws: all of them, or (clipped at the floor) each run on or above the floor, each
    // run down to where it crosses the floor, so a null reads as one
    const runs = sr.clipAtFloor
      ? pts.reduce<FrequencyPoint[][]>((list, p, i) => {
          const prev = i > 0 ? pts[i - 1] : null;
          if (p.spl < BOT) {
            if (prev && prev.spl >= BOT) list[list.length - 1].push(atFloor(prev, p));
            return list;
          }
          if (prev && prev.spl >= BOT) list[list.length - 1].push(p);
          else list.push(prev ? [atFloor(prev, p), p] : [p]);
          return list;
        }, [])
      : [pts];
    const runD = (run: readonly FrequencyPoint[]) =>
      run.map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1)).join("");
    const d = runs.map(runD).join("");
    // the band: along the high curve, back along the low one (none unless both have points on the chart)
    const inRange = (c: readonly FrequencyPoint[]) => c.filter((o) => o.f >= fmin && o.f <= fmax);
    const bandHi = sr.band ? inRange(sr.band.hi) : [],
      bandLo = sr.band ? inRange(sr.band.lo) : [];
    const band =
      bandHi.length && bandLo.length
        ? [...bandHi, ...bandLo.reverse()]
            .map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1))
            .join("") + "Z"
        : "";
    return {
      ...sr,
      d,
      bandD: band,
      // each run filled down to the floor
      fill: runs
        .filter((run) => run.length)
        .map(
          (run) =>
            runD(run) +
            `L${px(run[run.length - 1].f).toFixed(1)},${y1} L${px(run[0].f).toFixed(1)},${y1} Z`,
        )
        .join(""),
    };
  });
  const ticks = (
    narrow
      ? [20, 50, 100, 200, 1000, 5000, 20000]
      : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  ).filter((f) => f >= fmin && f <= fmax);
  const grid: React.ReactElement[] = [];
  ticks.forEach((f) => {
    const X = px(f);
    grid.push(
      <line key={"v" + f} x1={X} y1={y0} x2={X} y2={y1} stroke={pal.edge} strokeWidth="1" />,
    );
    grid.push(
      <text
        key={"vt" + f}
        x={X}
        y={y1 + 18}
        textAnchor={X > x1 - 12 ? "end" : "middle"}
        fill={pal.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {f >= 1000 ? f / 1000 + "k" : f}
      </text>,
    );
  });
  /** the curve whose legend item is under the pointer: the other curves fade back */
  const [hot, setHot] = useState<string | null>(null);
  const keyOf = (p: Pick<Series, "id" | "label">) => p.id ?? p.label;
  /** a curve's opacity: faded while another curve's legend item is under the pointer, or while it is a ghost */
  const faded = (p: Pick<Series, "id" | "label" | "ghost">) =>
    hot !== null ? (hot === keyOf(p) ? 1 : FADED_OPACITY) : p.ghost ? FADED_OPACITY : 1;
  // hover / drag: a crosshair with each curve's value at that frequency
  const [hf, setHf] = useState<number | null>(null);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      X = ((e.clientX - r.left) / r.width) * W;
    setHf(X >= x0 && X <= x1 ? fmin * Math.pow(fmax / fmin, (X - x0) / (x1 - x0)) : null);
  };
  const hits = hf
    ? paths
        .filter((p) => !p.hidden)
        .map((p) => {
          // a curve clipped at the floor reads nothing where it is not drawn
          const pts = p.curve.filter(
            (o) => o.f >= fmin && o.f <= fmax && (!p.clipAtFloor || o.spl >= BOT),
          );
          const o = pts.length
            ? pts.reduce((b, q) =>
                Math.abs(Math.log(q.f / hf)) < Math.abs(Math.log(b.f / hf)) ? q : b,
              )
            : null;
          return o && Math.abs(Math.log(o.f / hf)) < 0.1 ? { ...p, o } : null;
        })
        .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    : [];
  const every = ((y1 - y0) * step) / (TOP - BOT) < 16 ? 2 : 1; // thin the labels when rows get tight
  for (let v = BOT, k = 0; v <= TOP; v += step, k++) {
    const Y = py(v);
    grid.push(
      <line key={"h" + v} x1={x0} y1={Y} x2={x1} y2={Y} stroke={pal.edge} strokeWidth="1" />,
    );
    if (k % every === 0)
      grid.push(
        <text
          key={"ht" + v}
          x={x0 - 8}
          y={Y + 3.5}
          textAnchor="end"
          fill={pal.muted}
          fontSize="12"
          fontFamily={SVG_FONT}
        >
          {v}
        </text>,
      );
  }
  return (
    <div ref={box} className={RESULT_MAX_WIDTH}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${yLabel} against frequency`}
        className="select-none"
        style={{ display: "block", width: "100%", height: "auto", touchAction: "pan-y" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHf(null)}
      >
        {span && (
          <rect
            x={px(Math.max(fmin, span.lo))}
            y={y0}
            width={Math.max(0, px(Math.min(fmax, span.hi)) - px(Math.max(fmin, span.lo)))}
            height={y1 - y0}
            fill={alpha(pal.cyan, 0.08)}
          />
        )}
        {grid}
        {marks
          .filter((m) => m.f > fmin && m.f < fmax)
          .map((m, i, ms) => (
            <g key={m.label + i}>
              <line
                x1={px(m.f)}
                y1={y0}
                x2={px(m.f)}
                y2={y1}
                stroke={pal.muted}
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={px(m.f) + 5}
                y={
                  y0 + 13 + (ms.slice(0, i).some((o) => Math.abs(px(o.f) - px(m.f)) < 70) ? 14 : 0)
                }
                fill={pal.muted}
                fontSize="12"
                fontFamily={SVG_FONT}
              >
                {m.label}
              </text>
            </g>
          ))}
        {paths.map((p) => (
          <path
            key={(p.id ?? p.label) + "f"}
            d={p.fill}
            fill={p.tint}
            style={{ opacity: faded(p) }}
            className={HOVER_TRANSITION}
          />
        ))}
        {paths.map((p) =>
          p.bandD ? (
            <path
              key={(p.id ?? p.label) + "b"}
              d={p.bandD}
              fill={alpha(p.stroke, 0.18)}
              stroke="none"
              style={{ opacity: faded(p) }}
              className={HOVER_TRANSITION}
            />
          ) : null,
        )}
        {paths
          .filter((p) => !p.hidden)
          .map((p) => (
            <path
              key={p.id ?? p.label}
              d={p.d}
              fill="none"
              stroke={p.stroke}
              strokeWidth={p.width ?? 2}
              strokeDasharray={p.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ opacity: faded(p) }}
              className={HOVER_TRANSITION}
            />
          ))}
        {hf && (
          <g pointerEvents="none">
            <line x1={px(hf)} x2={px(hf)} y1={y0} y2={y1} stroke={pal.muted} strokeWidth="1" />
            {hits.map((h) => (
              <circle
                key={h.label}
                cx={px(h.o.f)}
                cy={py(h.o.spl)}
                r="3.5"
                fill={h.stroke}
                stroke={pal.white}
                strokeWidth="1.5"
              />
            ))}
            {(() => {
              const t = `${hf >= 1000 ? (hf / 1000).toFixed(hf >= 10000 ? 0 : 1) + "k" : hf.toFixed(0)} Hz`,
                w = t.length * 6.5 + 8,
                X = Math.max(x0 + w / 2, Math.min(x1 - w / 2, px(hf)));
              return (
                <g>
                  <rect x={X - w / 2} y={y1 + 5} width={w} height={17} rx="3" fill={pal.ink} />
                  <text
                    x={X}
                    y={y1 + 17.5}
                    textAnchor="middle"
                    fontSize="12"
                    fontFamily={SVG_FONT}
                    fill={pal.white}
                  >
                    {t}
                  </text>
                </g>
              );
            })()}
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
              {hf >= 1000 ? (hf / 1000).toFixed(hf >= 10000 ? 0 : 1) + "k" : hf.toFixed(0)} Hz
              {hits.map((h) => ` · ${h.label} ${h.o.spl.toFixed(0)}${unit}`).join("")}
            </text>
          </g>
        )}
        <text
          x={W / 2}
          y={H - 4}
          textAnchor="middle"
          fill={pal.muted}
          fontSize="12"
          fontFamily={SVG_FONT}
        >
          frequency, Hz
        </text>
        <text
          transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`}
          textAnchor="middle"
          fill={pal.muted}
          fontSize="12"
          fontFamily={SVG_FONT}
        >
          {yLabel}
        </text>
      </svg>
      {paths.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 text-xs text-stone-500"
          style={{ fontFamily: FONT }}
        >
          {paths.map((p) => (
            <span
              key={p.id ?? p.label}
              // a pointer over it or keyboard focus on it brings its curve forward
              tabIndex={p.hidden ? -1 : 0}
              aria-hidden={p.hidden}
              className={`flex items-center gap-1.5 cursor-default rounded hover:text-stone-900 focus-visible:text-stone-900 ${p.hidden ? "invisible" : ""} ${p.ownLine ? "basis-full justify-center min-w-0" : ""} ${HOVER_TRANSITION}`}
              onMouseEnter={() => setHot(keyOf(p))}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(keyOf(p))}
              onBlur={() => setHot(null)}
            >
              {p.swatch === "dot" ? (
                <BandSwatch stroke={p.stroke} ring={p.dash !== undefined} />
              ) : (
                <span
                  className="inline-block w-4 h-0.5"
                  style={
                    p.dash ? { borderTop: `2px dashed ${p.stroke}` } : { background: p.stroke }
                  }
                />
              )}
              {p.ownLine ? <span className="truncate min-w-0">{p.label}</span> : p.label}
            </span>
          ))}
          {paths.some((p) => p.bandD) && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-2.5 rounded-sm"
                style={{ background: alpha(pal.ink, 0.18) }}
              />
              Xmax estimated: shaded range
            </span>
          )}
        </div>
      )}
    </div>
  );
}
