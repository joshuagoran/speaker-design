import type { SidePoint, SpeakerSpec } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import {
  BASKET_SHARE,
  DASH,
  MOTOR_SHARE,
  PAD_PX,
  SMALL_DRIVER_DEPTH_IN,
  THROAT_SHARE,
  VIEW_PX,
  sectionStyles,
} from "./speakerDrawing";
import {
  PORT_RULE,
  driverAcrossIn,
  driverHorn,
  driverSpots,
  driversOnBaffle,
  hornFlare,
  onTop,
  portRule,
  radiatorsAt,
  roundPortsAt,
  slotOpeningsAt,
  speakerLayout,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import {
  hornTopSection,
  sideSlotTopSection,
  type PlanBox,
  type PlanPoint,
} from "../../lib/speaker/hornTopSection";
import { TOUCH_IN, baffleInsetIn } from "../../lib/speaker/chamberAir";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { bracingRegions } from "../../lib/bracing";
import { coneDepthIn } from "../../lib/speaker/driverParts";
import { foldDrawing, foldRowsAcross } from "../../lib/speaker/foldHorn";
import { add, drawnSeg, left, sub, unit } from "../../lib/speaker/foldGeometry";
import { subVentPlan } from "../../lib/pa/subVentPlan";
import { hornDepth } from "../../lib/data";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { FOLD_BASKET_FLARE, FOLD_BASKET_SHARE } from "../../constants/foldHorn";
import { FOLD_WALL, PORT_SHAPE } from "../../constants/speakerSpec";
import { PANEL } from "../../constants/cutParts";

interface Props {
  spec: Pick<SpeakerSpec, "cabinet" | "bands">;
}

/** The gap between two levels of the drawing (chambers stacked one on another), px. */
const LEVEL_GAP_PX = 8;
/** How many points a driver's round body takes in its outline seen from above (a fold's drivers). */
const RING_POINTS = 32;

/** The layout's cabinet, as the drawing reads it. */
type TopCabinet = Pick<SpeakerSpec["cabinet"], "chambers" | "panel" | "construction" | "insetIn">;

/** A box in the drawing by its edges: `x` across the layout, `z` back from the front, in. */
type DrawnBox = PlanBox;

/**
 * Where a chamber's parts reach seen from above, in (`x` across the layout, `z` back from the front): its box, a
 * straight horn drawn past its walls, and a horn on its top.
 */
function chamberReach(cabinet: TopCabinet, placed: PlacedChamber, zero: number): DrawnBox {
  const { dims, cx } = placed;
  const reach = { x0: cx - dims.w / 2, x1: cx + dims.w / 2, z0: 0, z1: dims.d };
  const take = (x: number, z: number) => {
    reach.x0 = Math.min(reach.x0, x);
    reach.x1 = Math.max(reach.x1, x);
    reach.z0 = Math.min(reach.z0, z);
    reach.z1 = Math.max(reach.z1, z);
  };
  const flare = hornFlare(cabinet, placed);
  if (flare) {
    const top = hornTopSection(placed, flare);
    for (const leg of top.legs) for (const p of leg) take(p.x, zero + p.z);
    const boxes = [...top.turns, ...top.drivers.map((d) => d.box)];
    if (top.bay) boxes.push(top.bay);
    if (top.board) boxes.push(top.board);
    for (const b of boxes) {
      take(b.x0, zero + b.z0);
      take(b.x1, zero + b.z1);
    }
  }
  for (const d of placed.chamber.drivers) {
    const horn = driverHorn(d);
    if (!horn || !onTop(d)) continue;
    for (const s of driverSpots(placed, d)) {
      take(s.xIn - horn.size.w / 2, d.position.yIn);
      take(s.xIn + horn.size.w / 2, d.position.yIn + hornDepth(horn));
    }
  }
  return reach;
}

/**
 * What the top drawing spans and its scale, px per inch. Chambers stacked one on another would hide each other seen
 * from above, so they take levels: the highest chamber in the top level, down the drawing; chambers side by side
 * share one. Each level spans its chambers' reach front to back; every level spans the widest reach across.
 */
export function speakerTopFrame(cabinet: TopCabinet) {
  const layout = speakerLayout(cabinet);
  const zero = baffleInsetIn(cabinet) + cabinet.panel.thicknessIn;
  const reach = layout.chambers.map((placed) => chamberReach(cabinet, placed, zero));
  const order = layout.chambers
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = layout.chambers[a],
        pb = layout.chambers[b];
      return pb.y0 + pb.dims.h - (pa.y0 + pa.dims.h);
    });
  /** whether two chambers overlap across: one would hide the other seen from above */
  const across = (a: number, b: number) =>
    Math.min(reach[a].x1, reach[b].x1) - Math.max(reach[a].x0, reach[b].x0) > TOUCH_IN;
  const groups: number[][] = [];
  for (const i of order) {
    const level = groups.find((g) => g.every((j) => !across(i, j)));
    if (level) level.push(i);
    else groups.push([i]);
  }
  const xMin = Math.min(0, ...reach.map((r) => r.x0)),
    xMax = Math.max(0, ...reach.map((r) => r.x1));
  const spans = groups.map((g) => ({
    chambers: g,
    zMin: Math.min(...g.map((i) => reach[i].z0)),
    zMax: Math.max(...g.map((i) => reach[i].z1)),
  }));
  const depth = spans.reduce((sum, s) => sum + s.zMax - s.zMin, 0);
  const room = VIEW_PX - 2 * PAD_PX;
  const gaps = Math.max(0, spans.length - 1) * LEVEL_GAP_PX;
  /** px per inch */
  const k = Math.min(room / Math.max(xMax - xMin, 1), (room - gaps) / Math.max(depth, 1));
  let at = PAD_PX;
  const levels = spans.map((s) => {
    const level = { ...s, topPx: at };
    at += (s.zMax - s.zMin) * k + LEVEL_GAP_PX;
    return level;
  });
  return {
    layout,
    zero,
    k,
    xMin,
    levels,
    W: (xMax - xMin) * k + 2 * PAD_PX,
    H: depth * k + gaps + 2 * PAD_PX,
  };
}

