// A straight front-loaded horn chamber seen from above, as its editor (#255, the draw-first mock): drag the driver
// board (the flare's length), a throat corner (the compression ratio), or the back or side wall (the box's depth or
// width). The rest is worked out from the box (pages/speaker/straightHorn). It takes the folded horn editor's look:
// its tool row, its colors, its legend and its tiles.
import { useRef, useState } from "react";
import type { SpeakerCabinet } from "../../types";
import { useUnits } from "../../hooks/useUnits";
import { usePalette } from "../../hooks/useTheme";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { FOLD_TWO_COLUMN_PX } from "../../styles/layout";
import { SVG_FONT } from "../../styles/fonts";
import type { Palette } from "../../styles/palette";
import { hornFlare, slotOpeningsAt, speakerLayout } from "../../lib/speaker/speakerLayout";
import { hornTopSection, type PlanBox, type PlanPoint } from "../../lib/speaker/hornTopSection";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { DRAG_STEP_IN } from "../../lib/speaker/driverDrag";
import { foldDriverParts } from "../../lib/speaker/foldTrace";
import { foldDriverShape } from "../../lib/speaker/foldHorn";
import { clamp } from "../../lib/clamp";
import { PORT_SHAPE, SLOT_PLACE, VENT_KIND } from "../../constants/speakerSpec";
import {
  FOLD_EDITOR_TEXT,
  FOLD_STAT_TEXT,
  SPEAKER_TEXT,
  STRAIGHT_EDITOR_TEXT,
} from "../../constants/speakerPage";
import { Icon, IconButton } from "../ui/IconButton";
import { StatTileGrid, type StatTileItem } from "../stats/StatTileGrid";
import {
  straightHornSizes,
  type StraightHornEdit,
  type StraightHornSizes,
} from "../../pages/speaker/straightHorn";

/** Drawing units per inch. */
const PX = 12;
/** The margin round the box for its size labels, drawing units. */
const PAD = 30;
/** A handle's radius, drawing units. */
const HANDLE = 6;
/** The step a dragged compression ratio is rounded to. */
const RATIO_STEP = 0.05;
/** The smallest box the walls' drag allows, in. */
const MIN_BOX_IN = 6;

/** A part the drag moves. */
type Part = "board" | "throatLeft" | "throatRight" | "back" | "side" | "slot";

interface Props {
  cabinet: SpeakerCabinet;
  /** the chamber's index */
  index: number;
  /** the chamber's name, at the start of the tool row, when the speaker has more than one chamber */
  name: string | null;
  onEdit: (edit: StraightHornEdit) => void;
  /** a wall dragged: what to add to the chamber's depth and width, in */
  onResize: (grow: { depthIn: number; widthIn: number }) => void;
  /** a slot's back end dragged: the slots' new length, in */
  onSlotLength: (lenIn: number) => void;
  /** a drag starts: the card keeps the chamber as it was, for Undo */
  onDragStart: () => void;
  onUndo: () => void;
}

const snap = (v: number, step: number) => Math.round(v / step) * step;

