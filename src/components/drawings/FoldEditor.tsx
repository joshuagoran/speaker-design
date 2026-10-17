import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FoldCheck,
  FoldMouth,
  FoldWall,
  HornDrive,
  HornFold,
  HornSegment,
  SidePoint,
} from "../../types";
import type { FoldTraceInput, foldTrace } from "../../lib/speaker/foldTrace";
import {
  addBoard,
  deleteBoard,
  dragBoard,
  dragEnd,
  isSquare,
  partnerAt,
  snapEnd,
  startBoardDrag,
  startEndDrag,
  toggleSquare,
  unjoinCorner,
  type BoardDrag,
  type EndDrag,
} from "../../lib/speaker/foldBoards";
import {
  add,
  drawnSeg,
  left,
  len,
  segDist,
  sub,
  unit,
  JOIN_IN,
} from "../../lib/speaker/foldGeometry";
import { FOLD_END, FOLD_MIN_ROOM_IN, FOLD_SNAP_IN } from "../../constants/foldHorn";
import { FOLD_WALL } from "../../constants/speakerSpec";
import {
  FOLD_CHECK_TEXT,
  FOLD_EDITOR_TEXT,
  FOLD_STAT_TEXT,
  HORN_DRIVE_NAMES,
} from "../../constants/speakerPage";
import { FOLD_CHECK } from "../../constants/foldHorn";
import { StatTileGrid, type StatTileItem } from "../stats/StatTileGrid";
import { Notice } from "../ui/Notice";
import { formatInches } from "../../lib/format";
import { tracedFold } from "../../lib/speaker/foldHorn";
import { FoldPathChart } from "../charts/FoldPathChart";
import { offTargetDb } from "../../lib/speaker/foldMatch";
import { Icon, IconButton } from "../ui/IconButton";
import { usePalette } from "../../hooks/useTheme";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { FOLD_TWO_COLUMN_PX } from "../../styles/layout";
import { SVG_FONT } from "../../styles/fonts";
import type { Palette } from "../../styles/palette";

/** The editor's tools (each a button over the drawing). */
const TOOL = {
  move: "move",
  board: "board",
  remove: "remove",
  drivers: "drivers",
  opening: "opening",
  square: "square",
} as const;
type Tool = (typeof TOOL)[keyof typeof TOOL];

/** What a press lands on, as its `data-hit` starts: a board, a board's end, the drivers, or a mouth or vent handle. */
const HIT = {
  board: "board",
  joint: "joint",
  drivers: "drivers",
  mouth: "mouth",
  vent: "vent",
  wall: "wall",
} as const;

/** The fold's openings in a wall: the horn's mouth and the rear chamber's vent. */
type OpeningKey = keyof Pick<HornFold, "mouth" | "vent">;

/** The drawing's scale, px per inch of the viewBox, and its margin round the walls, px. */
const PX = 10;
const PAD_PX = 14;
/** The mouth a new click opens: this far each side of the click, in. */
const NEW_MOUTH_HALF_IN = 4;
/** The vent a new click opens: this far each side of the click, in. */
const NEW_VENT_HALF_IN = 1.5;
/** The band of air the chart's pointer lights: this far each side of its distance, in. */
const BAND_IN = 0.4;
/** The steps undo keeps. */
const UNDO_STEPS = 50;

interface Props {
  /** the chamber's room for the fold: its clear depth, height and width, the boards' thickness, the drivers */
  room: Omit<FoldTraceInput, "fold">;
  fold: HornFold;
  /** the straight horn the fold should follow (the horn's stored sections), for the path chart */
  target: readonly HornSegment[];
  onChange: (fold: HornFold) => void;
  /** the Horn type setting, for the notice when the drawing makes another type */
  setType: HornDrive["kind"];
  /** a wall dragged: how much to add to the chamber's depth and height, in */
  onResize: (grow: { depthIn: number; heightIn: number }) => void;
}

/** The walls a mouth runs up (baffle, back) rather than across (bottom, top). */
const upright = (wall: FoldWall) => wall === FOLD_WALL.baffle || wall === FOLD_WALL.back;

/** `#rrggbb` as its three channels. */
function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * An image of the trace's grid, a pixel per cell, the top row first: `paint` gives each cell's color and opacity (0–1),
 * or null for none. Empty where there is no document (server rendering).
 */
