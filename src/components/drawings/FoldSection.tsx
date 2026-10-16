import { useRef, useState } from "react";
import type { HornBoards, SpeakerCabinet } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { alpha } from "../../styles/palette";
import type { ChamberFold, PlacedChamber } from "../../lib/speaker/speakerLayout";
import { hornBoardsLayout, type FoldPoint } from "../../lib/speaker/hornBoards";
import { withBoardMoved, withCornerAt, withDriversAt } from "../../lib/speaker/foldEdit";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { FOLD_WALL } from "../../constants/hornBoards";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";

/** A box wall the side view drags: the back, or the top. */
type DragWall = typeof FOLD_WALL.back | typeof FOLD_WALL.top;

interface Props {
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">;
  placed: Pick<PlacedChamber, "dims" | "y0">;
  fold: ChamberFold;
  /** sets the horn's own boards from a drag (a corner, a board, the drivers); absent: the drawing is not edited */
  onPlan?: (plan: HornBoards) => void;
  /** moves the back wall back, or the top up, `byIn` (less: in or down) */
  onWall?: (wall: DragWall, byIn: number) => void;
}

/** What is being dragged: a corner, a board (from where the press was, on the plan then), the drivers, or a wall. */
type Drag =
  | { kind: "corner"; i: number }
  | { kind: "board"; i: number; from: FoldPoint; start: HornBoards }
  | { kind: "drivers" }
  | { kind: "wall"; wall: DragWall; from: FoldPoint; byIn: number };

/** A drag handle's half size, px, and a wall's grab width, px. */
const HANDLE_PX = 3.5;
const WALL_GRAB_PX = 8;
/** The least clear depth or height a wall drag leaves, in. */
const MIN_ROOM_IN = 6;

/** The drawing's scale, px per inch, and its margin, px (as the straight sections'). */
const SCALE_PX = 6;
const PAD_PX = 4;
/** The mouth label's gap from the baffle, px (its size is 2.5 times it). */
const MOUTH_LABEL_PX = 4;
/** The drivers' mounting point's radius, px. */
const SPOT_PX = 3;

/**
 * A folded horn chamber's side section, to scale, the baffle at the left: its walls, the passage between its boards
 * (from the gates, lib/speaker/hornBoards), the boards with the drivers' cutouts through theirs, and the drivers' basket
 * and motor behind it, in round steps as the straight horns' drivers are drawn. A board
 * past the chamber or crossing another, and a magnet that hits a board, are drawn in the error color.
 */
