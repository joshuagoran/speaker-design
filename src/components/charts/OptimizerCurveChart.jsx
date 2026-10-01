import { PAL } from "../../styles/palette.js";
import { useState } from "react";

/** The sub's clean output (music limit) against frequency, this design against yours; the scored 40-90 Hz band shaded. */
export function OptimizerCurveChart({
  curve,
  cur,
  fmin = 20,
  fmax = 200,
  band = [40, 90],
  top = 135,
  bot = 80,
}) {
  const [hover, setHover] = useState(null);
  const W = 220,
    H = 150,
    L = 26,
    R = 6,
    T = 16,
    B = 18;
  const x = (f) => L + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (W - L - R),
    y = (d) => T + ((top - Math.max(bot, Math.min(top, d))) / (top - bot)) * (H - T - B);
  const path = (c) =>
    c.map((o, i) => `${i ? "L" : "M"}${x(o[0]).toFixed(1)},${y(o[1]).toFixed(1)}`).join("");
  const at = (c, f) =>
    c && c.reduce((b, o) => (Math.abs(Math.log(o[0] / f)) < Math.abs(Math.log(b[0] / f)) ? o : b));
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(),
      px = ((e.clientX - r.left) / r.width) * W;
    const f = fmin * Math.pow(fmax / fmin, (px - L) / (W - L - R));
    setHover(f >= fmin && f <= fmax ? f : null);
  };
  const ticks = [];
  for (let d = bot; d <= top; d += 10) ticks.push(d);
  const h1 = hover && at(curve, hover),
    h2 = hover && at(cur, hover);
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
      {hover ? (
        <>
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={T}
            y2={H - B}
            stroke={PAL.muted}
            strokeWidth="0.75"
          />
          <circle
            cx={x(h1[0])}
            cy={y(h1[1])}
            r="2.5"
            fill={PAL.ink}
            stroke={PAL.white}
            strokeWidth="1"
          />
          {(() => {
            const X = Math.max(L + 14, Math.min(W - R - 14, x(hover)));
            return (
              <g>
                <rect x={X - 14} y={H - B + 2} width="28" height="12" rx="2" fill={PAL.ink} />
                <text x={X} y={H - B + 11} fontSize="8" textAnchor="middle" fill={PAL.white}>
                  {hover.toFixed(0)} Hz
                </text>
              </g>
            );
          })()}
          <text x={L} y={9} fontSize="8.5" fill={PAL.ink}>
            {hover.toFixed(0)} Hz: {h1[1].toFixed(0)} dB
            {h2 ? ` · yours ${h2[1].toFixed(0)} dB` : ""}
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