function gridImage(
  grid: ReturnType<typeof foldTrace>["grid"],
  paint: (k: number) => [number, number, number, number] | null,
): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = grid.nz;
  canvas.height = grid.ny;
  const g = canvas.getContext("2d");
  if (!g) return "";
  const img = g.createImageData(grid.nz, grid.ny);
  for (let j = 0; j < grid.ny; j++)
    for (let i = 0; i < grid.nz; i++) {
      const c = paint(j * grid.nz + i);
      if (!c) continue;
      const o = ((grid.ny - 1 - j) * grid.nz + i) * 4;
      img.data.set([c[0], c[1], c[2], Math.round(c[3] * 255)], o);
    }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/**
 * A folded horn's side view as its editor: the walls, the boards, the drivers and the mouth, with the passage the trace
 * finds shaded along the path, sealed air in yellow and the closed end marked. Tool buttons sit over its top corner;
 * Ctrl+Z or Cmd+Z undoes. Under it, the passage's area along the path against the straight horn; pointing at either
 * marks the same place in the other. A drag edits a draft and hands the fold over when it ends.
 */
export function FoldEditor({ room, fold, target, onChange, setType, onResize }: Props) {
  const pal = usePalette();
  /** the drawing's width on screen, px: below the frame's when its height cap narrows it */
  const [widthPx, setWidthPx] = useState(800);
  const [wideRef, wide] = useWidthAtLeast(FOLD_TWO_COLUMN_PX);
  const [tool, setTool] = useState<Tool>(TOOL.move);
  /** the fold while a press is held; null between presses */
  const [draft, setDraft] = useState<HornFold | null>(null);
  /** a board being drawn: its two ends */
  const [drawing, setDrawing] = useState<{ a: SidePoint; b: SidePoint } | null>(null);
  /** the place along the path pointed at, in from the closed end */
  const [hoverIn, setHoverIn] = useState<number | null>(null);
  /** what the held press drags: a board's end, a board, the drivers, or a mouth's end (the other end stays at `fixedIn`) */
  const press = useRef<
    | { kind: typeof HIT.joint; drag: EndDrag }
    | { kind: typeof HIT.board; drag: BoardDrag }
    | { kind: typeof HIT.drivers }
    | { kind: typeof HIT.mouth; key: OpeningKey; fixedIn: number }
    | {
        kind: typeof HIT.wall;
        wall: typeof FOLD_WALL.back | typeof FOLD_WALL.top;
        /** where the press started on screen, px, and the drawing's inches per screen px then */
        x: number;
        y: number;
        inPerPx: number;
      }
    | null
  >(null);
  /** the held pointer, so a second touch neither starts nor ends a press */
  const pointer = useRef<number | null>(null);
  /** the draft as last set, for the press's end */
  const latest = useRef<HornFold | null>(null);
  const history = useRef<HornFold[]>([]);
  const svg = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w) setWidthPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const keys = useRef<HTMLDivElement | null>(null);

  const shown = draft ?? fold;
  const traced = useMemo(() => tracedFold(room, shown), [room, shown]);
  const { trace } = traced;
  const { depthIn: D, heightIn: H, boardIn: T } = room;
  /** a wall being dragged: what it adds to the depth and the height so far, in */
  const [grow, setGrow] = useState<{ depthIn: number; heightIn: number } | null>(null);
  /** the room as drawn: its size with a dragged wall's change */
  const Dv = D + (grow?.depthIn ?? 0);
  const Hv = H + (grow?.heightIn ?? 0);
  const box = { depthIn: D, heightIn: H };

  const commit = (next: HornFold) => {
    if (next === fold) return;
    history.current = [...history.current.slice(-UNDO_STEPS + 1), fold];
    onChange(next);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) onChange(prev);
  };
  /** Ctrl+Z or Cmd+Z while the editor has focus (a press on the drawing gives it focus) */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  };
  const setLatest = (next: HornFold | null) => {
    latest.current = next;
    setDraft(next);
  };
  const endPress = () => {
    press.current = null;
    pointer.current = null;
    setLatest(null);
    setDrawing(null);
    setGrow(null);
  };

  const X = (z: number) => PAD_PX + (z + T) * PX;
  const Y = (y: number) => PAD_PX + (Hv - y + T) * PX;
  const W = (Dv + 2 * T) * PX + 2 * PAD_PX;
  const Hpx = (Hv + 2 * T) * PX + 2 * PAD_PX;
  /** viewBox units per screen pixel: marks, handles and text keep their size on screen at any drawing width */
  const u = W / Math.max(1, widthPx);
  const toPoint = (e: React.PointerEvent): SidePoint => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return { zIn: 0, yIn: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { zIn: (p.x - PAD_PX) / PX - T, yIn: Hv + T - (p.y - PAD_PX) / PX };
  };
  /** whether `p` is air the mouth does not reach (sealed or vented air) */
  const sealedAt = (p: SidePoint): boolean => {
    const { grid } = trace;
    const i = Math.floor(p.zIn / grid.cellIn);
    const j = Math.floor(p.yIn / grid.cellIn);
    if (i < 0 || j < 0 || i >= grid.nz || j >= grid.ny) return false;
    const k = j * grid.nz + i;
    return !grid.solid[k] && !Number.isFinite(grid.dist[k]);
  };
  const pathAt = (p: SidePoint): number | null => {
    const { grid, pathIn } = trace;
    const i = Math.floor(p.zIn / grid.cellIn);
    const j = Math.floor(p.yIn / grid.cellIn);
    if (i < 0 || j < 0 || i >= grid.nz || j >= grid.ny) return null;
    const d = grid.dist[j * grid.nz + i];
    return Number.isFinite(d) ? pathIn - d : null;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== null) return;
    keys.current?.focus({ preventScroll: true });
    const p = toPoint(e);
    const data = e.target instanceof Element ? e.target.getAttribute("data-hit") : null;
    const [what, ...rest] = (data ?? "").split(":");
    const i = Number(rest[0]);
    const end = rest[1] === "a" || rest[1] === "b" ? rest[1] : null;
    const capture = () => {
      pointer.current = e.pointerId;
      svg.current?.setPointerCapture(e.pointerId);
    };
    switch (tool) {
      case TOOL.opening: {
        const handle: OpeningKey | null =
          what === HIT.vent ? "vent" : what === HIT.mouth ? "mouth" : null;
        const at = handle && fold[handle];
        if (handle && at && (rest[0] === "fromIn" || rest[0] === "toIn")) {
          press.current = {
            kind: HIT.mouth,
            key: handle,
            fixedIn: rest[0] === "fromIn" ? at.toIn : at.fromIn,
          };
          setLatest(fold);
          capture();
          return;
        }
        const dists: Record<FoldWall, number> = {
          [FOLD_WALL.baffle]: Math.abs(p.zIn),
          [FOLD_WALL.back]: Math.abs(D - p.zIn),
          [FOLD_WALL.bottom]: Math.abs(p.yIn),
          [FOLD_WALL.top]: Math.abs(H - p.yIn),
        };
        const wall = Object.values(FOLD_WALL).reduce((a, b) => (dists[b] < dists[a] ? b : a));
        const along = upright(wall) ? p.yIn : p.zIn;
        const span = upright(wall) ? H : D;
        // next to the horn's passage it is the mouth; next to air the mouth does not reach, the vent
        const inside: SidePoint =
          wall === FOLD_WALL.baffle
            ? { zIn: trace.grid.cellIn / 2, yIn: p.yIn }
            : wall === FOLD_WALL.back
              ? { zIn: D - trace.grid.cellIn / 2, yIn: p.yIn }
              : wall === FOLD_WALL.bottom
                ? { zIn: p.zIn, yIn: trace.grid.cellIn / 2 }
                : { zIn: p.zIn, yIn: H - trace.grid.cellIn / 2 };
        const key: OpeningKey = sealedAt(inside) ? "vent" : "mouth";
        const snap = (v: number) =>
          Math.min(span, Math.max(0, Math.round(v / FOLD_SNAP_IN) * FOLD_SNAP_IN));
        const half = key === "vent" ? NEW_VENT_HALF_IN : NEW_MOUTH_HALF_IN;
        commit({
          ...fold,
          [key]: { wall, fromIn: snap(along - half), toIn: snap(along + half) },
        });
        return;
      }
      case TOOL.board:
        setDrawing({ a: snapEnd(fold, box, T, p), b: snapEnd(fold, box, T, p) });
        capture();
        return;
      case TOOL.square:
        if (what === HIT.joint && end) commit(toggleSquare(fold, box, T, i, end));
        return;
      case TOOL.remove:
        if (what === HIT.joint && end) commit(unjoinCorner(fold, box, T, i, end));
        else if (what === HIT.drivers) commit({ ...fold, drivers: null });
        else if (what === HIT.vent) commit(withoutVent(fold));
        else if (what === HIT.board) commit(deleteBoard(fold, i));
        return;
      case TOOL.drivers:
        if (what === HIT.drivers && fold.drivers)
          commit({ ...fold, drivers: { ...fold.drivers, face: fold.drivers.face === 1 ? -1 : 1 } });
        else if (what === HIT.board) {
          const bd = fold.boards[i];
          commit({
            ...fold,
            drivers:
              fold.drivers?.board === i
                ? { ...fold.drivers, face: fold.drivers.face === 1 ? -1 : 1 }
                : { board: i, along: segDist(p, bd.a, bd.b).t, face: 1 },
          });
        }
        return;
      case TOOL.move:
        if (what === HIT.joint && end)
          press.current = { kind: HIT.joint, drag: startEndDrag(fold, box, T, i, end) };
        else if (what === HIT.drivers) press.current = { kind: HIT.drivers };
        else if (what === HIT.board)
          press.current = { kind: HIT.board, drag: startBoardDrag(fold, box, T, i, p) };
        else if (what === HIT.wall && (rest[0] === FOLD_WALL.back || rest[0] === FOLD_WALL.top)) {
          const ctm = svg.current?.getScreenCTM();
          press.current = {
            kind: HIT.wall,
            wall: rest[0],
            x: e.clientX,
            y: e.clientY,
            inPerPx: ctm ? 1 / (ctm.a * PX) : 1 / PX,
          };
          setGrow({ depthIn: 0, heightIn: 0 });
          capture();
          return;
        } else return;
        setLatest(fold);
        capture();
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== null && e.pointerId !== pointer.current) return;
    const p = toPoint(e);
    if (drawing) {
      setDrawing({ ...drawing, b: snapEnd(fold, box, T, p) });
      return;
    }
    const held = press.current;
    if (held?.kind === HIT.wall) {
      /** the drag, in, to the snap, no smaller than the least room */
      const by = (px: number, size: number) =>
        Math.max(
          FOLD_MIN_ROOM_IN - size,
          Math.round((px * held.inPerPx) / FOLD_SNAP_IN) * FOLD_SNAP_IN,
        );
      setGrow(
        held.wall === FOLD_WALL.back
          ? { depthIn: by(e.clientX - held.x, D), heightIn: 0 }
          : { depthIn: 0, heightIn: by(held.y - e.clientY, H) },
      );
      return;
    }
    const now = latest.current;
    if (!held || !now) {
      setHoverIn(pathAt(p));
      return;
    }
    if (held.kind === HIT.joint) setLatest(dragEnd(held.drag, p));
    else if (held.kind === HIT.board) setLatest(dragBoard(held.drag, p));
    else if (held.kind === HIT.drivers && now.drivers) {
      const bd = now.boards[now.drivers.board];
      setLatest({ ...now, drivers: { ...now.drivers, along: segDist(p, bd.a, bd.b).t } });
    } else if (held.kind === HIT.mouth) {
      const m = now[held.key];
      if (!m) return;
      const span = upright(m.wall) ? H : D;
      const along = Math.min(
        span,
        Math.max(0, Math.round((upright(m.wall) ? p.yIn : p.zIn) / FOLD_SNAP_IN) * FOLD_SNAP_IN),
      );
      setLatest({
        ...now,
        [held.key]: {
          ...m,
          fromIn: Math.min(held.fixedIn, along),
          toIn: Math.max(held.fixedIn, along),
        },
      });
    }
  };

  /** the press ends: a board drawn to the release point, or the draft handed over */
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    if (drawing) commit(addBoard(fold, box, T, drawing.a, toPoint(e)));
    else if (grow && (grow.depthIn || grow.heightIn)) onResize(grow);
    else if (latest.current) commit(latest.current);
    endPress();
  };
  /** the press is cut off: nothing changes */
  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointer.current === e.pointerId) endPress();
  };

  const passage = useMemo(() => {
    const [r, g, b] = rgbOf(pal.cyan);
    const [yr, yg, yb] = rgbOf(pal.yellow);
    const { grid, pathIn } = trace;
    return gridImage(grid, (k) => {
      if (grid.solid[k]) return null;
      if (grid.vented[k]) return [yr, yg, yb, 0.2];
      const d = grid.dist[k];
      if (!Number.isFinite(d)) return [yr, yg, yb, 0.45];
      /** 0 at the mouth, 1 at the closed end; a band every 6 in along the path */
      const u = pathIn > 0 ? d / pathIn : 0;
      const band = Math.floor((pathIn - d) / 6) % 2 === 0 ? 0 : 0.08;
      return [r, g, b, 0.18 + 0.5 * u + band];
    });
  }, [trace, pal]);
  const band = useMemo(() => {
    if (hoverIn === null) return "";
    const [yr, yg, yb] = rgbOf(pal.yellow);
    const { grid, pathIn } = trace;
    return gridImage(grid, (k) =>
      Number.isFinite(grid.dist[k]) && Math.abs(pathIn - grid.dist[k] - hoverIn) <= BAND_IN
        ? [yr, yg, yb, 1]
        : null,
    );
  }, [trace, hoverIn, pal]);

  /** an opening's line along its wall, in the middle of the wall's thickness */
  const openingLine = (m: FoldMouth): [SidePoint, SidePoint] =>
    m.wall === FOLD_WALL.baffle
      ? [
          { zIn: -T / 2, yIn: m.fromIn },
          { zIn: -T / 2, yIn: m.toIn },
        ]
      : m.wall === FOLD_WALL.back
        ? [
            { zIn: D + T / 2, yIn: m.fromIn },
            { zIn: D + T / 2, yIn: m.toIn },
          ]
        : m.wall === FOLD_WALL.bottom
          ? [
              { zIn: m.fromIn, yIn: -T / 2 },
              { zIn: m.toIn, yIn: -T / 2 },
            ]
          : [
              { zIn: m.fromIn, yIn: H + T / 2 },
              { zIn: m.toIn, yIn: H + T / 2 },
            ];
  const openings = (
    [
      { key: "mouth", hit: HIT.mouth, color: pal.cyan, at: shown.mouth },
      { key: "vent", hit: HIT.vent, color: pal.yellow, at: shown.vent },
    ] as const
  ).flatMap((o) => (o.at ? [{ ...o, line: openingLine(o.at) }] : []));

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    {
      id: TOOL.move,
      label: FOLD_EDITOR_TEXT.move,
      icon: <path d="M8 2v12M2 8h12M6 4l2-2 2 2M6 12l2 2 2-2M4 6 2 8l2 2M12 6l2 2-2 2" />,
    },
    {
      id: TOOL.board,
      label: FOLD_EDITOR_TEXT.board,
      icon: <path d="M2 11 9 4M11 9v5M8.5 11.5h5" />,
    },
    { id: TOOL.remove, label: FOLD_EDITOR_TEXT.remove, icon: <path d="M4 4l8 8M12 4l-8 8" /> },
    {
      id: TOOL.drivers,
      label: FOLD_EDITOR_TEXT.drivers,
      // a driver from the side: the magnet behind, the cone opening to the front
      icon: <path d="M2 6h3v4H2zM5 6l8-4v12l-8-4" />,
    },
    {
      id: TOOL.opening,
      label: FOLD_EDITOR_TEXT.opening,
      icon: <path d="M3 2v4M3 10v4M6 8h7M10 5l3 3-3 3" />,
    },
    { id: TOOL.square, label: FOLD_EDITOR_TEXT.square, icon: <path d="M3 2v11h11M3 9h4v4" /> },
  ];

  return (
    <div
      className={`${wide ? "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start" : "flex flex-col gap-3"} min-w-0 outline-none`}
      ref={(el) => {
        keys.current = el;
        wideRef(el);
      }}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="relative min-w-0">
        <div
          className="absolute top-2 left-2 flex flex-wrap gap-1"
          role="toolbar"
          aria-label={FOLD_EDITOR_TEXT.tools}
        >
          {tools.map((t) => (
            <IconButton
              key={t.id}
              label={t.label}
              pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              <Icon>{t.icon}</Icon>
            </IconButton>
          ))}
          <IconButton label={FOLD_EDITOR_TEXT.undo} onClick={undo}>
            <Icon>
              <path d="M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7" />
            </Icon>
          </IconButton>
        </div>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${Hpx}`}
          className="w-full h-auto max-h-[75vh] touch-none select-none"
          role="img"
          aria-label={FOLD_EDITOR_TEXT.label}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => !press.current && !drawing && setHoverIn(null)}
        >
          <rect
            x={PAD_PX}
            y={PAD_PX}
            width={(Dv + 2 * T) * PX}
            height={(Hv + 2 * T) * PX}
            rx={3}
            fill={pal.muted}
            fillOpacity={0.35}
          />
          <rect x={X(0)} y={Y(H)} width={D * PX} height={H * PX} fill={pal.panel} />
          {passage && (
            <image
              href={passage}
              x={X(0)}
              y={Y(H)}
              width={D * PX}
              height={H * PX}
              preserveAspectRatio="none"
              style={{ imageRendering: "pixelated" }}
            />
          )}
          {openings.map(({ key, hit, color, line }) => (
            <g key={key}>
              <line
                x1={X(line[0].zIn)}
                y1={Y(line[0].yIn)}
                x2={X(line[1].zIn)}
                y2={Y(line[1].yIn)}
                stroke={pal.panel}
                strokeWidth={T * PX + 2}
              />
              <line
                x1={X(line[0].zIn)}
                y1={Y(line[0].yIn)}
                x2={X(line[1].zIn)}
                y2={Y(line[1].yIn)}
                stroke={color}
                strokeWidth={4 * u}
                strokeLinecap="round"
              />
              {tool === TOOL.remove && hit === HIT.vent && (
                <line
                  data-hit={hit}
                  x1={X(line[0].zIn)}
                  y1={Y(line[0].yIn)}
                  x2={X(line[1].zIn)}
                  y2={Y(line[1].yIn)}
                  stroke="transparent"
                  strokeWidth={T * PX + 16 * u}
                  style={{ cursor: "not-allowed" }}
                />
              )}
            </g>
          ))}
          {band && (
            <image
              href={band}
              x={X(0)}
              y={Y(H)}
              width={D * PX}
              height={H * PX}
              preserveAspectRatio="none"
              style={{ imageRendering: "pixelated", pointerEvents: "none" }}
            />
          )}
          {shown.boards.map((_, i) => {
            const s = drawnSeg(shown.boards, i, T);
            const n = left(unit(sub(s.b, s.a)));
            const poly = [
              add(s.a, n, T / 2),
              add(s.b, n, T / 2),
              add(s.b, n, -T / 2),
              add(s.a, n, -T / 2),
            ];
            return (
              <polygon
                key={i}
                data-hit={`${HIT.board}:${i}`}
                points={poly.map((q) => `${X(q.zIn)},${Y(q.yIn)}`).join(" ")}
                fill={pal.muted}
                fillOpacity={0.6}
                stroke={pal.ink}
                strokeWidth={1}
                style={{
                  cursor:
                    tool === TOOL.remove ? "not-allowed" : tool === TOOL.drivers ? "copy" : "move",
                }}
              />
            );
          })}
          {trace.parts.map((dp, k) => (
            <g key={k}>
              <polygon
                points={dp.body.map((q) => `${X(q.zIn)},${Y(q.yIn)}`).join(" ")}
                fill={pal.magenta}
                fillOpacity={0.35}
                stroke={pal.magenta}
                strokeWidth={1}
              />
              <line
                x1={X(dp.coneLine.from.zIn)}
                y1={Y(dp.coneLine.from.yIn)}
                x2={X(dp.coneLine.to.zIn)}
                y2={Y(dp.coneLine.to.yIn)}
                stroke={pal.magenta}
                strokeWidth={4 * u}
                strokeLinecap="round"
              />
              <circle
                data-hit={HIT.drivers}
                cx={X(dp.mid.zIn)}
                cy={Y(dp.mid.yIn)}
                r={6 * u}
                fill={pal.magenta}
                style={{ cursor: "grab" }}
              />
            </g>
          ))}
          <JointMarks fold={shown} box={box} boardIn={T} tool={tool} X={X} Y={Y} pal={pal} u={u} />
          {openings
            .filter(() => tool === TOOL.opening)
            .flatMap(({ hit, color, line }) =>
              (["fromIn", "toIn"] as const).map((end, k) => (
                <circle
                  key={`${hit}${end}`}
                  data-hit={`${hit}:${end}`}
                  cx={X(line[k].zIn)}
                  cy={Y(line[k].yIn)}
                  r={7 * u}
                  fill={pal.panel}
                  stroke={color}
                  strokeWidth={2 * u}
                  style={{ cursor: "grab" }}
                />
              )),
            )}
          {tool === TOOL.move &&
            (
              [
                {
                  wall: FOLD_WALL.back,
                  a: { zIn: Dv + T / 2, yIn: 0 },
                  b: { zIn: Dv + T / 2, yIn: Hv },
                },
                {
                  wall: FOLD_WALL.top,
                  a: { zIn: 0, yIn: Hv + T / 2 },
                  b: { zIn: Dv, yIn: Hv + T / 2 },
                },
              ] as const
            ).map(({ wall, a, b }) => (
              <line
                key={wall}
                data-hit={`${HIT.wall}:${wall}`}
                x1={X(a.zIn)}
                y1={Y(a.yIn)}
                x2={X(b.zIn)}
                y2={Y(b.yIn)}
                stroke="transparent"
                strokeWidth={T * PX + 8 * u}
                style={{ cursor: wall === FOLD_WALL.back ? "ew-resize" : "ns-resize" }}
              />
            ))}
          {grow && (
            <rect
              x={X(0)}
              y={Y(Hv)}
              width={Dv * PX}
              height={Hv * PX}
              fill="none"
              stroke={pal.ink}
              strokeDasharray={`${4 * u} ${3 * u}`}
              strokeWidth={1.5 * u}
              pointerEvents="none"
            />
          )}
          {drawing && (
            <line
              x1={X(drawing.a.zIn)}
              y1={Y(drawing.a.yIn)}
              x2={X(drawing.b.zIn)}
              y2={Y(drawing.b.yIn)}
              stroke={pal.ink}
              strokeOpacity={0.5}
              strokeWidth={T * PX}
            />
          )}
          {trace.closedEnd && (
            <g pointerEvents="none">
              <circle
                cx={X(trace.closedEnd.zIn)}
                cy={Y(trace.closedEnd.yIn)}
                r={4 * u}
                fill={pal.ink}
              />
              <text
                x={X(trace.closedEnd.zIn) + (trace.closedEnd.zIn > D - 8 ? -7 : 7)}
                y={Y(trace.closedEnd.yIn) + 4}
                textAnchor={trace.closedEnd.zIn > D - 8 ? "end" : "start"}
                fontSize={12 * u}
                fontFamily={SVG_FONT}
                fill={pal.ink}
              >
                {FOLD_EDITOR_TEXT.closedEnd}
              </text>
            </g>
          )}
        </svg>
        <FoldLegend pal={pal} />
      </div>
      <div className="flex flex-col gap-3 min-w-0">
        <FoldPathChart
          sections={trace.sections}
          target={target}
          taps={trace.taps}
          hoverIn={hoverIn}
          onHover={setHoverIn}
        />
        <StatTileGrid tiles={foldTiles(trace, traced.rearLiters, target)} />
        {trace.checks.map((c, k) => (
          <Notice key={k}>{checkText(c)}</Notice>
        ))}
        {trace.hornType && trace.hornType !== setType && (
          <Notice>
            {FOLD_CHECK_TEXT.typeDiffers(
              HORN_DRIVE_NAMES[trace.hornType],
              HORN_DRIVE_NAMES[setType],
            )}
          </Notice>
        )}
      </div>
    </div>
  );
}

/**
 * Every board end once: a yellow circle on a joint, a yellow square on a joint held at 90°, an open circle on a free
 * end. Move drags them; Square joint clicks joints; Delete clicks corners; other tools only mark joints.
 */
function JointMarks({
  fold,
  box,
  boardIn,
  tool,
  X,
  Y,
  pal,
  u,
}: {
  fold: HornFold;
  box: { depthIn: number; heightIn: number };
  boardIn: number;
  tool: Tool;
  X: (z: number) => number;
  Y: (y: number) => number;
  pal: Palette;
  /** viewBox units per screen pixel */
  u: number;
}) {
  const seen: SidePoint[] = [];
  return (
    <>
      {fold.boards.flatMap((bd, i) =>
        (["a", "b"] as const).flatMap((end) => {
          const P = bd[end];
          if (seen.some((q) => len(sub(q, P)) < JOIN_IN)) return [];
          seen.push(P);
          const partner = partnerAt(fold, box, boardIn, i, end);
          const held = isSquare(fold, box, boardIn, i, end);
          const unjoin = tool === TOOL.remove && partner?.kind === FOLD_END.corner;
          const handle = tool === TOOL.move || (tool === TOOL.square && partner !== null) || unjoin;
          if (!partner && !handle) return [];
          const r = (handle ? 7 : 5) * u;
          const look = {
            "data-hit": handle ? `${HIT.joint}:${i}:${end}` : undefined,
            fill: partner ? pal.yellow : pal.panel,
            stroke: pal.ink,
            strokeWidth: 1.5 * u,
            style: handle ? { cursor: "pointer" } : { pointerEvents: "none" as const },
          };
          return [
            held ? (
              <rect
                key={`${i}${end}`}
                x={X(P.zIn) - r}
                y={Y(P.yIn) - r}
                width={2 * r}
                height={2 * r}
                rx={1}
                {...look}
              />
            ) : (
              <circle key={`${i}${end}`} cx={X(P.zIn)} cy={Y(P.yIn)} r={r} {...look} />
            ),
          ];
        }),
      )}
    </>
  );
}

/** The drawing's legend: a swatch for each thing it draws. */
function FoldLegend({ pal }: { pal: Palette }) {
  const text = FOLD_EDITOR_TEXT.legend;
  const items: { label: string; style: React.CSSProperties }[] = [
    { label: text.boards, style: { background: pal.muted, opacity: 0.6 } },
    {
      label: text.passage,
      style: { background: `linear-gradient(90deg, ${pal.cyan}, ${pal.cyan}33)` },
    },
    { label: text.sealed, style: { background: pal.yellow, opacity: 0.6 } },
    { label: text.ported, style: { background: pal.yellow, opacity: 0.25 } },
    { label: text.drivers, style: { background: pal.magenta } },
    { label: text.mouth, style: { background: pal.cyan } },
    { label: text.vent, style: { background: pal.yellow } },
    {
      label: text.joint,
      style: { background: pal.yellow, borderRadius: "50%", border: `1px solid ${pal.ink}` },
    },
    { label: text.held, style: { background: pal.yellow, border: `1px solid ${pal.ink}` } },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-stone-500">
      {items.map(({ label, style }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={style} />
          {label}
        </span>
      ))}
    </div>
  );
}

/** The fold with no vent. */
function withoutVent(fold: HornFold): HornFold {
  const { vent: _vent, ...rest } = fold;
  return rest;
}

/** A check's notice text. */
function checkText(c: FoldCheck): string {
  switch (c.id) {
    case FOLD_CHECK.drivers:
      return FOLD_CHECK_TEXT.drivers(c.reason);
    case FOLD_CHECK.deadEnd:
      return FOLD_CHECK_TEXT.deadEnd(formatInches(c.fromClosedEndIn));
    case FOLD_CHECK.choke:
      return FOLD_CHECK_TEXT.choke(formatInches(c.fromClosedEndIn));
    case FOLD_CHECK.strayAir:
      return FOLD_CHECK_TEXT.strayAir(c.count);
    case FOLD_CHECK.thin:
      return FOLD_CHECK_TEXT.thin(formatInches(c.fromClosedEndIn), formatInches(c.widthIn));
    default:
      return FOLD_CHECK_TEXT[c.id]();
  }
}

/** The fold's figures: path, mouth area, where the cones open, the rear chamber's air and the match. */
function foldTiles(
  trace: ReturnType<typeof foldTrace>,
  /** the rear chamber's air, L (`TracedHornModel.rearLiters`) */
  rear: number | null,
  target: readonly HornSegment[],
): StatTileItem[] {
  if (!trace.sections.length) return [];
  const mouth = trace.sections[trace.sections.length - 1];
  const fmt = (t: number | null) => (t === null ? null : `${t.toFixed(1)} in`);
  const off = offTargetDb(trace.sections, target);
  return [
    [FOLD_STAT_TEXT.path, trace.pathIn.toFixed(1), "in"],
    [FOLD_STAT_TEXT.mouth, mouth.areaIn2.toFixed(0), "in²"],
    [FOLD_STAT_TEXT.taps, FOLD_STAT_TEXT.tapsAt(fmt(trace.taps.front), fmt(trace.taps.back)), ""],
    ...(rear !== null ? [[FOLD_STAT_TEXT.rear, rear.toFixed(1), "L"] satisfies StatTileItem] : []),
    ...(trace.vented
      ? [
          [
            FOLD_STAT_TEXT.vent,
            FOLD_STAT_TEXT.ventSize(
              trace.vented.duct.heightIn.toFixed(1),
              trace.vented.duct.lengthIn.toFixed(1),
            ),
            "",
          ] satisfies StatTileItem,
        ]
      : []),
    ...(off !== null
      ? [[FOLD_STAT_TEXT.match, `±${off.toFixed(1)}`, "dB"] satisfies StatTileItem]
      : []),
  ];
}