export function StraightHornEditor({
  cabinet,
  index,
  name,
  onEdit,
  onResize,
  onSlotLength,
  onDragStart,
  onUndo,
}: Props) {
  const units = useUnits();
  const pal = usePalette();
  const [wideRef, wide] = useWidthAtLeast(FOLD_TWO_COLUMN_PX);
  const drag = useRef<{
    part: Part;
    from: { x: number; y: number };
    scale: number;
    start: StraightHornSizes;
    /** the slots' length when the drag started, in; 0 with no slots */
    slotLenIn: number;
  } | null>(null);
  const [grow, setGrow] = useState<{ depthIn: number; widthIn: number } | null>(null);
  const [hover, setHover] = useState<Part | null>(null);

  const placed = speakerLayout(cabinet).chambers[index];
  const flare = placed ? hornFlare(cabinet, placed) : null;
  const sizes = straightHornSizes(cabinet, index);
  if (!placed || !flare || !sizes) return null;
  const top = hornTopSection(placed, flare);
  const t = cabinet.panel.thicknessIn;
  const zero = baffleInsetIn(cabinet) + t;
  const { dims, clear, cx, chamber } = placed;
  const half = dims.w / 2;
  const W = dims.w * PX + 2 * PAD,
    H = dims.d * PX + 2 * PAD;
  /** across from the chamber's center line, in, to drawing units */
  const X = (x: number) => PAD + (x + half) * PX;
  /** back from the front, in, to drawing units: the front at the bottom */
  const Y = (z: number) => PAD + (dims.d - z) * PX;
  /** a point of the horn's top section (the layout's across, back from the baffle's inside face) in the drawing's */
  const plan = (p: PlanPoint) => `${X(p.x - cx)},${Y(zero + p.z)}`;
  const box = (b: PlanBox) => ({
    x: X(Math.min(b.x0, b.x1) - cx),
    y: Y(zero + Math.max(b.z0, b.z1)),
    width: Math.abs(b.x1 - b.x0) * PX,
    height: Math.abs(b.z1 - b.z0) * PX,
  });
  const vented = chamber.vent.kind === VENT_KIND.vented;
  const colors = editorColors(pal, vented);

  const port =
    chamber.vent.kind === VENT_KIND.vented &&
    chamber.vent.port.shape === PORT_SHAPE.slot &&
    chamber.vent.port.place === SLOT_PLACE.sides
      ? chamber.vent.port
      : null;
  const slots = port ? slotOpeningsAt(placed, port, t) : [];
  const handlers = (part: Part) => ({
    style: {
      cursor: part === "back" || part === "board" || part === "slot" ? "ns-resize" : "ew-resize",
      touchAction: "none",
    },
    onPointerEnter: () => setHover(part),
    onPointerLeave: () => setHover((h) => (h === part ? null : h)),
    onPointerDown: (e: React.PointerEvent<SVGElement>) => {
      const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
      if (!m) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      onDragStart();
      drag.current = {
        part,
        from: { x: e.clientX, y: e.clientY },
        scale: m.a,
        start: sizes,
        slotLenIn: port?.len ?? 0,
      };
    },
    onPointerMove: (e: React.PointerEvent<SVGElement>) => {
      const now = drag.current;
      if (!now) return;
      const dx = (e.clientX - now.from.x) / now.scale / PX,
        dy = (e.clientY - now.from.y) / now.scale / PX;
      switch (now.part) {
        case "board":
          // the front is at the bottom: up lengthens the flare
          onEdit({ flareIn: snap(now.start.flareIn - dy, DRAG_STEP_IN) });
          return;
        case "throatLeft":
        case "throatRight": {
          // the cones' area stays: the ratio goes as the throat's width goes the other way
          const side = now.part === "throatLeft" ? -1 : 1;
          const w = Math.max(DRAG_STEP_IN, now.start.throat.w + 2 * side * dx);
          onEdit({ ratio: snap((now.start.ratio * now.start.throat.w) / w, RATIO_STEP) });
          return;
        }
        case "back":
          setGrow({ depthIn: Math.max(MIN_BOX_IN - dims.d, snap(-dy, DRAG_STEP_IN)), widthIn: 0 });
          return;
        case "slot":
          // the slots run back from the baffle: up lengthens them, up to the back wall
          onSlotLength(
            clamp(snap(now.slotLenIn - dy, DRAG_STEP_IN), DRAG_STEP_IN * 4, dims.d - t - zero),
          );
          return;
        case "side":
          // both sides move: the box stays centered
          setGrow({
            depthIn: 0,
            widthIn: Math.max(MIN_BOX_IN - dims.w, snap(2 * dx, DRAG_STEP_IN)),
          });
      }
    },
    onPointerUp: () => {
      drag.current = null;
      setGrow((g) => {
        if (g && (g.depthIn || g.widthIn)) onResize(g);
        return null;
      });
    },
    onPointerCancel: () => {
      drag.current = null;
      setGrow(null);
    },
  });
  /** a yellow handle: bigger under the pointer */
  const handle = (part: Part, x: number, y: number, square = false, key: string = part) => {
    const r = hover === part ? HANDLE * 1.35 : HANDLE;
    const common = {
      fill: pal.yellow,
      stroke: pal.ink,
      strokeWidth: 1.5,
      ...handlers(part),
    };
    return square ? (
      <rect key={key} x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.5} {...common} />
    ) : (
      <circle key={key} cx={x} cy={y} r={r} {...common} />
    );
  };

  const [leg] = top.legs;
  const deep = leg?.length ? Math.max(...leg.map((p) => p.z)) : 0;
  const throatXs = leg?.filter((p) => Math.abs(p.z - deep) < 1e-6).map((p) => p.x - cx) ?? [];
  const clearX0 = clear.x - cx;
  const label = (x: number, y: number, text: string, rotate = false) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={12}
      fontFamily={SVG_FONT}
      fill={pal.ink}
      transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
    >
      {text}
    </text>
  );
  const board = top.board;
  /**
   * the drivers on the board, by the folded horn's shape (`foldDriverParts`): the board as a fold's board in the top
   * section (across as its `zIn`, back from the baffle as its `yIn`), the cones facing the mouth; across the clear
   * height as many as fit
   */
  const driverShape = foldDriverShape(chamber.drivers);
  const driverParts = board
    ? foldDriverParts(
        {
          boards: [
            {
              a: { zIn: board.x0, yIn: (board.z0 + board.z1) / 2 },
              b: { zIn: board.x1, yIn: (board.z0 + board.z1) / 2 },
            },
          ],
        },
        { board: 0, along: 0.5, face: -1 },
        driverShape && {
          ...driverShape,
          // the catalog's depth is from the board's front face; the fold's shape starts at its back face
          depthIn: Math.max(0, driverShape.depthIn - Math.abs(board.z1 - board.z0)),
        },
        clear.h,
        Math.abs(board.z1 - board.z0),
      )
    : [];
  const tiles: StatTileItem[] = [
    [FOLD_STAT_TEXT.path, units.amount("boxLength", sizes.flareIn, 1), units.unit("boxLength")],
    [
      STRAIGHT_EDITOR_TEXT.throat,
      `${units.amount("boxLength", sizes.throat.w, 1)} × ${units.amount("boxLength", sizes.throat.h, 1)}`,
      units.unit("boxLength"),
    ],
    [
      FOLD_STAT_TEXT.mouth,
      units.amount("boxArea", sizes.mouth.w * sizes.mouth.h, 0),
      units.unit("boxArea"),
    ],
    [SPEAKER_TEXT.hornCompression, sizes.ratio.toFixed(2), ""],
    [FOLD_STAT_TEXT.rear, units.amount("volume", sizes.rearLiters, 1), units.unit("volume")],
    ...(port
      ? [
          [
            FOLD_STAT_TEXT.vent,
            FOLD_STAT_TEXT.ventSize(
              units.amount("boxLength", port.h, 1),
              units.amount("boxLength", port.len, 1),
              units.unit("boxLength"),
            ),
            "",
          ] satisfies StatTileItem,
        ]
      : []),
  ];

  return (
    <div
      ref={wideRef}
      className={`${wide ? "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start" : "flex flex-col gap-3"} min-w-0`}
    >
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {name && <span className="text-xs text-stone-500">{name}</span>}
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label={FOLD_EDITOR_TEXT.tools}>
            <IconButton label={STRAIGHT_EDITOR_TEXT.move} pressed onClick={() => undefined}>
              <Icon>
                <path d="M8 2v12M2 8h12M6 4l2-2 2 2M6 12l2 2 2-2M4 6 2 8l2 2M12 6l2 2-2 2" />
              </Icon>
            </IconButton>
            <IconButton label={FOLD_EDITOR_TEXT.undo} onClick={onUndo}>
              <Icon>
                <path d="M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7" />
              </Icon>
            </IconButton>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[75vh] touch-none select-none"
          role="img"
          aria-label={STRAIGHT_EDITOR_TEXT.label}
        >
          {/* the walls, a plain inside, and the rear chamber's air filling it */}
          <rect
            x={X(-half)}
            y={Y(dims.d)}
            width={dims.w * PX}
            height={dims.d * PX}
            {...colors.boards}
          />
          {[{ fill: pal.panel }, colors.rear].map((fill, k) => (
            <rect
              key={`in${k}`}
              x={X(clearX0)}
              y={Y(dims.d - t)}
              width={clear.w * PX}
              height={(dims.d - t - zero) * PX}
              {...fill}
            />
          ))}
          {/* the open front: the mouth across it */}
          <rect
            x={X(clearX0)}
            y={Y(zero)}
            width={clear.w * PX}
            height={zero * PX}
            fill={pal.panel}
          />
          <line
            x1={X(flare.mouth.x - cx)}
            x2={X(flare.mouth.x + flare.mouth.w - cx)}
            y1={Y(0)}
            y2={Y(0)}
            stroke={pal.cyan}
            strokeWidth={4}
          />
          {/* the slots up the front sides, each with its wall on the inside */}
          {port &&
            slots.map((s, k) => {
              const inner = s.side === -1 ? s.x + s.w / 2 : s.x - s.w / 2 - t;
              return (
                <g key={`s${k}`}>
                  <rect
                    x={X(s.x - s.w / 2)}
                    y={Y(zero + port.len)}
                    width={s.w * PX}
                    height={port.len * PX}
                    fill={pal.yellow}
                  />
                  <rect
                    x={X(inner)}
                    y={Y(zero + port.len)}
                    width={t * PX}
                    height={port.len * PX}
                    {...colors.boards}
                  />
                </g>
              );
            })}
          {/* the flare, the front chamber, the board and the drivers */}
          {top.legs.flatMap((l, k) =>
            [{ fill: pal.panel }, colors.flare].map((fill, n) => (
              <polygon key={`l${k}.${n}`} points={l.map(plan).join(" ")} {...fill} />
            )),
          )}
          {top.bay && <rect {...box(top.bay)} {...colors.bay} />}
          {/* the drivers as the folded horn editor draws them: the basket to the motor, the line is the cone */}
          {driverParts.map((dp, k) => (
            <g key={`d${k}`}>
              <polygon
                points={dp.body.map((q) => `${X(q.zIn - cx)},${Y(zero + q.yIn)}`).join(" ")}
                {...colors.drivers}
              />
              <line
                x1={X(dp.coneLine.from.zIn - cx)}
                y1={Y(zero + dp.coneLine.from.yIn)}
                x2={X(dp.coneLine.to.zIn - cx)}
                y2={Y(zero + dp.coneLine.to.yIn)}
                stroke={pal.magenta}
                strokeWidth={4}
                strokeLinecap="round"
              />
            </g>
          ))}
          {board && <rect {...box(board)} {...colors.boards} {...handlers("board")} />}
          {/* the sizes */}
          {label(X(0), Y(0) + 22, units.format("boxLength", dims.w, 1))}
          {label(X(half) + 20, Y(dims.d / 2), units.format("boxLength", dims.d, 1), true)}
          {/* the wall's grab lines, then the handles on top */}
          <line
            x1={X(-half)}
            x2={X(half)}
            y1={Y(dims.d - t / 2)}
            y2={Y(dims.d - t / 2)}
            stroke="transparent"
            strokeWidth={t * PX + 10}
            {...handlers("back")}
          />
          <line
            x1={X(half - t / 2)}
            x2={X(half - t / 2)}
            y1={Y(dims.d)}
            y2={Y(0)}
            stroke="transparent"
            strokeWidth={t * PX + 10}
            {...handlers("side")}
          />
          {board &&
            handle("board", X((board.x0 + board.x1) / 2 - cx), Y(zero + (board.z0 + board.z1) / 2))}
          {throatXs.length > 0 && handle("throatLeft", X(Math.min(...throatXs)), Y(zero + deep))}
          {throatXs.length > 0 && handle("throatRight", X(Math.max(...throatXs)), Y(zero + deep))}
          {handle("back", X(0), Y(dims.d - t / 2), true)}
          {handle("side", X(half - t / 2), Y(dims.d / 2), true)}
          {port &&
            slots.map((s, k) => handle("slot", X(s.x), Y(zero + port.len), false, `slot${k}`))}
          {/* the box's new size while a wall is dragged */}
          {grow && (
            <rect
              x={X(-half - grow.widthIn / 2)}
              y={Y(dims.d + grow.depthIn)}
              width={(dims.w + grow.widthIn) * PX}
              height={(dims.d + grow.depthIn) * PX}
              fill="none"
              stroke={pal.ink}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </svg>
        <Legend pal={pal} vented={vented} slots={slots.length > 0} />
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <StatTileGrid tiles={tiles} />
      </div>
    </div>
  );
}

/** The editor's fills, in the folded horn editor's colors. */
function editorColors(pal: Palette, vented: boolean) {
  return {
    boards: { fill: pal.muted, fillOpacity: 0.6, stroke: pal.ink, strokeWidth: 1 },
    rear: { fill: pal.yellow, fillOpacity: vented ? 0.25 : 0.6 },
    flare: { fill: pal.cyan, fillOpacity: 0.35, stroke: pal.cyan, strokeWidth: 1.5 },
    bay: { fill: pal.cyan, fillOpacity: 0.15, stroke: pal.cyan, strokeWidth: 1 },
    drivers: { fill: pal.magenta, fillOpacity: 0.35, stroke: pal.magenta, strokeWidth: 1 },
  };
}

/** The drawing's legend: the folded horn editor's entries, with the flare and the handles. */
function Legend({ pal, vented, slots }: { pal: Palette; vented: boolean; slots: boolean }) {
  const fold = FOLD_EDITOR_TEXT.legend;
  const own = STRAIGHT_EDITOR_TEXT.legend;
  const items: { label: string; style: React.CSSProperties }[] = [
    { label: fold.boards, style: { background: pal.muted, opacity: 0.6 } },
    { label: own.flare, style: { background: pal.cyan, opacity: 0.5 } },
    vented
      ? { label: fold.ported, style: { background: pal.yellow, opacity: 0.25 } }
      : { label: fold.sealed, style: { background: pal.yellow, opacity: 0.6 } },
    { label: fold.drivers, style: { background: pal.magenta } },
    { label: fold.mouth, style: { background: pal.cyan } },
    ...(slots ? [{ label: fold.vent, style: { background: pal.yellow } }] : []),
    {
      label: own.handle,
      style: { background: pal.yellow, borderRadius: "50%", border: `1px solid ${pal.ink}` },
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
      {items.map(({ label, style }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={style} />
          {label}
        </span>
      ))}
    </div>
  );
}
