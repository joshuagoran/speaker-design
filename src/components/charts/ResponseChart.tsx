import type { BandCurves, FrequencyPoint } from "../../types";
import { PA_DB_BOT, PA_DB_TOP } from "../../constants/chartScales";
import { PAL } from "../../styles/palette";
import { useElementWidth } from "../../hooks/useElementWidth";
import { useState } from "react";
import { SVG_FONT, FONT } from "../../styles/fonts";

/**
 * One curve on the chart: its points, legend label, line colour and fill colour. `band` shades the curve at the low and
 * high ends of an estimated Xmax (see `lib/xmax`); null or absent when the driver's Xmax is exact.
 */
interface Series {
  curve: readonly FrequencyPoint[];
  label: string;
  stroke: string;
  tint: string;
  band?: BandCurves<FrequencyPoint> | null;
}

/** A labelled vertical line at a frequency. */
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
  /** fixed y axis, dB (or degrees for a beamwidth chart): defaults to the PA stack's 80-135 dB; the Hi-fi charts pass HIFI_TOP / HIFI_BOT */
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

/** Max-SPL chart: one or more curves ({f, spl}), fixed 80-135 dB so setups compare directly. */
export function ResponseChart({
  series,
  marks = [],
  span,
  fmax = 200,
  fmin = 15,
  top = PA_DB_TOP,
  bot = PA_DB_BOT,
  step = 5,
  yLabel = "max dB SPL @ 1 m",
  unit = " dB",
  H = 300,
}: Props) {
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
    const d = pts
      .map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1))
      .join("");
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
      fill: pts.length
        ? d + `L${px(pts[pts.length - 1].f).toFixed(1)},${y1} L${px(pts[0].f).toFixed(1)},${y1} Z`
        : "",
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
      <line key={"v" + f} x1={X} y1={y0} x2={X} y2={y1} stroke={PAL.edge} strokeWidth="1" />,
    );
    grid.push(
      <text
        key={"vt" + f}
        x={X}
        y={y1 + 18}
        textAnchor={X > x1 - 12 ? "end" : "middle"}
        fill={PAL.muted}
        fontSize="12"
        fontFamily={SVG_FONT}
      >
        {f >= 1000 ? f / 1000 + "k" : f}
      </text>,
    );
  });
  // hover / drag: a crosshair with each curve's value at that frequency
  const [hf, setHf] = useState<number | null>(null);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      X = ((e.clientX - r.left) / r.width) * W;
    setHf(X >= x0 && X <= x1 ? fmin * Math.pow(fmax / fmin, (X - x0) / (x1 - x0)) : null);
  };
  const hits = hf
    ? (paths
        .map((p) => {
          const pts = p.curve.filter((o) => o.f >= fmin && o.f <= fmax);
          const o = pts.length
            ? pts.reduce((b, q) =>
                Math.abs(Math.log(q.f / hf)) < Math.abs(Math.log(b.f / hf)) ? q : b,
              )
            : null;
          return o && Math.abs(Math.log(o.f / hf)) < 0.1 ? { ...p, o } : null;
        })
        // `as`: filter(Boolean) drops the nulls, which TypeScript doesn't track
        .filter(Boolean) as (Series & { o: FrequencyPoint })[])
    : [];
  const every = ((y1 - y0) * step) / (TOP - BOT) < 16 ? 2 : 1; // thin the labels when rows get tight
  for (let v = BOT, k = 0; v <= TOP; v += step, k++) {
    const Y = py(v);
    grid.push(
      <line key={"h" + v} x1={x0} y1={Y} x2={x1} y2={Y} stroke={PAL.edge} strokeWidth="1" />,
    );
    if (k % every === 0)
      grid.push(
        <text
          key={"ht" + v}
          x={x0 - 8}
          y={Y + 3.5}
          textAnchor="end"
          fill={PAL.muted}
          fontSize="12"
          fontFamily={SVG_FONT}
        >
          {v}
        </text>,
      );
  }
  return (
    <div ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${yLabel} against frequency`}
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
            fill={PAL.alpha(PAL.cyan, 0.08)}
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
                stroke={PAL.muted}
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={px(m.f) + 5}
                y={
                  y0 + 13 + (ms.slice(0, i).some((o) => Math.abs(px(o.f) - px(m.f)) < 70) ? 14 : 0)
                }
                fill={PAL.muted}
                fontSize="12"
                fontFamily={SVG_FONT}
              >
                {m.label}
              </text>
            </g>
          ))}
        {paths.map((p) => (
          <path key={p.label + "f"} d={p.fill} fill={p.tint} />
        ))}
        {paths.map((p) =>
          p.bandD ? (
            <path key={p.label + "b"} d={p.bandD} fill={PAL.alpha(p.stroke, 0.18)} stroke="none" />
          ) : null,
        )}
        {paths.map((p) => (
          <path
            key={p.label}
            d={p.d}
            fill="none"
            stroke={p.stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hf && (
          <g pointerEvents="none">
            <line x1={px(hf)} x2={px(hf)} y1={y0} y2={y1} stroke={PAL.muted} strokeWidth="1" />
            {hits.map((h) => (
              <circle
                key={h.label}
                cx={px(h.o.f)}
                cy={py(h.o.spl)}
                r="3.5"
                fill={h.stroke}
                stroke={PAL.white}
                strokeWidth="1.5"
              />
            ))}
            {(() => {
              const t = `${hf >= 1000 ? (hf / 1000).toFixed(hf >= 10000 ? 0 : 1) + "k" : hf.toFixed(0)} Hz`,
                w = t.length * 6.5 + 8,
                X = Math.max(x0 + w / 2, Math.min(x1 - w / 2, px(hf)));
              return (
                <g>
                  <rect x={X - w / 2} y={y1 + 5} width={w} height={17} rx="3" fill={PAL.ink} />
                  <text
                    x={X}
                    y={y1 + 17.5}
                    textAnchor="middle"
                    fontSize="12"
                    fontFamily={SVG_FONT}
                    fill={PAL.white}
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
              fill={PAL.ink}
              stroke={PAL.white}
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
          fill={PAL.muted}
          fontSize="12"
          fontFamily={SVG_FONT}
        >
          frequency, Hz
        </text>
        <text
          transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`}
          textAnchor="middle"
          fill={PAL.muted}
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
            <span key={p.label} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5" style={{ background: p.stroke }} />
              {p.label}
            </span>
          ))}
          {paths.some((p) => p.bandD) && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-2.5 rounded-sm"
                style={{ background: PAL.alpha(PAL.ink, 0.18) }}
              />
              Xmax estimated: shaded range
            </span>
          )}
        </div>
      )}
    </div>
  );
}
