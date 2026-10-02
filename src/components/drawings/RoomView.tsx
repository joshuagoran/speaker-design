import { PAL } from "../../styles/palette";

/** The listening seat, feet: across from the middle of the pair, and out from the speakers. */
interface Seat {
  x: number;
  y: number;
}

interface Props {
  /** distance between the speakers, feet */
  spacing: number;
  /** toe-in, degrees */
  toe: number;
  seat: Seat;
  setSeat: (seat: Seat) => void;
  /** each speaker's angle to the seat, degrees: left, right */
  angles: readonly [left: number, right: number];
}

/** Top-down room: the pair and a seat you can drag. Units: feet. */
export function RoomView({ spacing, toe, seat, setSeat, angles }: Props) {
  const Wd = Math.max(12, spacing + 6),
    Dp = Math.max(10, seat.y + 3),
    W = 320,
    k = W / Wd,
    H = Dp * k;
  const px = (x: number) => W / 2 + x * k,
    py = (y: number) => 14 + y * k;
  const drag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.type === "pointermove" && !e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * (H + 20);
    setSeat({
      x: Math.round(((x - W / 2) / k) * 4) / 4,
      y: Math.max(2, Math.round(((y - 14) / k) * 4) / 4),
    });
  };
  const spk = (sx: number, sign: number) => {
    return (
      <g key={sign} transform={`translate(${px(sx)},${py(0)}) rotate(${-sign * toe})`}>
        <rect x={-7} y={-6} width={14} height={10} rx="1.5" fill={PAL.ink} />
        <line x1={0} y1={4} x2={0} y2={4 + 22} stroke={PAL.muted} strokeDasharray="2 2" />
      </g>
    );
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H + 20}`}
      className="w-full h-auto rounded border border-stone-300 bg-white"
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
          stroke={PAL.edge}
        />
      ))}
      {spk(-spacing / 2, 1)}
      {spk(spacing / 2, -1)}
      <circle
        cx={px(seat.x)}
        cy={py(seat.y)}
        r="7"
        fill={PAL.cyan}
        stroke={PAL.white}
        strokeWidth="2"
      />
      <text x={px(-spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill={PAL.muted}>
        {angles[0].toFixed(0)}° off
      </text>
      <text x={px(spacing / 2)} y={py(0) + 38} fontSize="10" textAnchor="middle" fill={PAL.muted}>
        {angles[1].toFixed(0)}° off
      </text>
      <text x={6} y={H + 14} fontSize="10" fill={PAL.muted}>
        {Wd.toFixed(0)} ft wide · drag the seat
      </text>
    </svg>
  );
}
