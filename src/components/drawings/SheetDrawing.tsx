import type { PackedSheet, PlywoodSheet } from "../../types.ts";
import { PAL } from "../../styles/palette.ts";
import { useElementWidth } from "../../hooks/useElementWidth.ts";

interface Props {
  sheet: PackedSheet;
  /** the sheet's size, inches */
  S: PlywoodSheet;
  /** which sheet this is, from 0 */
  idx: number;
}

/** One plywood sheet with its cut pieces laid out. */
export function SheetDrawing({ sheet, S, idx }: Props) {
  const sc = 4,
    W = S.w * sc,
    H = S.h * sc;
  const [box, cw] = useElementWidth(S.w === 48 ? 160 : 200);
  const fs = (12 * (W + 4)) / cw; // 12 css px
  const colors: Record<string, string> = { Sub: PAL.subTint, Mid: PAL.midTint };
  return (
    <div
      ref={box}
      className={`flex flex-col gap-1 w-full ${S.w === 48 ? "max-w-[240px] sm:w-[160px]" : "max-w-[300px] sm:w-[200px]"}`}
    >
      <div className="text-xs text-stone-500">Sheet {idx + 1}</div>
      <svg
        viewBox={`-2 -2 ${W + 4} ${H + 4}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={`Sheet ${idx + 1} layout`}
      >
        <rect x="0" y="0" width={W} height={H} fill={PAL.white} stroke={PAL.muted} />
        {sheet.items.map((it, i) => (
          <g key={i}>
            <rect
              x={it.x * sc}
              y={it.y * sc}
              width={it.w * sc}
              height={it.h * sc}
              fill={colors[it.box] || PAL.edge}
              stroke={PAL.muted}
              strokeWidth="0.8"
            />
            {it.w * sc > fs * 3.6 && it.h * sc > fs * 1.3 && (
              <text
                x={(it.x + it.w / 2) * sc}
                y={(it.y + it.h / 2) * sc + fs * 0.35}
                textAnchor="middle"
                fontSize={fs}
                fill={PAL.ink}
                fontFamily="Inconsolata, monospace"
              >
                {it.box} {it.part.split(" ")[0]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
