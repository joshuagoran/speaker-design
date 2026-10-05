import { PAL } from "../../styles/palette";
import { PA_DB_BOT, PA_DB_TOP } from "../../constants/chartScales";
import { useState } from "react";

/** One curve point: frequency in Hz, level in dB. */
type CurvePoint = readonly [hz: number, db: number];

interface Props {
  /** this design's curve (the optimizer cards' `curve`) */
  curve: readonly CurvePoint[];
  /** your current design's curve, drawn dashed; absent when there is none */
  cur?: readonly CurvePoint[] | null;
  fmin?: number;
  fmax?: number;
  /** shaded band, Hz; null for none (the Hi-fi cards) */
  band?: readonly [number, number] | null;
  /** fixed dB axis: defaults to the PA optimizer cards' 80-135 dB; the Hi-fi cards pass HIFI_TOP / HIFI_BOT */
  top?: number;
  bot?: number;
}

/** The sub's clean output (music limit) against frequency, this design against yours; the scored 40-90 Hz band shaded. */
export function OptimizerCurveChart({
  curve,
  cur,
  fmin = 20,
  fmax = 200,
  band = [40, 90],
  top = PA_DB_TOP,
  bot = PA_DB_BOT,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 220,
    H = 150,
    L = 26,
    R = 6,
    T = 16,
    B = 18;
  const x = (f: number) => L + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (W - L - R),
    y = (d: number) => T + ((top - Math.max(bot, Math.min(top, d))) / (top - bot)) * (H - T - B);
  const path = (c: readonly CurvePoint[]) =>
    c.map((o, i) => `${i ? "L" : "M"}${x(o[0]).toFixed(1)},${y(o[1]).toFixed(1)}`).join("");
  const nearest = (c: readonly CurvePoint[], f: number) =>
    c.reduce((b, o) => (Math.abs(Math.log(o[0] / f)) < Math.abs(Math.log(b[0] / f)) ? o : b));
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      px = ((e.clientX - r.left) / r.width) * W;
    const f = fmin * Math.pow(fmax / fmin, (px - L) / (W - L - R));
    setHover(f >= fmin && f <= fmax ? f : null);
  };
  const ticks: number[] = [];
  for (let d = bot; d <= top; d += 10) ticks.push(d);
  // the points under the pointer, on this card's curve and on yours (`0` is not a hover frequency)
  const hov = hover
    ? { f: hover, h1: nearest(curve, hover), h2: cur ? nearest(cur, hover) : null }
    : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto touch-none"
      onPointerMove={move}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label="Clean sub output from 20 to 200 Hz, this design against yours"
    >
      {band && (
        <rect
          x={x(band[0])}
          y={T}
          width={x(band[1]) - x(band[0])}
          height={H - T - B}
          fill={PAL.alpha(PAL.ink, 0.05)}
        />
      )}
      {ticks.map((d) => (
        <g key={d}>
          <line x1={L} x2={W - R} y1={y(d)} y2={y(d)} stroke={PAL.edge} />
          <text x={L - 3} y={y(d) + 3} fontSize="8" textAnchor="end" fill={PAL.muted}>
            {d}
          </text>
        </g>
      ))}
      {(fmax > 1000 ? [20, 100, 1000, 10000] : [20, 50, 100, 200, 500])
        .filter((f) => f >= fmin && f <= fmax)
        .map((f) => (
          <text key={f} x={x(f)} y={H - 6} fontSize="8" textAnchor="middle" fill={PAL.muted}>
            {f >= 1000 ? f / 1000 + "k" : f}
          </text>
        ))}
      {cur && (
        <path
          d={path(cur)}
          fill="none"
          stroke={PAL.muted}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
      <path d={path(curve)} fill="none" stroke={PAL.ink} strokeWidth="2" />
      {hov ? (
        <>
          <line
            x1={x(hov.f)}
            x2={x(hov.f)}
            y1={T}
            y2={H - B}
            stroke={PAL.muted}
            strokeWidth="0.75"
          />
          <circle
            cx={x(hov.h1[0])}
            cy={y(hov.h1[1])}
            r="2.5"
            fill={PAL.ink}
            stroke={PAL.white}
            strokeWidth="1"
          />
          {(() => {
            const X = Math.max(L + 14, Math.min(W - R - 14, x(hov.f)));
            return (
              <g>
                <rect x={X - 14} y={H - B + 2} width="28" height="12" rx="2" fill={PAL.ink} />
                <text x={X} y={H - B + 11} fontSize="8" textAnchor="middle" fill={PAL.white}>
                  {hov.f.toFixed(0)} Hz
                </text>
              </g>
            );
          })()}
          <text x={L} y={9} fontSize="8.5" fill={PAL.ink}>
            {hov.f.toFixed(0)} Hz: {hov.h1[1].toFixed(0)} dB
            {hov.h2 ? ` · yours ${hov.h2[1].toFixed(0)} dB` : ""}
          </text>
        </>
      ) : (
        <text x={L} y={9} fontSize="8.5" fill={PAL.muted}>
          <tspan fill={PAL.ink}>━ this</tspan>
          {cur ? "  ╌ yours" : ""} · dB, clean
        </text>
      )}
    </svg>
  );
}
