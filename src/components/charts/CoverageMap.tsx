import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_DRAG_UPDATE_MS } from "../../constants/space";
import { ON_DATA } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useElementWidth } from "../../hooks/useElementWidth";
import { formatSigned } from "../../lib/format";
import { contourSegments, gridLevelAt } from "../../lib/acoustics/coverage";
import { materialAlpha } from "../../lib/acoustics/roomAcoustics";
import type {
  CoverageGridView,
  CoverageRoom,
  CoverageStack,
  FloorPlacement,
  FloorPoint,
  RoomSide,
} from "../../types";
import type { CouplingMark } from "../../lib/speaker/spaceCoupling";
import { SVG_FONT } from "../../styles/fonts";
import { UI_TEXT } from "../../constants/uiText";
import { COVERAGE_TEST_IDS } from "../../constants/coverageTestIds";
import { CONTOUR_STEP_DB, COVERAGE_MAP_DB } from "../../constants/chartScales";
import { COVERAGE_EDGE_DB } from "../../constants/coverageLevel";
import { OPEN_SIDE } from "../../constants/space";
import { INCHES_PER_FOOT, RAD } from "../../constants/units";
import {
  COVERAGE_CONTOURS,
  COVERAGE_GRADIENT,
  coverageRgba,
  coverageScalePos,
} from "../../styles/coverageScale";

const [LO_DB, HI_DB] = COVERAGE_MAP_DB;
/** what the map's colors show */
const SCALE_UNIT = "dB against the target";

/** where the toe-in handle sits along a stack's axis, ft */
const HANDLE_FT = 5;
/** how far the horn's coverage edges are drawn, ft */
const EDGE_FT = 30;
const PAD = { l: 30, r: 10, t: 24, b: 24 };
/** A coupled face's bar on the map, px wide. */
const COUPLING_BAR_PX = 5;

/** The quiet line's font size and the width of one of its characters, px (the map's font). */
const QUIET_FONT_PX = 12;
const QUIET_CHAR_PX = 7;

/** The quiet line as one line, or as two at the space nearest its middle when the floor is too narrow for one. */
function quietLines(text: string, widthPx: number): string[] {
  if (text.length * QUIET_CHAR_PX <= widthPx - 16) return [text];
  const mid = text.length / 2;
  const cut = [...text.matchAll(/ /g)]
    .map((m) => m.index)
    .reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a), 0);
  return [text.slice(0, cut), text.slice(cut + 1)];
}

type Drag =
  | { kind: "box"; i: number; dx: number; dy: number }
  | { kind: "aim"; i: number }
  | { kind: "listener" }
  | { kind: "alignAt" };

/**
 * A box the map draws, at its spot and aim (ft, degrees): its label, its footprint (in), the horizontal coverage of its
 * horn to draw (null: none), and whether it has a handle to turn it.
 */
export interface MapBox extends FloorPlacement {
  label: string;
  footprint: CoverageStack["footprint"];
  covH: number | null;
  turnable: boolean;
}

/**
 * What a drag on the map does: move box `i` to a spot (`free`: Alt held, so it places freely), turn it to face one, move
 * the listener, or move the alignment point (where it has one).
 */
export interface MapActions {
  moveBox: (i: number, p: FloorPoint, free: boolean) => void;
  aimBox: (i: number, p: FloorPoint, stepped: boolean) => void;
  moveListener: (p: FloorPoint) => void;
  moveAlignAt?: (p: FloorPoint) => void;
}

interface Props {
  /** the grid on show, with the room and target it was computed for (an older one while the next computes) */
  view: CoverageGridView | null;
  room: CoverageRoom;
  listener: FloorPoint;
  /** the alignment point, drawn as a diamond (absent: none) */
  alignAt?: FloorPoint;
  actions: MapActions;
  boxes: readonly MapBox[];
  /** the coupled faces, drawn in yellow: along a wall where a box meets it, and where two boxes meet (absent: none) */
  coupling?: readonly CouplingMark[];
  /**
   * the boxes picked (their indexes; a mirrored pair's two boxes are one pick) and the pick of one by a press on it or
   * its aim dot; both absent, the map has no pick
   */
  selected?: readonly number[];
  onSelect?: (i: number) => void;
  /** the most height the map may take, px */
  maxHeight: number;
  /**
   * a room with no sound in it: its line, centered on the floor, which is drawn in a neutral fill (the palette's edge
   * gray, not a level on the scale); absent, the floor shows the grid's levels
   */
  quiet?: string;
  /** whether a finer or newer grid is on its way: aria-busy only, no badge (the fine pass is quick) */
  busy: boolean;
}