/** The convex hull of points (Andrew's monotone chain), counterclockwise. */
function hull(list: PlanPoint[]): PlanPoint[] {
  const pts = [...list].sort((a, b) => a.x - b.x || a.z - b.z);
  if (pts.length < 3) return pts;
  const turn = (o: PlanPoint, a: PlanPoint, b: PlanPoint) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const chain = (src: PlanPoint[]) => {
    const out: PlanPoint[] = [];
    for (const p of src) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...chain(pts), ...chain([...pts].reverse())];
}

/**
 * The speaker seen from above, each chamber cut at its middle height, the front at the bottom, to scale (the layout
 * the front and side drawings read): its outer walls and the walls between chambers in section, the baffle and its
 * frame's inset, and the drivers seen from above in their band's color (a cone's basket and motor, a horn's flare, a
 * horn on the top dashed: it stands above the cut). A Box chamber's port tubes, slot or letterbox and passive
 * radiators (dashed where the cut misses them), and the braces the cut crosses (light); a straight horn's top section (`hornTopSection`: its legs, turns,
 * bay, board and drivers); a drawn fold's boards where they cross the cut, and its drivers. A folded horn with no
 * drawing shows its box and its drivers behind the baffle. Stacked chambers take levels (`speakerTopFrame`).
 */
