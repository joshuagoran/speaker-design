import type { SpaceVenue } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { alpha } from "../../styles/palette";
import { SVG_FONT } from "../../styles/fonts";
import type { PlacedItem, RoomPoint } from "../../lib/speaker/spaceLayout";
import { DRIVER_PART } from "../../constants/space";

interface Props {
  items: readonly PlacedItem[];
  room: Pick<SpaceVenue["room"], "lengthFt" | "ceilingFt" | "outdoors">;
  listener: SpaceVenue["listener"];
  earFt: SpaceVenue["earFt"];
}

/** The drawing's margins, px: the axis labels on the left and below. */
const PAD = { l: 34, r: 10, t: 10, b: 24 };
/** The drawing's width, px (it scales to its box); its height follows the room's. */
const W = 640;
/** How far each placement's axis line runs, ft. */
const AXIS_FT = 30;
/** Grid steps, ft: along the room and up. */
const STEP_ALONG_FT = 10;
const STEP_UP_FT = 5;

/** The convex hull of points (y, z), in order round it (Andrew's monotone chain). */
function hull(points: readonly [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * Side view of a space, to scale: the floor down the room (the front wall at the left) and the height, each box at its
 * lift and tilt (its outline seen from the side), a line along each placement's highest band, and the listener's ear.
 */
export function SpaceSide({ items, room, listener, earFt }: Props) {
  const pal = usePalette();
  const top =
    Math.max(
      room.outdoors ? 0 : room.ceilingFt,
      earFt,
      ...items.flatMap((it) => it.boxes.flatMap((b) => b.corners.map((c) => c.z))),
    ) + 1;
  const k = (W - PAD.l - PAD.r) / room.lengthFt;
  const H = top * k + PAD.t + PAD.b;
  const X = (y: number) => PAD.l + y * k,
    Y = (z: number) => PAD.t + (top - z) * k;
  const font = { fontSize: 11, fontFamily: SVG_FONT };
  const ticksAlong: number[] = [];
  for (let f = 0; f <= room.lengthFt; f += STEP_ALONG_FT) ticksAlong.push(f);
  const ticksUp: number[] = [];
  for (let f = 0; f <= top; f += STEP_UP_FT) ticksUp.push(f);
  /** each placement's axis: from its highest HF spot (or its highest spot) along its aim, as seen from the side */
  const axes = items.flatMap((it) => {
    const hf = it.drivers.filter((d) => d.part === DRIVER_PART.hf);
    const pool = hf.length ? hf : it.drivers;
    if (!pool.length) return [];
    const d = pool.reduce((a, b) => (b.at.z > a.at.z ? b : a));
    const end: RoomPoint = {
      x: d.at.x,
      y: d.at.y + AXIS_FT * Math.cos(d.pitch) * Math.cos(d.yaw),
      z: d.at.z + AXIS_FT * Math.sin(d.pitch),
    };
    return [{ from: d.at, to: end }];
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Side view of the space: ${items.length} placement${items.length === 1 ? "" : "s"} at their heights and tilts, and the listener's ear`}
    >
      <defs>
        <clipPath id="space-side-room">
          <rect x={PAD.l} y={PAD.t} width={room.lengthFt * k} height={top * k} />
        </clipPath>
      </defs>
      {ticksUp.map((f) => (
        <g key={`u${f}`}>
          <line x1={X(0)} x2={X(room.lengthFt)} y1={Y(f)} y2={Y(f)} stroke={pal.edge} />
          <text x={PAD.l - 6} y={Y(f) + 4} textAnchor="end" fill={pal.muted} {...font}>
            {f}
          </text>
        </g>
      ))}
      {ticksAlong.map((f) => (
        <text key={`a${f}`} x={X(f)} y={H - 6} textAnchor="middle" fill={pal.muted} {...font}>
          {f}
        </text>
      ))}
      <line x1={X(0)} x2={X(room.lengthFt)} y1={Y(0)} y2={Y(0)} stroke={pal.ink} strokeWidth="2" />
      {!room.outdoors && (
        <>
          <line
            x1={X(0)}
            x2={X(room.lengthFt)}
            y1={Y(room.ceilingFt)}
            y2={Y(room.ceilingFt)}
            stroke={pal.ink}
            strokeWidth="1.5"
          />
          <line
            x1={X(0)}
            x2={X(0)}
            y1={Y(0)}
            y2={Y(room.ceilingFt)}
            stroke={pal.ink}
            strokeWidth="2"
          />
          <line
            x1={X(room.lengthFt)}
            x2={X(room.lengthFt)}
            y1={Y(0)}
            y2={Y(room.ceilingFt)}
            stroke={pal.ink}
            strokeWidth="2"
          />
        </>
      )}
      <g clipPath="url(#space-side-room)">
        {axes.map((a, i) => (
          <line
            key={i}
            x1={X(a.from.y)}
            y1={Y(a.from.z)}
            x2={X(a.to.y)}
            y2={Y(a.to.z)}
            stroke={pal.muted}
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        ))}
        {items.flatMap((it, i) =>
          it.boxes.map((b) => (
            <polygon
              key={`${i}-${b.member}`}
              points={hull(b.corners.map((c) => [X(c.y), Y(c.z)]))
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join(" ")}
              fill={alpha(pal.ink, 0.12)}
              stroke={pal.ink}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          )),
        )}
      </g>
      <circle
        cx={X(listener.y)}
        cy={Y(earFt)}
        r="6"
        fill={pal.cyan}
        stroke={pal.white}
        strokeWidth="2"
      />
    </svg>
  );
}
