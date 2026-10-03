import type { Offcut, PackedSheet, PlywoodSheet } from "../../types";
import { formatInches } from "../../lib/pa/calc";
import { PAL } from "../../styles/palette";
import { useElementWidth } from "../../hooks/useElementWidth";

interface Props {
  sheet: PackedSheet;
  /** the sheet's size, inches */
  S: PlywoodSheet;
  /** which sheet this is, from 0 */
  idx: number;
  /** the offcut this sheet keeps, if any */
  offcut?: Offcut | null;
}

/** One plywood sheet with its cut pieces laid out; grain runs down the sheet. */
export function SheetDrawing({ sheet, S, idx, offcut }: Props) {
  const sc = 4,
    W = S.w * sc,
    H = S.h * sc;
  const [box, cw] = useElementWidth(S.w === 48 ? 160 : 200);
  const fs = (12 * (W + 4)) / cw; // 12 css px
  const colors: Record<string, string> = { Sub: PAL.subTint, Mid: PAL.midTint };
  // a grain arrow down the middle of a piece, from y0 to y1 (sheet units)
  const arrow = (x: number, y0: number, y1: number, colour: string, key?: string) => {
    const head = fs * 0.45;
    return (
      <g key={key} stroke={colour} strokeWidth={fs * 0.12} fill="none">
        <line x1={x} y1={y0} x2={x} y2={y1} />
        <polyline points={`${x - head},${y0 + head} ${x},${y0} ${x + head},${y0 + head}`} />
        <polyline points={`${x - head},${y1 - head} ${x},${y1} ${x + head},${y1 - head}`} />
      </g>
    );
  };
  return (
    <div
      ref={box}
      className={`flex flex-col gap-1 w-full ${S.w === 48 ? "max-w-[240px] sm:w-[160px]" : "max-w-[300px] sm:w-[200px]"}`}
    >
      <div className="text-xs text-stone-500 flex justify-between">
        <span>Sheet {idx + 1}</span>
        <span title="Face grain runs top to bottom on this drawing: load the sheet that way">
          grain ↕
        </span>
      </div>
      <svg
        viewBox={`-2 -2 ${W + 4} ${H + 4}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={`Sheet ${idx + 1} layout`}
      >
        <rect x="0" y="0" width={W} height={H} fill={PAL.white} stroke={PAL.muted} />
        {offcut && (
          <g>
            <rect
              x={offcut.x * sc}
              y={offcut.y * sc}
              width={offcut.w * sc}
              height={offcut.h * sc}
              fill="none"
              stroke={PAL.muted}
              strokeWidth="0.8"
              strokeDasharray={`${fs * 0.5} ${fs * 0.4}`}
            />
            {offcut.w * sc > fs * 2.2 && offcut.h * sc > fs * 4 && (
              <text
                x={(offcut.x + offcut.w / 2) * sc}
                y={(offcut.y + offcut.h / 2) * sc}
                textAnchor="middle"
                fontSize={fs}
                fill={PAL.muted}
                fontFamily="Inconsolata, monospace"
              >
                <tspan x={(offcut.x + offcut.w / 2) * sc}>offcut</tspan>
                <tspan x={(offcut.x + offcut.w / 2) * sc} dy={fs * 1.1}>
                  {formatInches(offcut.w)}×{formatInches(offcut.h)}
                </tspan>
              </text>
            )}
          </g>
        )}
        {sheet.items.map((it, i) => {
          const x = it.x * sc,
            y = it.y * sc,
            w = it.w * sc,
            h = it.h * sc,
            cx = x + w / 2;
          // strips are labelled along their length; the box name goes first where it fits (the fill colour shows it too)
          const name = it.pieces ? "strip" : it.part.split(" ")[0];
          const [run, across] = it.pieces ? [h, w] : [w, h];
          const fits = (t: string) => run > fs * (0.55 * t.length + 0.6) && across > fs * 1.3;
          const label = [`${it.box} ${name}`, name].find(fits);
          const labelled = !!label;
          // waterfall strips: a tick at each cut and the panels numbered in cut order
          const cuts: number[] = [];
          if (it.pieces) {
            const gap = (it.h - it.pieces.reduce((a, p) => a + p, 0)) / (it.pieces.length - 1);
            let at = it.y;
            for (const p of it.pieces.slice(0, -1)) {
              at += p + gap / 2;
              cuts.push(at * sc);
              at += gap / 2;
            }
          }
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={colors[it.box] || PAL.edge}
                stroke={it.crossed ? PAL.status.orange.base : PAL.muted}
                strokeWidth={it.crossed ? "2" : "0.8"}
              />
              {cuts.map((cy, k) => (
                <line
                  key={k}
                  x1={x}
                  y1={cy}
                  x2={x + w}
                  y2={cy}
                  stroke={PAL.ink}
                  strokeWidth="1.2"
                />
              ))}
              {it.pieces &&
                [it.y, ...cuts.map((c) => c / sc)].map((top, k) => (
                  <text
                    key={`n${k}`}
                    x={x + fs * 0.4}
                    y={top * sc + fs * 1.1}
                    fontSize={fs}
                    fill={PAL.ink}
                    fontFamily="Inconsolata, monospace"
                  >
                    {k + 1}
                  </text>
                ))}
              {/* grain: one arrow the length of a strip, a short one in a panel's corner */}
              {it.grain &&
                h > fs * 1.6 &&
                w > fs * 1.2 &&
                arrow(
                  x + w - fs * 0.7,
                  y + fs * 0.4,
                  it.pieces ? y + h - fs * 0.4 : y + fs * 0.4 + Math.min(h - fs * 0.8, fs * 2.4),
                  it.crossed ? PAL.status.orange.base : PAL.muted,
                )}
              {labelled && (
                <text
                  x={cx}
                  y={y + h / 2 + fs * 0.35}
                  textAnchor="middle"
                  fontSize={fs}
                  fill={PAL.ink}
                  fontFamily="Inconsolata, monospace"
                  transform={it.pieces ? `rotate(-90 ${cx} ${y + h / 2})` : undefined}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