export function SpeakerTop({ spec }: Props) {
  const pal = usePalette();
  const { cabinet } = spec;
  const t = cabinet.panel.thicknessIn;
  const inset = baffleInsetIn(cabinet);
  const { layout, zero, k, xMin, levels, W, H } = speakerTopFrame(cabinet);
  if (!layout.chambers.length) return null;
  const build = cabinetBuild(cabinet);
  const { wall, inner, air, vent, brace, gap, inBand } = sectionStyles(pal, spec.bands);

  /** one chamber cut at its middle height, in its level */
  const chamber = (placed: PlacedChamber, i: number, level: (typeof levels)[number]) => {
    /** across, and back from the front, in, to px */
    const px = (x: number) => PAD_PX + (x - xMin) * k,
      py = (z: number) => level.topPx + (level.zMax - z) * k;
    const rect = ({ x0, x1, z0, z1 }: DrawnBox) => ({
      x: px(Math.min(x0, x1)),
      y: py(Math.max(z0, z1)),
      width: Math.abs(x1 - x0) * k,
      height: Math.abs(z1 - z0) * k,
    });
    const points = (list: readonly PlanPoint[]) =>
      list.map((p) => `${px(p.x)},${py(p.z)}`).join(" ");
    /** a box in the horn's terms (back from the baffle's inside face) in the drawing's */
    const fromBaffle = (b: PlanBox): DrawnBox => ({ ...b, z0: zero + b.z0, z1: zero + b.z1 });

    const { chamber: c, dims, clear, cx, y0 } = placed;
    const out: React.JSX.Element[] = [];
    const backZ = dims.d - t;
    const clearX = { x0: clear.x, x1: clear.x + clear.w };
    /** the cut's height up from the clear floor */
    const cutY = y0 + dims.h / 2 - clear.y;
    /** a vent's air from `lo` up to `hi` (from the chamber's bottom): filled where the cut crosses it, else dashed */
    const ventAt = (lo: number, hi: number) =>
      lo <= dims.h / 2 && dims.h / 2 <= hi
        ? vent
        : { fill: "none", stroke: pal.muted, strokeWidth: 0.8, strokeDasharray: DASH };
    // the walls in section, the clear inside, and the frame's inset (open in front)
    out.push(
      <rect
        key={`w${i}`}
        {...rect({ x0: cx - dims.w / 2, x1: cx + dims.w / 2, z0: 0, z1: dims.d })}
        {...wall}
      />,
    );
    out.push(<rect key={`c${i}`} {...rect({ ...clearX, z0: zero, z1: backZ })} {...inner} />);
    if (inset > 0)
      out.push(<rect key={`i${i}`} {...rect({ ...clearX, z0: 0, z1: inset })} {...gap} />);

    // the braces and ribs the cut crosses (light): across from the clear side, back from the baffle's inside face
    const built = build.chambers[i];
    if (built)
      bracingRegions(
        built.bracing,
        { x: built.inside.iw, y: built.inside.ih, z: built.inside.inD },
        t,
      )
        .filter((r) => r.y[0] <= cutY && cutY <= r.y[1])
        .forEach((r, j) =>
          out.push(
            <rect
              key={`b${i}.${j}`}
              {...rect({
                x0: clear.x + r.x[0],
                x1: clear.x + r.x[1],
                z0: zero + r.z[0],
                z1: zero + r.z[1],
              })}
              {...brace}
            />,
          ),
        );

    // the port: a Hi-fi round port's tubes or slot's channel, a PA letterbox's channel or its tubes
    const rule = portRule(c);
    const hifiPort = rule?.rule === PORT_RULE.hifi ? rule.port : null;
    if (hifiPort?.shape === PORT_SHAPE.slot) {
      const side = sideSlotTopSection(placed, hifiPort, t, backZ - zero);
      side.channels.forEach((b, j) =>
        out.push(<rect key={`v${i}.${j}`} {...rect(fromBaffle(b))} {...vent} />),
      );
      side.folds.forEach((b, j) =>
        out.push(<rect key={`vf${i}.${j}`} {...rect(fromBaffle(b))} {...vent} />),
      );
      side.plates.forEach((b, j) =>
        out.push(<rect key={`vp${i}.${j}`} {...rect(fromBaffle(b))} {...wall} />),
      );
      // a slot along the floor: its channel, seen from above
      const len = Math.min(hifiPort.len, backZ - zero);
      slotOpeningsAt(placed, hifiPort, t)
        .filter((o) => !o.side)
        .forEach((o, j) =>
          out.push(
            <rect
              key={`vs${i}.${j}`}
              {...rect({
                x0: cx + o.x - o.w / 2,
                x1: cx + o.x + o.w / 2,
                z0: inset,
                z1: zero + len,
              })}
              {...ventAt(o.y, o.y + o.h)}
            />,
          ),
        );
    } else if (hifiPort) {
      const { panel, spots } = roundPortsAt(placed, hifiPort);
      const len = Math.min(hifiPort.len, dims.d);
      spots.forEach((s, j) => {
        const r = s.r + HIFI_BOX_LAYOUT.portTubeWallIn;
        const [z0, z1] = panel === PANEL.back ? [dims.d - len, dims.d] : [inset, inset + len];
        out.push(
          <rect
            key={`v${i}.${j}`}
            {...rect({ x0: cx + s.x - r, x1: cx + s.x + r, z0, z1 })}
            {...ventAt(s.y - r, s.y + r)}
          />,
        );
      });
    } else if (rule?.rule === PORT_RULE.pa) {
      const plan = subVentPlan(rule.sub, dims, rule.portStyle, rule.portGeom, t);
      const len = Math.min(plan.tubeVent.len, backZ - inset);
      if (plan.bandH > 0)
        out.push(
          <rect
            key={`v${i}`}
            {...rect({
              x0: cx - plan.innerW / 2,
              x1: cx + plan.innerW / 2,
              z0: inset,
              z1: inset + len,
            })}
            {...ventAt(t, t + plan.ductH)}
          />,
        );
      plan.tubes?.tubes.forEach((p, j) =>
        out.push(
          <rect
            key={`v${i}.${j}`}
            {...rect({
              x0: cx + p.x - plan.portR,
              x1: cx + p.x + plan.portR,
              z0: inset,
              z1: inset + len,
            })}
            {...ventAt(t + p.y - plan.portR, t + p.y + plan.portR)}
          />,
        ),
      );
    }

    // the passive radiators: through their panel, a small driver's depth inside it
    radiatorsAt(cabinet, placed).spots.forEach((s, j) => {
      const deep = t + SMALL_DRIVER_DEPTH_IN;
      const key = `p${i}.${j}`;
      const style = ventAt(s.y - s.shape.h / 2, s.y + s.shape.h / 2);
      if (s.panel === PANEL.side) {
        const mid = (zero + dims.d) / 2;
        const wallX = s.side === 1 ? cx + dims.w / 2 : cx - dims.w / 2;
        const into = s.side === 1 ? -deep : deep;
        out.push(
          <rect
            key={key}
            {...rect({
              x0: wallX,
              x1: wallX + into,
              z0: mid - s.shape.w / 2,
              z1: mid + s.shape.w / 2,
            })}
            {...style}
          />,
        );
        return;
      }
      const [z0, z1] = s.panel === PANEL.back ? [dims.d - deep, dims.d] : [inset, inset + deep];
      out.push(
        <rect
          key={key}
          {...rect({ x0: cx + s.x - s.shape.w / 2, x1: cx + s.x + s.shape.w / 2, z0, z1 })}
          {...style}
        />,
      );
    });

    // a straight horn: the mouth in the baffle, its legs and turns, the bay (dashed), the board, the drivers
    const flare = hornFlare(cabinet, placed);
    if (flare) {
      const { mouth } = flare;
      const top = hornTopSection(placed, flare);
      out.push(
        <rect
          key={`m${i}`}
          {...rect({ x0: mouth.x, x1: mouth.x + mouth.w, z0: 0, z1: zero })}
          {...gap}
        />,
      );
      top.legs.forEach((leg, j) =>
        out.push(
          <polygon
            key={`l${i}.${j}`}
            points={points(leg.map((p) => ({ x: p.x, z: zero + p.z })))}
            {...air}
          />,
        ),
      );
      top.turns.forEach((b, j) =>
        out.push(<rect key={`u${i}.${j}`} {...rect(fromBaffle(b))} {...air} />),
      );
      if (top.bay)
        out.push(
          <rect
            key={`bay${i}`}
            {...rect(fromBaffle(top.bay))}
            fill="none"
            stroke={pal.muted}
            strokeWidth={0.8}
            strokeDasharray={DASH}
          />,
        );
      if (top.board) out.push(<rect key={`bd${i}`} {...rect(fromBaffle(top.board))} {...wall} />);
      top.drivers.forEach(({ driver, box }, j) =>
        out.push(
          <rect key={`hd${i}.${j}`} {...rect(fromBaffle(box))} {...inBand(driver.bands[0])} />,
        ),
      );
    }

    // a drawn fold: its boards where they cross the cut, its mouth and vent where the cut crosses them, its drivers
    const drawing = foldDrawing(cabinet, c);
    if (drawing) {
      const { fold, room } = drawing;
      for (const opening of [fold.mouth, fold.vent]) {
        if (!opening) continue;
        const from = Math.min(opening.fromIn, opening.toIn),
          to = Math.max(opening.fromIn, opening.toIn);
        if (cutY < from || cutY > to) continue;
        const key = `o${i}.${opening === fold.mouth ? "m" : "v"}`;
        if (opening.wall === FOLD_WALL.baffle)
          out.push(<rect key={key} {...rect({ ...clearX, z0: 0, z1: zero })} {...gap} />);
        else if (opening.wall === FOLD_WALL.back)
          out.push(<rect key={key} {...rect({ ...clearX, z0: backZ, z1: dims.d })} {...gap} />);
      }
      fold.boards.forEach((_, j) => {
        const seg = drawnSeg(fold.boards, j, t);
        const n = left(unit(sub(seg.b, seg.a)));
        const quad = [
          add(seg.a, n, t / 2),
          add(seg.b, n, t / 2),
          add(seg.b, n, -t / 2),
          add(seg.a, n, -t / 2),
        ];
        // where the board's section crosses the cut's height: its depth there, front to back
        const zs: number[] = [];
        quad.forEach((p, m) => {
          const q = quad[(m + 1) % quad.length];
          if (Math.abs(p.yIn - cutY) < TOUCH_IN) zs.push(p.zIn);
          if ((p.yIn - cutY) * (q.yIn - cutY) < 0)
            zs.push(p.zIn + ((cutY - p.yIn) / (q.yIn - p.yIn)) * (q.zIn - p.zIn));
        });
        if (zs.length < 2) return;
        out.push(
          <rect
            key={`fb${i}.${j}`}
            {...rect({ ...clearX, z0: zero + Math.min(...zs), z1: zero + Math.max(...zs) })}
            {...wall}
          />,
        );
      });
      // the drivers seen from above: each body's basket and motor, round its axis in the side section
      const shape = room.driver;
      const color = inBand(c.drivers.find((d) => coneDepthIn(d) !== null)?.bands[0]);
      const midX = clear.x + clear.w / 2;
      /**
       * a round slice of a body at `x` across, `along` its `axis` from `from` (the board's back face), `r` round, seen
       * from above: as wide as round across, foreshortened front to back as the axis tilts toward level
       */
      const ring = (from: SidePoint, axis: SidePoint, x: number, along: number, r: number) => {
        const c0 = add(from, axis, along);
        return Array.from({ length: RING_POINTS }, (_, m) => {
          const a = (2 * Math.PI * m) / RING_POINTS;
          return {
            x: x + r * Math.cos(a),
            z: zero + c0.zIn + r * Math.abs(axis.yIn) * Math.sin(a),
          };
        });
      };
      if (shape)
        foldRowsAcross(drawing, clear.w).forEach(({ part, xs }, row) =>
          xs.forEach((dx, m) => {
            const x = midX + dx;
            const basketEnd = shape.depthIn * FOLD_BASKET_SHARE;
            const motorR = shape.motorIn / 2;
            const basket = hull([
              ...ring(part.backFace, part.back, x, 0, shape.cutoutIn / 2),
              ...ring(part.backFace, part.back, x, basketEnd, motorR * FOLD_BASKET_FLARE),
            ]);
            const motor = hull([
              ...ring(part.backFace, part.back, x, basketEnd, motorR),
              ...ring(part.backFace, part.back, x, shape.depthIn, motorR),
            ]);
            out.push(
              <g key={`fd${i}.${row}.${m}`}>
                <polygon points={points(basket)} {...color} />
                <polygon points={points(motor)} {...color} />
              </g>,
            );
          }),
        );
    }

    // the drivers behind the baffle, seen from above (each place across once: a column's drivers stand over each
    // other here); a folded horn with no drawing shows its drivers here too
    if (!drawing && (!flare || driversOnBaffle(c)))
      c.drivers.forEach((d, j) => {
        if (onTop(d)) return;
        const r = driverAcrossIn(d) / 2;
        if (r <= 0) return;
        const color = inBand(d.bands[0]);
        const horn = driverHorn(d);
        const cone = coneDepthIn(d);
        const across = [...new Set(driverSpots(placed, d).map((s) => s.xIn))];
        across.forEach((x, n) => {
          const key = `d${i}.${j}.${n}`;
          if (cone !== null) {
            out.push(
              <polygon
                key={key}
                points={points([
                  { x: x - r, z: inset },
                  { x: x - r * MOTOR_SHARE, z: inset + cone * BASKET_SHARE },
                  { x: x - r * MOTOR_SHARE, z: inset + cone },
                  { x: x + r * MOTOR_SHARE, z: inset + cone },
                  { x: x + r * MOTOR_SHARE, z: inset + cone * BASKET_SHARE },
                  { x: x + r, z: inset },
                ])}
                {...color}
              />,
            );
            return;
          }
          if (horn) {
            // a horn set into the baffle: its flare from the mouth back to the throat
            const hd = hornDepth(horn);
            const half = horn.size.w / 2;
            out.push(
              <polygon
                key={key}
                points={points([
                  { x: x - half, z: inset },
                  { x: x - half * THROAT_SHARE, z: inset + hd },
                  { x: x + half * THROAT_SHARE, z: inset + hd },
                  { x: x + half, z: inset },
                ])}
                {...color}
              />,
            );
            return;
          }
          out.push(
            <rect
              key={key}
              {...rect({ x0: x - r, x1: x + r, z0: inset, z1: inset + SMALL_DRIVER_DEPTH_IN })}
              {...color}
            />,
          );
        });
      });

    // a horn on the top: above the cut (dashed), its mouth `yIn` back from the front
    c.drivers.forEach((d, j) => {
      const horn = driverHorn(d);
      if (!horn || !onTop(d)) return;
      const z0 = d.position.yIn,
        z1 = z0 + hornDepth(horn);
      const half = horn.size.w / 2;
      driverSpots(placed, d).forEach((s, n) =>
        out.push(
          <polygon
            key={`th${i}.${j}.${n}`}
            points={points([
              { x: s.xIn - half, z: z0 },
              { x: s.xIn - half * THROAT_SHARE, z: z1 },
              { x: s.xIn + half * THROAT_SHARE, z: z1 },
              { x: s.xIn + half, z: z0 },
            ])}
            {...inBand(d.bands[0])}
            strokeDasharray={DASH}
          />,
        ),
      );
    });
    return out;
  };

  const n = layout.chambers.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      role="img"
      aria-label={`Top view, each chamber cut through the middle, ${+layout.size.w.toFixed(2)} × ${+layout.size.d.toFixed(2)}″, ${n} chamber${n === 1 ? "" : "s"}`}
    >
      {levels.flatMap((level) =>
        level.chambers.flatMap((i) => {
          const placed = layout.chambers[i];
          return placed ? chamber(placed, i, level) : [];
        }),
      )}
    </svg>
  );
}
