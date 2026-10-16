import { useEffect, useMemo, useRef, useState } from "react";
import type { FoldCheck, FoldWall, HornDrive, HornFold, HornSegment, SidePoint } from "../../types";
import type { FoldTraceInput } from "../../lib/speaker/foldTrace";
import { foldTrace } from "../../lib/speaker/foldTrace";
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
import { FOLD_END, FOLD_SNAP_IN } from "../../constants/foldHorn";
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
import { traceModel } from "../../lib/speaker/foldHorn";
import { FoldPathChart, targetPathPoints } from "../charts/FoldPathChart";
import { Icon, IconButton } from "../ui/IconButton";
import { usePalette } from "../../hooks/useTheme";
import { useElementWidth } from "../../hooks/useElementWidth";
import { SVG_FONT } from "../../styles/fonts";
import type { Palette } from "../../styles/palette";

/** The editor's tools (each a button over the drawing). */
const TOOL = {
  move: "move",
  board: "board",
  remove: "remove",
  drivers: "drivers",
  mouth: "mouth",
  square: "square",
} as const;
type Tool = (typeof TOOL)[keyof typeof TOOL];

/** The drawing's scale, px per inch of the viewBox, and its margin round the walls, px. */
const PX = 10;
const PAD_PX = 14;
/** The mouth a new click opens: this far each side of the click, in. */
const NEW_MOUTH_HALF_IN = 4;
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
export function FoldEditor({ room, fold, target, onChange, setType }: Props) {
  const pal = usePalette();
  const [frame, widthPx] = useElementWidth(800);
  const [tool, setTool] = useState<Tool>(TOOL.move);
  /** the fold while a press is held; null between presses */
  const [draft, setDraft] = useState<HornFold | null>(null);
  /** a board being drawn: its two ends */
  const [drawing, setDrawing] = useState<{ a: SidePoint; b: SidePoint } | null>(null);
  /** the place along the path pointed at, in from the closed end */
  const [hoverIn, setHoverIn] = useState<number | null>(null);
  const press = useRef<
    | { kind: "end"; drag: EndDrag }
    | { kind: "board"; drag: BoardDrag }
    | { kind: "drivers" }
    | { kind: "mouth"; end: "fromIn" | "toIn" }
    | null
  >(null);
  const history = useRef<HornFold[]>([]);
  const svg = useRef<SVGSVGElement | null>(null);

  const shown = draft ?? fold;
  const trace = useMemo(() => foldTrace({ ...room, fold: shown }), [room, shown]);
  const { depthIn: D, heightIn: H, boardIn: T } = room;
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
  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const X = (z: number) => PAD_PX + (z + T) * PX;
  const Y = (y: number) => PAD_PX + (H - y + T) * PX;
  const W = (D + 2 * T) * PX + 2 * PAD_PX;
  const Hpx = (H + 2 * T) * PX + 2 * PAD_PX;
  /** viewBox units per screen pixel: marks, handles and text keep their size on screen at any drawing width */
  const u = W / Math.max(1, widthPx);
  const toPoint = (e: React.PointerEvent): SidePoint => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return { zIn: 0, yIn: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { zIn: (p.x - PAD_PX) / PX - T, yIn: H + T - (p.y - PAD_PX) / PX };
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
    const p = toPoint(e);
    const data = e.target instanceof Element ? e.target.getAttribute("data-hit") : null;
    const [what, ...rest] = (data ?? "").split(":");
    const i = Number(rest[0]);
    const end = rest[1] === "a" || rest[1] === "b" ? rest[1] : null;
    const capture = () => svg.current?.setPointerCapture(e.pointerId);
    switch (tool) {
      case TOOL.mouth: {
        if (what === "mouth" && (rest[0] === "fromIn" || rest[0] === "toIn")) {
          press.current = { kind: "mouth", end: rest[0] };
          setDraft(fold);
          capture();
          return;
        }
        const dists: Record<FoldWall, number> = {
          baffle: Math.abs(p.zIn),
          back: Math.abs(D - p.zIn),
          bottom: Math.abs(p.yIn),
          top: Math.abs(H - p.yIn),
        };
        const wall = (Object.keys(dists) as FoldWall[]).reduce((a, b) =>
          dists[b] < dists[a] ? b : a,
        );
        const along = upright(wall) ? p.yIn : p.zIn;
        const span = upright(wall) ? H : D;
        const snap = (v: number) =>
          Math.min(span, Math.max(0, Math.round(v / FOLD_SNAP_IN) * FOLD_SNAP_IN));
        commit({
          ...fold,
          mouth: {
            wall,
            fromIn: snap(along - NEW_MOUTH_HALF_IN),
            toIn: snap(along + NEW_MOUTH_HALF_IN),
          },
        });
        return;
      }
      case TOOL.board:
        setDrawing({ a: snapEnd(fold, box, T, p), b: snapEnd(fold, box, T, p) });
        capture();
        return;
      case TOOL.square:
        if (what === "joint" && end) commit(toggleSquare(fold, box, T, i, end));
        return;
      case TOOL.remove:
        if (what === "joint" && end) commit(unjoinCorner(fold, box, T, i, end));
        else if (what === "drivers") commit({ ...fold, drivers: null });
        else if (what === "board") commit(deleteBoard(fold, i));
        return;
      case TOOL.drivers:
        if (what === "drivers" && fold.drivers)
          commit({ ...fold, drivers: { ...fold.drivers, face: fold.drivers.face === 1 ? -1 : 1 } });
        else if (what === "board") {
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
        if (what === "joint" && end)
          press.current = { kind: "end", drag: startEndDrag(fold, box, T, i, end) };
        else if (what === "drivers") press.current = { kind: "drivers" };
        else if (what === "board")
          press.current = { kind: "board", drag: startBoardDrag(fold, box, T, i, p) };
        else return;
        setDraft(fold);
        capture();
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toPoint(e);
    if (drawing) {
      setDrawing({ ...drawing, b: snapEnd(fold, box, T, p) });
      return;
    }
    const held = press.current;
    if (!held || !draft) {
      setHoverIn(pathAt(p));
      return;
    }
    if (held.kind === "end") setDraft(dragEnd(held.drag, p));
    else if (held.kind === "board") setDraft(dragBoard(held.drag, p));
    else if (held.kind === "drivers" && draft.drivers) {
      const bd = draft.boards[draft.drivers.board];
      setDraft({ ...draft, drivers: { ...draft.drivers, along: segDist(p, bd.a, bd.b).t } });
    } else if (held.kind === "mouth") {
      const m = draft.mouth;
      const span = upright(m.wall) ? H : D;
      const along = Math.min(
        span,
        Math.max(0, Math.round((upright(m.wall) ? p.yIn : p.zIn) / FOLD_SNAP_IN) * FOLD_SNAP_IN),
      );
      const next = { ...m, [held.end]: along };
      setDraft({
        ...draft,
        mouth: {
          ...next,
          fromIn: Math.min(next.fromIn, next.toIn),
          toIn: Math.max(next.fromIn, next.toIn),
        },
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawing) {
      commit(addBoard(fold, box, T, drawing.a, toPoint(e)));
      setDrawing(null);
    } else if (draft) commit(draft);
    press.current = null;
    setDraft(null);
  };

  const passage = useMemo(() => {
    const [r, g, b] = rgbOf(pal.cyan);
    const [yr, yg, yb] = rgbOf(pal.yellow);
    const { grid, pathIn } = trace;
    return gridImage(grid, (k) => {
      if (grid.solid[k]) return null;
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

  const m = shown.mouth;
  const mouthLine: [SidePoint, SidePoint] =
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
      icon: (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="1.5" />
        </>
      ),
    },
    {
      id: TOOL.mouth,
      label: FOLD_EDITOR_TEXT.mouth,
      icon: <path d="M3 2v4M3 10v4M6 8h7M10 5l3 3-3 3" />,
    },
    { id: TOOL.square, label: FOLD_EDITOR_TEXT.square, icon: <path d="M3 2v11h11M3 9h4v4" /> },
  ];

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="relative" ref={frame}>
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
          onPointerCancel={onPointerUp}
          onPointerLeave={() => !press.current && !drawing && setHoverIn(null)}
        >
          <rect
            x={PAD_PX}
            y={PAD_PX}
            width={(D + 2 * T) * PX}
            height={(H + 2 * T) * PX}
            rx={3}
            fill={pal.faint}
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
          <line
            x1={X(mouthLine[0].zIn)}
            y1={Y(mouthLine[0].yIn)}
            x2={X(mouthLine[1].zIn)}
            y2={Y(mouthLine[1].yIn)}
            stroke={pal.panel}
            strokeWidth={T * PX + 2}
          />
          <line
            x1={X(mouthLine[0].zIn)}
            y1={Y(mouthLine[0].yIn)}
            x2={X(mouthLine[1].zIn)}
            y2={Y(mouthLine[1].yIn)}
            stroke={pal.cyan}
            strokeWidth={4 * u}
            strokeLinecap="round"
          />
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
                data-hit={`board:${i}`}
                points={poly.map((q) => `${X(q.zIn)},${Y(q.yIn)}`).join(" ")}
                fill={pal.faint}
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
                data-hit="drivers"
                cx={X(dp.mid.zIn)}
                cy={Y(dp.mid.yIn)}
                r={6 * u}
                fill={pal.magenta}
                style={{ cursor: "grab" }}
              />
            </g>
          ))}
          <JointMarks fold={shown} box={box} boardIn={T} tool={tool} X={X} Y={Y} pal={pal} u={u} />
          {tool === TOOL.mouth &&
            (["fromIn", "toIn"] as const).map((end, k) => (
              <circle
                key={end}
                data-hit={`mouth:${end}`}
                cx={X(mouthLine[k].zIn)}
                cy={Y(mouthLine[k].yIn)}
                r={7 * u}
                fill={pal.panel}
                stroke={pal.cyan}
                strokeWidth={2 * u}
                style={{ cursor: "grab" }}
              />
            ))}
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
      </div>
      <p className="text-xs text-stone-500">{FOLD_EDITOR_TEXT.key}</p>
      <FoldPathChart
        sections={trace.sections}
        target={target}
        taps={trace.taps}
        hoverIn={hoverIn}
        onHover={setHoverIn}
      />
      <StatTileGrid tiles={foldTiles(trace, target)} />
      {trace.checks.map((c, k) => (
        <Notice key={k}>{checkText(c)}</Notice>
      ))}
      {trace.hornType && trace.hornType !== setType && (
        <Notice>
          {FOLD_CHECK_TEXT.typeDiffers(HORN_DRIVE_NAMES[trace.hornType], HORN_DRIVE_NAMES[setType])}
        </Notice>
      )}
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
          const r = (handle ? 6 : 4) * u;
          const look = {
            "data-hit": handle ? `joint:${i}:${end}` : undefined,
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

/**
 * How far the traced passage strays from the straight horn, dB: the rms of 20·log10 of their areas' ratio at each traced
 * section along both; null when they share no length.
 */
export function offTargetDb(
  sections: ReturnType<typeof foldTrace>["sections"],
  target: readonly HornSegment[],
): number | null {
  const points = targetPathPoints(target);
  const end = points.length ? points[points.length - 1].sIn : 0;
  const ratios = sections.flatMap((q) => {
    if (q.sIn > end || q.areaIn2 <= 0) return [];
    const after = points.findIndex((p) => p.sIn >= q.sIn);
    if (after < 0) return [];
    const p0 = points[Math.max(0, after - 1)];
    const p1 = points[after];
    const k = p1.sIn > p0.sIn ? (q.sIn - p0.sIn) / (p1.sIn - p0.sIn) : 0;
    const area = p0.areaIn2 + (p1.areaIn2 - p0.areaIn2) * k;
    return area > 0 ? [20 * Math.log10(q.areaIn2 / area)] : [];
  });
  if (!ratios.length) return null;
  return Math.sqrt(ratios.reduce((sum, r) => sum + r * r, 0) / ratios.length);
}

/** The fold's figures: path, mouth area, where the cones open, the rear chamber's air and the match. */
function foldTiles(
  trace: ReturnType<typeof foldTrace>,
  target: readonly HornSegment[],
): StatTileItem[] {
  if (!trace.sections.length) return [];
  const mouth = trace.sections[trace.sections.length - 1];
  const fmt = (t: number | null) => (t === null ? null : `${t.toFixed(1)} in`);
  const rear = traceModel(trace).rearLiters;
  const off = offTargetDb(trace.sections, target);
  return [
    [FOLD_STAT_TEXT.path, trace.pathIn.toFixed(1), "in"],
    [FOLD_STAT_TEXT.mouth, mouth.areaIn2.toFixed(0), "in²"],
    [FOLD_STAT_TEXT.taps, FOLD_STAT_TEXT.tapsAt(fmt(trace.taps.front), fmt(trace.taps.back)), ""],
    ...(rear !== null ? [[FOLD_STAT_TEXT.rear, rear.toFixed(1), "L"] satisfies StatTileItem] : []),
    ...(off !== null
      ? [[FOLD_STAT_TEXT.match, `±${off.toFixed(1)}`, "dB"] satisfies StatTileItem]
      : []),
  ];
}
