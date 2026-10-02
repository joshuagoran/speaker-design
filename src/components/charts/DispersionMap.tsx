import type { HifiDispersionMap } from "../../types";
import { PAL } from "../../styles/palette";
import { useState } from "react";

interface Props {
  map: HifiDispersionMap;
  title: string;
}

/** Level vs angle and frequency, normalised to on-axis (0 dB darkest). Hover or drag to read a cell. */
export function DispersionMap({ map, title }: Props) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const W = 560,
    H = 240,
    L = 40,
    R = 6,
    T = 6,
    B = 24;
  const nF = map.freqs.length,
    nA = map.angles.length;
  const cw = (W - L - R) / nF,
    ch = (H - T - B) / nA;
  const col = (db: number) => {
    const x = Math.max(0, Math.min(1, -db / 18));
    const l = 28 + x * 66;
    return `hsl(${PAL.cyanHue} ${Math.round(100 - x * 70)}% ${l.toFixed(0)}%)`;
  };
  const fx = (f: number) =>
    L + (Math.log(f / map.freqs[0]) / Math.log(map.freqs[nF - 1] / map.freqs[0])) * (W - L - R);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    const i = Math.floor((x - L) / cw),
      j = Math.floor((y - T) / ch);
    setHover(i >= 0 && i < nF && j >= 0 && j < nA ? { i, j } : null);
  };
  const ticksA = map.angles.filter((a) => a % 30 === 0);
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs text-stone-500 mb-1">
        <span>{title}</span>
        <span className="tabular-nums text-stone-900">
          {hover
            ? `${map.angles[hover.j]}° · ${map.freqs[hover.i] >= 1000 ? (map.freqs[hover.i] / 1000).toFixed(1) + "k" : map.freqs[hover.i].toFixed(0)} Hz · ${map.rows[hover.j][hover.i].toFixed(1)} dB`
            : "dB vs on-axis"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ touchAction: "pan-y" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${title}: level against angle and frequency`}
      >
        {map.rows.map((row, j) =>
          row.map((db, i) => (
            <rect
              key={j * nF + i}
              x={L + i * cw}
              y={T + j * ch}
              width={cw + 0.5}
              height={ch + 0.5}
              fill={col(db)}
            />
          )),
        )}
        {ticksA.map((a) => {
          const j = map.angles.indexOf(a);
          return (
            <text
              key={a}
              x={L - 5}
              y={T + (j + 0.5) * ch + 3}
              fontSize="10"
              textAnchor="end"
              fill={PAL.muted}
            >
              {a}°
            </text>
          );
        })}
        {[200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => (
          <text key={f} x={fx(f)} y={H - 8} fontSize="10" textAnchor="middle" fill={PAL.muted}>
            {f >= 1000 ? f / 1000 + "k" : f}
          </text>
        ))}
        {hover && (
          <rect
            x={L + hover.i * cw}
            y={T + hover.j * ch}
            width={cw}
            height={ch}
            fill="none"
            stroke={PAL.ink}
            strokeWidth="1.5"
          />
        )}
      </svg>
      <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
        0 dB
        <span
          className="h-2 flex-1 max-w-[160px] rounded"
          style={{ background: `linear-gradient(to right, ${col(0)}, ${col(-9)}, ${col(-18)})` }}
        />
        −18 dB
      </div>
    </div>
  );
}
