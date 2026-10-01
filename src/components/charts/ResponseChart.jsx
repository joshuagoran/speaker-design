import { PAL } from "../../styles/palette.js";
import { useElementWidth } from "../../hooks/useElementWidth.js";
import { useState } from "react";

/** Max-SPL chart: one or more curves ({f, spl}), fixed 80-135 dB so setups compare directly. */
export function ResponseChart({
  series,
  marks = [],
  fmax = 200,
  fmin = 15,
  top = 135,
  bot = 80,
  step = 5,
  yLabel = "max dB SPL @ 1 m",
  H = 300,
}) {
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
  const px = (f) => x0 + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (x1 - x0);
  const py = (v) => y1 - ((Math.max(BOT, Math.min(TOP, v)) - BOT) / (TOP - BOT)) * (y1 - y0);
  const paths = series.map((sr) => {
    const pts = sr.curve.filter((o) => o.f >= fmin && o.f <= fmax);
    const d = pts
      .map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1))
      .join("");
    return {
      ...sr,
      d,
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
  const grid = [];
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
        fontFamily="Inconsolata, monospace"
      >
        {f >= 1000 ? f / 1000 + "k" : f}
      </text>,
    );
  });
  // hover / drag: a crosshair with each curve's value at that frequency
  const [hf, setHf] = useState(null);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(),
      X = ((e.clientX - r.left) / r.width) * W;
    setHf(X >= x0 && X <= x1 ? fmin * Math.pow(fmax / fmin, (X - x0) / (x1 - x0)) : null);
  };
  const unit = yLabel.includes("°") ? "°" : " dB";
  const hits = hf
    ? paths
        .map((p) => {
          const pts = p.curve.filter((o) => o.f >= fmin && o.f <= fmax);
          const o = pts.length
            ? pts.reduce((b, q) =>
                Math.abs(Math.log(q.f / hf)) < Math.abs(Math.log(b.f / hf)) ? q : b,
              )
            : null;
          return o && Math.abs(Math.log(o.f / hf)) < 0.1 ? { ...p, o } : null;
        })
        .filter(Boolean)
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
          fontFamily="Inconsolata, monospace"
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
                fontFamily="Inconsolata, monospace"
              >
                {m.label}
              </text>
            </g>
          ))}
        {paths.map((p) => (
          <path key={p.label + "f"} d={p.fill} fill={p.tint} />
        ))}
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
                    fontFamily="Inconsolata, monospace"
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
              fontFamily="Inconsolata, monospace"
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
          fontFamily="Inconsolata, monospace"
        >
          frequency, Hz
        </text>
        <text
          transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`}
          textAnchor="middle"
          fill={PAL.muted}
          fontSize="12"
          fontFamily="Inconsolata, monospace"
        >
          {yLabel}
        </text>
      </svg>
      {paths.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 text-xs text-stone-500"
          style={{ fontFamily: "var(--font)" }}
        >
          {paths.map((p) => (
            <span key={p.label} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5" style={{ background: p.stroke }} />
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
