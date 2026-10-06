import { usePalette } from "../../hooks/useTheme";
import type { ListeningSeat } from "../../types";

interface Props {
  /** distance between the speakers, feet */
  spacing: number;
  /** toe-in, degrees */
  toe: number;
  seat: ListeningSeat;
  setSeat: (seat: ListeningSeat) => void;
  /** each speaker's angle to the seat, degrees: left, right */
  angles: readonly [left: number, right: number];
  /** size classes for the drawing (default: full width, its own height); a box larger than the room centers it */
  className?: string;
}

/** Top-down room: the pair and a seat you can drag. Units: feet. */
export function RoomView({
  spacing,
  toe,
  seat,
  setSeat,
  angles,
  className = "w-full h-auto",
}: Props) {
  const pal = usePalette();
  const Wd = Math.max(12, spacing + 6),
    Dp = Math.max(10, seat.y + 3),
    W = 320,
    k = W / Wd,
    H = Dp * k;
  const px = (x: number) => W / 2 + x * k,
    py = (y: number) => 14 + y * k;
  const drag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.type === "pointermove" && !e.buttons) return;
    // through the drawing's own transform, so the seat follows the pointer however the box letterboxes the room
    const ctm = e.currentTarget.getScreenCTM();
    if (!ctm) return;
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    // kept to the drawing (0…W, down to its bottom edge), so a press in the letterbox margins can't put the seat
    // outside the walls or jump the room deeper than a drag on the drawing itself
    const fx = Math.min(W, Math.max(0, x)),
      fy = Math.min(H + 20, y);
    setSeat({
      x: Math.round(((fx - W / 2) / k) * 4) / 4,
      y: Math.max(2, Math.round(((fy - 14) / k) * 4) / 4),
    });
  };
  const spk = (sx: number, sign: number) => {
    return (
      <g key={sign} transform={`translate(${px(sx)},${py(0)}) rotate(${-sign * toe})`}>
        <rect x={-7} y={-6} width={14} height={10} rx="1.5" fill={pal.ink} />
        <line x1={0} y1={4} x2={0} y2={4 + 22} stroke={pal.muted} strokeDasharray="2 2" />
      </g>
    );
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 20}`}
      className={`${className} rounded border border-stone-300 bg-panel select-none`}
      style={{ touchAction: "none" }}
      onPointerDown={drag}
      onPointerMove={drag}
      role="img"
      aria-label="Room seen from above; drag the seat"
    >
      {[-1, 1].map((sg) => (
        <line
          key={sg}
          x1={px((sg * spacing) / 2)}
          y1={py(0)}
          x2={px(seat.x)}
          y2={py(seat.y)}
          stroke={pal.edge}
        />
      ))}
      {spk(-spacing / 2, 1)}
      {spk(spacing / 2, -1)}
      <circle
        cx={px(seat.x)}
        cy={py(seat.y)}
        r="7"
        fill={pal.cyan}
        stroke={pal.white}
        strokeWidth="2"
      />
      <text x={px(-spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill={pal.muted}>
        {angles[0].toFixed(0)}° off
      </text>
      <text x={px(spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill={pal.muted}>
        {angles[1].toFixed(0)}° off
      </text>
      <text x={6} y={H + 14} fontSize="10" fill={pal.muted}>
        {Wd.toFixed(0)} ft wide · drag the seat
      </text>
    </svg>
  );
}
