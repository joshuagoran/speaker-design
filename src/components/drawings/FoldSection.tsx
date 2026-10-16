import type { SpeakerCabinet } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { alpha } from "../../styles/palette";
import type { ChamberFold, PlacedChamber } from "../../lib/speaker/speakerLayout";
import type { FoldPoint } from "../../lib/speaker/hornBoards";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { SPEAKER_TEXT } from "../../constants/speakerPage";

interface Props {
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">;
  placed: Pick<PlacedChamber, "dims" | "y0">;
  fold: ChamberFold;
}

/** The drawing's scale, px per inch, and its margin, px (as the straight sections'). */
const SCALE_PX = 6;
const PAD_PX = 4;
/** The drivers' mounting point's radius, px. */
const SPOT_PX = 3;

/**
 * A folded horn chamber's side section, to scale, the baffle at the left: its walls, the passage between its boards
 * (from the gates, lib/speaker/hornBoards), the boards, and the drivers' basket and motor behind their board. A board
 * past the chamber or crossing another, and a magnet that hits a board, are drawn in the error color.
 */
export function FoldSection({ cabinet, placed, fold }: Props) {
  const pal = usePalette();
  const { dims, y0 } = placed;
  const { layout, room, plan } = fold;
  const t = cabinet.panel.thicknessIn;
  /** the baffle's inside face, from the box's front */
  const zero = baffleInsetIn(cabinet) + t;
  const W = dims.d * SCALE_PX + 2 * PAD_PX;
  const H = dims.h * SCALE_PX + 2 * PAD_PX;
  /** a side-section point (z from the baffle's inside face, y from the horn face's bottom) on the drawing */
  const at = (p: FoldPoint) => ({
    x: PAD_PX + (zero + p.z) * SCALE_PX,
    y: PAD_PX + (y0 + dims.h - (fold.y0In + p.y)) * SCALE_PX,
  });
  const points = (ps: readonly FoldPoint[]) =>
    ps
      .map(at)
      .map(({ x, y }) => `${x},${y}`)
      .join(" ");
  const { checks } = layout;
  const bad = new Set<number>([
    ...(checks.outside === null ? [] : [checks.outside]),
    ...(checks.crossing ?? []),
  ]);
  const red = pal.status.red.base;
  const magnetBad = checks.drivers !== null && !checks.drivers.magnetClear;
  const { gates } = layout;
  const drivers = plan.drivers;
  const spot = drivers ? layout.driverBody : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      role="img"
      aria-label={SPEAKER_TEXT.foldSectionLabel}
    >
      {/* the box: its walls, and the clear inside */}
      <rect
        x={PAD_PX}
        y={PAD_PX}
        width={dims.d * SCALE_PX}
        height={dims.h * SCALE_PX}
        fill={pal.edge}
        stroke={pal.ink}
      />
      <polygon
        points={points([
          { z: 0, y: 0 },
          { z: room.depthIn, y: 0 },
          { z: room.depthIn, y: room.heightIn },
          { z: 0, y: room.heightIn },
        ])}
        fill={pal.panel}
      />
      {/* the passage: each leg and each turn */}
      {layout.pieces.map((piece, i) => (
        <polygon key={`a${i}`} points={points(piece)} fill={alpha(pal.cyan, 0.28)} />
      ))}
      {/* the mouth: the last gate, open in its wall */}
      {gates.length > 0 && (
        <line
          {...((g) => ({ x1: at(g.a).x, y1: at(g.a).y, x2: at(g.b).x, y2: at(g.b).y }))(
            gates[gates.length - 1],
          )}
          stroke={pal.cyan}
          strokeWidth={2}
        />
      )}
      {layout.outlines.map((o, i) => (
        <polygon
          key={`b${i}`}
          points={points(o)}
          fill={bad.has(i) ? red : pal.edge}
          stroke={pal.ink}
          strokeWidth={1}
        />
      ))}
      {spot && (
        <polygon
          points={points(spot)}
          fill={alpha(magnetBad ? red : pal.magenta, 0.55)}
          stroke={magnetBad ? red : pal.magenta}
          strokeWidth={1}
        />
      )}
      {spot && (
        <circle
          {...((p) => ({ cx: p.x, cy: p.y }))(
            at({ z: (spot[0].z + spot[1].z) / 2, y: (spot[0].y + spot[1].y) / 2 }),
          )}
          r={SPOT_PX}
          fill={pal.magenta}
        />
      )}
    </svg>
  );
}