/**
 * Top-down floor map: level against the target across the room on a fixed scale, with contour lines at the target, the
 * coverage edge and every 3 dB step. Drag a stack to move it, its dot to turn it, the center subs, or the listener (or tap
 * the floor to put the listener there).
 */
export function CoverageMap({
  view,
  room,
  listener,
  alignAt,
  actions,
  boxes,
  coupling = [],
  selected = [],
  onSelect,
  maxHeight,
  busy,
  quiet,
}: Props) {
  const pal = usePalette();
  const [box, cw] = useElementWidth(560);
  const k = Math.max(
    2,
    Math.min((cw - PAD.l - PAD.r) / room.widthFt, (maxHeight - PAD.t - PAD.b) / room.lengthFt),
  );
  const w = room.widthFt * k,
    h = room.lengthFt * k,
    W = w + PAD.l + PAD.r,
    H = h + PAD.t + PAD.b;
  const px = (x: number) => PAD.l + (x + room.widthFt / 2) * k,
    py = (y: number) => PAD.t + y * k;
  const toFt = (X: number, Y: number): FloorPoint => ({
    x: (X - PAD.l) / k - room.widthFt / 2,
    y: (Y - PAD.t) / k,
  });

  // where the grid lies: over its own room, which is the current one unless the room has changed since it was computed
  const gridRoom = view ? view.room : room;
  const gx = px(-gridRoom.widthFt / 2),
    gy = py(0),
    gw = gridRoom.widthFt * k,
    gh = gridRoom.lengthFt * k;
  // the heat map as a small image, one pixel a cell, scaled up smoothly
  const image = useMemo(() => {
    if (!view || typeof document === "undefined") return null;
    const { grid } = view;
    const c = document.createElement("canvas");
    c.width = grid.cols;
    c.height = grid.rows;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(grid.cols, grid.rows);
    img.data.set(coverageRgba(view));
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, [view]);
  // every contour line's path, rebuilt only when the grid, its target or the map's size changes
  const contours = useMemo(() => {
    if (!view) return [];
    const { grid, target } = view;
    const X = (x: number) => (gx + (x / grid.cols) * gw).toFixed(1),
      Y = (y: number) => (gy + (y / grid.rows) * gh).toFixed(1);
    return COVERAGE_CONTOURS.map(
      ([db, line]) =>
        [
          db,
          line,
          contourSegments(grid, target + db)
            .map(([x1, y1, x2, y2]) => `M${X(x1)},${Y(y1)}L${X(x2)},${Y(y2)}`)
            .join(""),
        ] as const,
    );
  }, [view, gx, gy, gw, gh]);

  const boxPx = (b: MapBox) => Math.max(14, (b.footprint.w / INCHES_PER_FOOT) * k);
  /** a box's middle on the plan, ft: half its depth behind its spot (its front center), along its aim */
  const boxMiddle = (b: MapBox): FloorPoint => {
    const a = b.aim * RAD,
      half = b.footprint.d / INCHES_PER_FOOT / 2;
    return { x: b.x - Math.sin(a) * half, y: b.y - Math.cos(a) * half };
  };
  const handle = (b: MapBox) => {
    const a = (b.aim * Math.PI) / 180;
    return { x: px(b.x + Math.sin(a) * HANDLE_FT), y: py(b.y + Math.cos(a) * HANDLE_FT) };
  };

  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<FloorPoint | null>(null);
  const at = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { X: ((e.clientX - r.left) / r.width) * W, Y: ((e.clientY - r.top) / r.height) * H };
  };
  /** `free` (Alt held): a box moves without snapping; `stepped` (Shift held): a box turns in 45° steps */
  const apply = (d: Drag, X: number, Y: number, free: boolean, stepped: boolean) => {
    const p = toFt(X, Y);
    if (d.kind === "listener") actions.moveListener(p);
    else if (d.kind === "alignAt") actions.moveAlignAt?.(p);
    else if (d.kind === "aim") actions.aimBox(d.i, p, stepped);
    else actions.moveBox(d.i, { x: p.x - d.dx, y: p.y - d.dy }, free);
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const { X, Y } = at(e),
      p = toFt(X, Y);
    const near = (x: number, y: number, r: number) => Math.hypot(X - x, Y - y) < r;
    let d: Drag = { kind: "listener" };
    const aimAt = boxes.findIndex((b) => {
      const hp = handle(b);
      return b.turnable && near(hp.x, hp.y, 16);
    });
    const onBox = boxes.findIndex((b) => {
      const m = boxMiddle(b);
      return near(px(m.x), py(m.y), boxPx(b) / 2 + 8);
    });
    if (aimAt >= 0) {
      d = { kind: "aim", i: aimAt };
      onSelect?.(aimAt);
    } else if (onBox >= 0) {
      onSelect?.(onBox);
      const b = boxes[onBox];
      d = { kind: "box", i: onBox, dx: p.x - b.x, dy: p.y - b.y };
    } else if (near(px(listener.x), py(listener.y), 18)) d = { kind: "listener" };
    else if (alignAt && actions.moveAlignAt && near(px(alignAt.x), py(alignAt.y), 18))
      d = { kind: "alignAt" };
    else if (p.x < -room.widthFt / 2 || p.x > room.widthFt / 2 || p.y < 0 || p.y > room.lengthFt)
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(d);
    if (d.kind === "listener") apply(d, X, Y, e.altKey, e.shiftKey);
  };
  // a drag moves the design at most every MAP_DRAG_UPDATE_MS (each move runs the room model again); the latest move
  // waits, and runs when the time is up or the drag ends, so the drag always ends where the pointer let go
  const pending = useRef<(() => void) | null>(null);
  const lastRun = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const runPending = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const run = pending.current;
    pending.current = null;
    if (run) {
      lastRun.current = performance.now();
      run();
    }
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const { X, Y } = at(e),
      p = toFt(X, Y);
    setHover(
      p.x >= -room.widthFt / 2 && p.x <= room.widthFt / 2 && p.y >= 0 && p.y <= room.lengthFt
        ? p
        : null,
    );
    if (!drag) return;
    const { altKey, shiftKey } = e;
    pending.current = () => apply(drag, X, Y, altKey, shiftKey);
    const wait = MAP_DRAG_UPDATE_MS - (performance.now() - lastRun.current);
    if (wait <= 0) runPending();
    else if (timer.current === undefined) timer.current = window.setTimeout(runPending, wait);
  };
  const up = () => {
    runPending();
    setDrag(null);
  };
  const key = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 5 : 1;
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const v = dir[e.key];
    if (!v) return;
    e.preventDefault();
    actions.moveListener({ x: listener.x + v[0], y: listener.y + v[1] });
  };

  // the grid's level under the pointer, inside the grid's own room
  const readout =
    hover &&
    view &&
    Math.abs(hover.x) <= view.room.widthFt / 2 &&
    hover.y >= 0 &&
    hover.y <= view.room.lengthFt
      ? gridLevelAt(view.grid, view.room, hover)
      : null;
  // each side's line: heavy for a hard wall, lighter for an absorbent one (curtains), dashed for open. The walls frame
  // the map against the page, so they follow the theme
  const sideLine = (side: RoomSide) => {
    const m = room.materials[side];
    if (room.outdoors || m === OPEN_SIDE)
      return { stroke: pal.muted, strokeWidth: 1.25, strokeDasharray: "4 4" };
    return { stroke: pal.ink, strokeWidth: materialAlpha(m, 1000) >= 0.5 ? 2 : 4 };
  };
  const sides: [RoomSide, number, number, number, number][] = [
    ["front", px(-room.widthFt / 2), py(0), px(room.widthFt / 2), py(0)],
    ["back", px(-room.widthFt / 2), py(room.lengthFt), px(room.widthFt / 2), py(room.lengthFt)],
    ["left", px(-room.widthFt / 2), py(0), px(-room.widthFt / 2), py(room.lengthFt)],
    ["right", px(room.widthFt / 2), py(0), px(room.widthFt / 2), py(room.lengthFt)],
  ];
  const xTicks: number[] = [],
    yTicks: number[] = [];
  for (let f = -Math.floor(room.widthFt / 20) * 10; f <= room.widthFt / 2; f += 10) xTicks.push(f);
  for (let f = 10; f <= room.lengthFt; f += 10) yTicks.push(f);
  const font = { fontSize: 11, fontFamily: SVG_FONT };

  return (
    <div ref={box}>
      <div className="flex justify-between items-baseline gap-3 text-xs text-stone-500 mb-1 min-h-[1rem]">
        <span>
          {room.outdoors
            ? UI_TEXT.outdoors
            : `${room.widthFt} × ${room.lengthFt} ft room, ${room.ceilingFt} ft ceiling`}
        </span>
        <span className="tabular-nums text-stone-900">
          {readout != null && hover && view
            ? `${hover.x.toFixed(1)}, ${hover.y.toFixed(1)} ft · ${(readout + view.gain).toFixed(1)} dB (${formatSigned(readout - view.target)})`
            : `Color: ${SCALE_UNIT}`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        // select-none: a drag would otherwise select the labels, and the next drag that starts on that selection
        // becomes the browser's own drag-and-drop (a ghost of the map, the pointer canceled, the map frozen)
        className="block max-w-full h-auto mx-auto select-none outline-none focus-visible:outline-2 focus-visible:outline-stone-900"
        style={{ touchAction: "none", cursor: drag ? "grabbing" : "crosshair" }}
        tabIndex={0}
        role="img"
        aria-busy={busy}
        data-testid={COVERAGE_TEST_IDS.map}
        aria-label={`Floor map seen from above, level in ${SCALE_UNIT}, with the target marked. The listener is ${listener.x.toFixed(0)} ft across and ${listener.y.toFixed(0)} ft down the room.${alignAt ? ` The alignment point is ${alignAt.x.toFixed(0)} ft across and ${alignAt.y.toFixed(0)} ft down the room.` : ""} Arrow keys move the listener.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setHover(null)}
        onKeyDown={key}
      >
        <defs>
          <clipPath id="coverage-room">
            <rect x={PAD.l} y={PAD.t} width={w} height={h} />
          </clipPath>
        </defs>
        <rect x={PAD.l} y={PAD.t} width={w} height={h} fill={quiet ? pal.edge : ON_DATA.edge} />
        <g clipPath="url(#coverage-room)">
          {image && (
            <image
              href={image}
              x={gx}
              y={gy}
              width={gw}
              height={gh}
              preserveAspectRatio="none"
              style={{ imageRendering: "auto" }}
            />
          )}
          {contours.map(([db, line, d]) => (
            <path
              key={db}
              d={d}
              stroke={line.color}
              strokeOpacity={line.opacity}
              strokeWidth={line.width}
              fill="none"
            />
          ))}
        </g>
        <g clipPath="url(#coverage-room)">
          {boxes.flatMap((b, i) =>
            b.covH
              ? [-1, 1].map((sg) => {
                  const a = ((b.aim + (sg * (b.covH ?? 0)) / 2) * Math.PI) / 180;
                  const p = {
                    x1: px(b.x),
                    y1: py(b.y),
                    x2: px(b.x + Math.sin(a) * EDGE_FT),
                    y2: py(b.y + Math.cos(a) * EDGE_FT),
                  };
                  return (
                    <g key={`${i}${sg}`}>
                      <line {...p} stroke={ON_DATA.ink} strokeOpacity="0.5" strokeWidth="2.5" />
                      <line {...p} stroke={ON_DATA.white} strokeWidth="1.2" strokeDasharray="4 4" />
                    </g>
                  );
                })
              : [],
          )}
        </g>
        {quiet && (
          <text
            x={PAD.l + w / 2}
            y={PAD.t + h / 2}
            textAnchor="middle"
            fill={pal.muted}
            {...font}
            fontSize={QUIET_FONT_PX}
            pointerEvents="none"
          >
            {quietLines(quiet, w).map((line, i, all) => (
              <tspan
                key={line}
                x={PAD.l + w / 2}
                dy={i === 0 ? `${-(all.length - 1) * 0.6}em` : "1.2em"}
              >
                {line}
              </tspan>
            ))}
          </text>
        )}
        {sides.map(([side, x1, y1, x2, y2]) => (
          <line
            key={side}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            {...sideLine(side)}
            strokeLinecap="square"
          />
        ))}
        {xTicks.map((f) => (
          <text
            key={"x" + f}
            x={px(f)}
            y={PAD.t - 8}
            textAnchor="middle"
            fill={pal.muted}
            {...font}
          >
            {Math.abs(f)}
          </text>
        ))}
        {yTicks.map((f) => (
          <text
            key={"y" + f}
            x={PAD.l - 6}
            y={py(f) + 4}
            textAnchor="end"
            fill={pal.muted}
            {...font}
          >
            {f}
          </text>
        ))}
        {boxes.map((b, i) => {
          const hp = handle(b);
          const bw = boxPx(b),
            bh = Math.max(14, (b.footprint.d / INCHES_PER_FOOT) * k);
          const m = boxMiddle(b);
          return (
            <g key={b.label + i}>
              {b.turnable && (
                <>
                  <line
                    x1={px(b.x)}
                    y1={py(b.y)}
                    x2={hp.x}
                    y2={hp.y}
                    stroke={ON_DATA.ink}
                    strokeWidth="1.5"
                  />
                  <circle
                    data-testid={COVERAGE_TEST_IDS.aimHandle}
                    cx={hp.x}
                    cy={hp.y}
                    r="7"
                    fill={ON_DATA.white}
                    stroke={ON_DATA.ink}
                    strokeWidth="2"
                  />
                </>
              )}
              <g transform={`translate(${px(b.x)},${py(b.y)}) rotate(${-b.aim})`}>
                {/* the box behind its spot (its front center), as it stands */}
                <rect
                  x={-bw / 2}
                  y={-bh}
                  width={bw}
                  height={bh}
                  rx="3"
                  fill={ON_DATA.ink}
                  stroke={selected.includes(i) ? ON_DATA.cyan : ON_DATA.white}
                  strokeWidth={selected.includes(i) ? 3 : 1.5}
                />
              </g>
              <text
                x={px(m.x)}
                y={py(m.y) + 4}
                textAnchor="middle"
                fill={ON_DATA.white}
                {...font}
                fontWeight="600"
              >
                {b.label}
              </text>
            </g>
          );
        })}
        {coupling.map((m, i) => (
          <line
            key={`coupling${i}`}
            x1={px(m.from.x)}
            y1={py(m.from.y)}
            x2={px(m.to.x)}
            y2={py(m.to.y)}
            stroke={pal.yellow}
            strokeWidth={COUPLING_BAR_PX}
            pointerEvents="none"
          />
        ))}
        {alignAt && (
          <g transform={`translate(${px(alignAt.x)} ${py(alignAt.y)}) rotate(45)`}>
            <rect x="-8" y="-8" width="16" height="16" fill={ON_DATA.ink} />
            <rect
              x="-6"
              y="-6"
              width="12"
              height="12"
              fill={ON_DATA.magenta}
              stroke={ON_DATA.white}
              strokeWidth="2"
            />
          </g>
        )}
        <circle cx={px(listener.x)} cy={py(listener.y)} r="9" fill={ON_DATA.ink} />
        <circle
          cx={px(listener.x)}
          cy={py(listener.y)}
          r="7"
          fill={ON_DATA.cyan}
          stroke={ON_DATA.white}
          strokeWidth="2"
        />
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-2 tabular-nums">
        <span>{formatSigned(LO_DB, 0)} dB</span>
        <span
          className="relative h-2.5 flex-1 min-w-[120px] max-w-[240px] rounded border border-stone-300"
          style={{ background: COVERAGE_GRADIENT }}
        >
          {COVERAGE_CONTOURS.map(([db, line]) => (
            <span
              key={db}
              className="absolute -top-1 -bottom-1 -translate-x-1/2"
              style={{
                left: `${coverageScalePos(db) * 100}%`,
                width: line.width,
                background: line.color,
                opacity: line.opacity,
              }}
            />
          ))}
        </span>
        <span>
          {formatSigned(HI_DB, 0)} {SCALE_UNIT}
        </span>
        <span>
          Thick line: target
          {view ? ` (${(view.target + view.gain).toFixed(0)} dB)` : ""}. Medium line:{" "}
          {formatSigned(COVERAGE_EDGE_DB, 0)} dB. Thin lines: every {CONTOUR_STEP_DB} dB.
        </span>
      </div>
    </div>
  );
}