export function FoldSection({ cabinet, placed, fold, onPlan, onWall }: Props) {
  const pal = usePalette();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** the boards as a drag has them, before it ends and they are saved */
  const [draft, setDraft] = useState<HornBoards | null>(null);
  const { dims, y0 } = placed;
  const { room } = fold;
  const plan = draft ?? fold.plan;
  const layout = draft ? hornBoardsLayout(draft, room, fold.body) : fold.layout;
  const editable = onPlan !== undefined;
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
  /** where a pointer is in the side section, in */
  const pointerAt = (e: React.PointerEvent): FoldPoint | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return {
      z: (x - PAD_PX) / SCALE_PX - zero,
      y: y0 + dims.h - (y - PAD_PX) / SCALE_PX - fold.y0In,
    };
  };
  /** starts a drag from a press on a part, the pointer held by the drawing until it lets go */
  const start = (e: React.PointerEvent, next: Drag) => {
    if (!editable) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag(next);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointerAt(e);
    if (!p) return;
    if (drag.kind === "corner") setDraft(withCornerAt(plan, drag.i, p, room));
    else if (drag.kind === "board")
      setDraft(
        withBoardMoved(drag.start, drag.i, { z: p.z - drag.from.z, y: p.y - drag.from.y }, room),
      );
    else if (drag.kind === "drivers") setDraft(withDriversAt(plan, p));
    else {
      const raw = drag.wall === FOLD_WALL.back ? p.z - drag.from.z : p.y - drag.from.y;
      const span = drag.wall === FOLD_WALL.back ? room.depthIn : room.heightIn;
      const byIn = Math.max(
        MIN_ROOM_IN - span,
        Math.round(raw / SPEAKER_STEPS.sizeIn) * SPEAKER_STEPS.sizeIn,
      );
      setDrag({ ...drag, byIn });
    }
  };
  const end = () => {
    if (drag?.kind === "wall") {
      if (drag.byIn !== 0) onWall?.(drag.wall, drag.byIn);
    } else if (draft) onPlan?.(draft);
    setDrag(null);
    setDraft(null);
  };
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
  const bodies = drivers ? layout.driverBodies : [];
  const mounts = drivers ? layout.driverMounts : [];
  /** each row's cutout through the drivers' board: the board's outline between the cutout's two edges */
  const cutouts = (() => {
    const board = drivers ? layout.outlines[drivers.board] : undefined;
    const r = (fold.body?.cutoutIn ?? 0) / 2;
    if (!board || r <= 0) return [];
    const [a, b, ob, oa] = board;
    const lengthIn = Math.hypot(b.z - a.z, b.y - a.y);
    const lerp = (p: FoldPoint, q: FoldPoint, u: number) => ({
      z: p.z + (q.z - p.z) * u,
      y: p.y + (q.y - p.y) * u,
    });
    return mounts.map((m) => {
      const [u0, u1] = [(m.alongIn - r) / lengthIn, (m.alongIn + r) / lengthIn];
      return [lerp(a, b, u0), lerp(a, b, u1), lerp(oa, ob, u1), lerp(oa, ob, u0)];
    });
  })();
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-full ${editable ? "select-none" : ""}`}
      style={editable ? { touchAction: "none" } : undefined}
      role="img"
      aria-label={SPEAKER_TEXT.foldSectionLabel}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
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
      {gates.length > 0 &&
        ((g) => (
          <text
            x={Math.min(at(g.a).x, at(g.b).x) + MOUTH_LABEL_PX}
            y={(at(g.a).y + at(g.b).y) / 2}
            fontSize={MOUTH_LABEL_PX * 2.5}
            fill={pal.ink}
            dominantBaseline="middle"
          >
            {SPEAKER_TEXT.foldMouthLabel}
          </text>
        ))(gates[gates.length - 1])}
      {layout.outlines.map((o, i) => (
        <polygon
          key={`b${i}`}
          points={points(o)}
          fill={bad.has(i) ? red : pal.edge}
          stroke={pal.ink}
          strokeWidth={1}
          className={editable ? "cursor-move" : undefined}
          onPointerDown={(e) => {
            const from = pointerAt(e);
            if (from) start(e, { kind: "board", i, from, start: plan });
          }}
        />
      ))}
      {/* the drivers' cutouts: openings through their board */}
      {cutouts.map((hole, i) => (
        <polygon
          key={`h${i}`}
          points={points(hole)}
          fill={pal.panel}
          stroke={pal.ink}
          strokeWidth={0.5}
        />
      ))}
      {/* the drivers' bodies, as the straight horns' drivers are drawn: each round step of the basket and motor */}
      {bodies.map((step, i) => (
        <polygon key={`d${i}`} points={points(step)} fill={magnetBad ? red : pal.muted} />
      ))}
      {mounts.map((m, i) => (
        <circle
          key={`p${i}`}
          {...((p) => ({ cx: p.x, cy: p.y }))(at(m.at))}
          r={SPOT_PX}
          fill={pal.magenta}
          className={editable ? "cursor-grab" : undefined}
          onPointerDown={(e) => start(e, { kind: "drivers" })}
        />
      ))}
      {/* the drag handles: each corner (a square on a wall, a circle free), and the back and top walls */}
      {editable &&
        plan.corners.map((c, i) => {
          const { x, y } = at(c);
          const common = {
            fill: pal.panel,
            stroke: pal.ink,
            strokeWidth: 1,
            className: "cursor-pointer",
            onPointerDown: (e: React.PointerEvent) => start(e, { kind: "corner", i }),
          };
          return c.wall === null ? (
            <circle key={`c${i}`} cx={x} cy={y} r={HANDLE_PX} {...common} />
          ) : (
            <rect
              key={`c${i}`}
              x={x - HANDLE_PX}
              y={y - HANDLE_PX}
              width={2 * HANDLE_PX}
              height={2 * HANDLE_PX}
              {...common}
            />
          );
        })}
      {onWall &&
        ([FOLD_WALL.back, FOLD_WALL.top] as const).map((wall) => {
          const by = drag?.kind === "wall" && drag.wall === wall ? drag.byIn : 0;
          const back = wall === FOLD_WALL.back;
          const a = at(back ? { z: room.depthIn + by, y: 0 } : { z: 0, y: room.heightIn + by });
          const b = at(
            back
              ? { z: room.depthIn + by, y: room.heightIn }
              : { z: room.depthIn, y: room.heightIn + by },
          );
          return (
            <g key={wall}>
              {by !== 0 && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={pal.ink}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={WALL_GRAB_PX}
                className={back ? "cursor-ew-resize" : "cursor-ns-resize"}
                onPointerDown={(e) => {
                  const from = pointerAt(e);
                  if (from) start(e, { kind: "wall", wall, from, byIn: 0 });
                }}
              />
            </g>
          );
        })}
    </svg>
  );
}
