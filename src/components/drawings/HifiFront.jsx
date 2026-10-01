import { PAL } from "../../styles/palette.js";
import { passiveRadiatorShape } from "../../lib/hifi/hifi.js";

/** Front view of the box and drivers, to scale. */
export function HifiFront({ dim, w, t, lay, vented, port, pr, guide, small }) {
  const face = guide ? { w: guide.w, h: guide.h } : t.faceplate || { w: 4, h: 4 };
  const top = lay.onTop ? face.h : 0,
    k = 120 / Math.max(dim.h + top, dim.w * 1.2, face.w * 1.2),
    W = Math.max(dim.w, face.w) * k,
    H = (dim.h + top) * k;
  const bx = (W - dim.w * k) / 2,
    y = (inch) => (dim.h + top - inch) * k;
  return (
    <svg
      viewBox={`-4 -4 ${W + 8} ${H + 8}`}
      className={small ? "w-full h-auto max-h-40" : "h-40 w-auto"}
      role="img"
      aria-label={`Front view, ${dim.w} × ${dim.h}″${lay.onTop ? ", waveguide on top" : ""}`}
    >
      <rect
        x={bx}
        y={top * k}
        width={dim.w * k}
        height={dim.h * k}
        rx="2"
        fill={PAL.edge}
        stroke={PAL.ink}
        strokeWidth="1.2"
      />
      {lay.onTop ? (
        <g>
          <rect
            x={W / 2 - (face.w * k) / 8}
            y={top * k - 3}
            width={(face.w * k) / 4}
            height={3}
            fill={PAL.ink}
          />
          <rect
            x={W / 2 - (face.w * k) / 2}
            y={0}
            width={face.w * k}
            height={top * k - 3}
            rx={(face.h * k) / 3}
            fill={PAL.muted}
            stroke={PAL.ink}
            strokeWidth="1"
          />
        </g>
      ) : (
        <rect
          x={W / 2 - (face.w * k) / 2}
          y={y(lay.tweeterIn) - (face.h * k) / 2}
          width={face.w * k}
          height={face.h * k}
          rx={guide ? 3 : (face.w * k) / 2}
          fill={PAL.muted}
        />
      )}
      <circle cx={W / 2} cy={y(lay.tweeterIn)} r={0.5 * k} fill={PAL.edge} />
      <circle
        cx={W / 2}
        cy={y(lay.wooferIn)}
        r={(w.size * 0.95 * k) / 2}
        fill={PAL.edge}
        stroke={PAL.muted}
      />
      {pr &&
        Array.from({ length: pr.n }, (_, i) => {
          const s = passiveRadiatorShape(pr.drv),
            cy = H - (0.75 + 0.25 + (i + 0.5) * (s.h + 0.5)) * k;
          return (
            <rect
              key={`r${i}`}
              x={W / 2 - (s.w * k) / 2}
              y={cy - (s.h * k) / 2}
              width={s.w * k}
              height={s.h * k}
              rx={(s.w * k) / 2}
              fill="none"
              stroke={PAL.muted}
              strokeDasharray="3 2"
            />
          );
        })}
      {vented && port.shape === "slot" && (
        <rect
          x={bx + 0.75 * k}
          y={H - (0.75 + port.h) * k}
          width={(dim.w - 1.5) * k}
          height={port.h * k}
          fill={PAL.ink}
        />
      )}
      {vented &&
        port.shape !== "slot" &&
        Array.from({ length: port.n }, (_, i) => (
          <circle
            key={i}
            cx={W / 2 + (i - (port.n - 1) / 2) * (port.dia + 0.6) * k}
            cy={H - (port.dia / 2 + 1) * k}
            r={(port.dia * k) / 2}
            fill={PAL.ink}
          />
        ))}
    </svg>
  );
}
