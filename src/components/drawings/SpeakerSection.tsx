import type { SpeakerSpec } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { alpha } from "../../styles/palette";
import {
  PORT_RULE,
  driverAcrossIn,
  driverSpots,
  hornFlare,
  portRule,
  slotOpeningsAt,
  speakerLayout,
} from "../../lib/speaker/speakerLayout";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { PORT_SHAPE } from "../../constants/speakerSpec";

interface Props {
  spec: Pick<SpeakerSpec, "cabinet">;
}

/** The drawing's scale, px per inch, and its margin and the gap between two panels, px. */
const SCALE_PX = 6;
const PAD_PX = 4;
const GAP_PX = 14;

/**
 * Sections of every horn-loaded chamber of a speaker, to scale: one from the top and one from the side, each cut through
 * the horn's center, the baffle at the left, from the horn geometry the 3D view and the front view read too
 * (lib/speaker/hornGeometry, by `hornFlare`). Each shows the walls and the baffle in section, the horn's legs along the
 * depth (the top section shows the flare of the side walls, the side section the height) with the turns of a folded
 * path, the driver board behind the bay, the drivers behind the throat (their front chamber dashed, between the walls' back edges and the cones, the
 * walls narrower than the cones where the horn loads them), and a slot's channel (up a front side in the top section,
 * along the floor in the side). Null when no chamber has a horn.
 */
export function SpeakerSection({ spec }: Props) {
  const pal = usePalette();
  const { cabinet } = spec;
  const t = cabinet.panel.thicknessIn;
  const inset = baffleInsetIn(cabinet);
  const layout = speakerLayout(cabinet);
  const horns = layout.chambers.flatMap((placed) => {
    const flare = hornFlare(cabinet, placed);
    return flare ? [{ placed, flare }] : [];
  });
  if (!horns.length) return null;
  /** the baffle's inside face is where the path's z starts, behind the frame's inset and the baffle */
  const zero = inset + t;
  /**
   * What each chamber's two sections span, in: its box and the horn, which is drawn as it is where it does not fit
   * (past the walls), so the drawing takes the room it needs.
   */
  const spans = horns.map(({ placed, flare: { path } }) => {
    const { dims, y0, cx } = placed;
    const parts = [
      ...path.legs.flatMap((l) => l.sections),
      ...path.turns.map((u) => ({
        z: u.z1,
        cx: u.cx,
        w: u.w,
        cy: (u.y0 + u.y1) / 2,
        h: u.y1 - u.y0,
      })),
      ...(path.bay
        ? [
            {
              z: Math.max(path.bay.z1, path.bay.bodyZ),
              cx: path.bay.x + path.bay.w / 2,
              w: path.bay.w,
              cy: path.bay.y + path.bay.h / 2,
              h: path.bay.h,
            },
          ]
        : []),
    ];
    const x0 = cx - dims.w / 2;
    return {
      depth: Math.max(dims.d, zero + Math.max(...parts.map((q) => q.z))),
      xMin: Math.min(x0, ...parts.map((q) => q.cx - q.w / 2)),
      xMax: Math.max(x0 + dims.w, ...parts.map((q) => q.cx + q.w / 2)),
      yMin: Math.min(y0, ...parts.map((q) => q.cy - q.h / 2)),
      yMax: Math.max(y0 + dims.h, ...parts.map((q) => q.cy + q.h / 2)),
    };
  });
  const panelW = Math.max(...spans.map((q) => q.depth)) * SCALE_PX;
  const rowH = spans.map((q) => Math.max(q.xMax - q.xMin, q.yMax - q.yMin) * SCALE_PX);
  const W = 2 * panelW + GAP_PX + 2 * PAD_PX;
  const H = rowH.reduce((a, b) => a + b, 0) + (horns.length - 1) * GAP_PX + 2 * PAD_PX;
  const air = { fill: alpha(pal.cyan, 0.28), stroke: pal.cyan, strokeWidth: 1 };
  const vent = { fill: alpha(pal.magenta, 0.25), stroke: pal.magenta, strokeWidth: 1 };
  const wall = { fill: pal.edge, stroke: pal.ink, strokeWidth: 1.2 };
  const inner = { fill: pal.panel, stroke: pal.muted, strokeWidth: 0.8 };

  const panels = horns.map(({ placed, flare }, n) => {
    const { dims, y0, cx } = placed;
    const { path } = flare;
    const top = PAD_PX + rowH.slice(0, n).reduce((a, b) => a + b + GAP_PX, 0);
    const span = spans[n];
    const ux = (z: number, side: 0 | 1) =>
      PAD_PX + side * (panelW + GAP_PX) + (zero + z) * SCALE_PX;
    /** the top section: across from the box's left side, down the drawing; the side section: up from its bottom */
    const vTop = (x: number) => top + (x - span.xMin) * SCALE_PX;
    const vSide = (y: number) => top + (span.yMax - y) * SCALE_PX;
    const box = (
      side: 0 | 1,
      v: (q: number) => number,
      z0: number,
      z1: number,
      q0: number,
      q1: number,
    ) => ({
      x: Math.min(ux(z0, side), ux(z1, side)),
      y: Math.min(v(q0), v(q1)),
      width: Math.abs(ux(z1, side) - ux(z0, side)),
      height: Math.abs(v(q1) - v(q0)),
    });
    const x0 = cx - dims.w / 2;
    const rule = portRule(placed.chamber);
    const slot =
      rule?.rule === PORT_RULE.hifi && rule.port.shape === PORT_SHAPE.slot ? rule.port : null;
    const openings = slot ? slotOpeningsAt(placed, slot, t) : [];
    const run = slot ? Math.min(slot.len, dims.d - 2 * t - inset) : 0;
    const rest = slot ? slot.len - run : 0;
    const clearDepth = dims.d - inset - 2 * t;
    /** the way the driver board runs from the bay's end: back from the baffle on an even path, toward it on an odd one */
    const way = path.folds % 2 === 0 ? 1 : -1;
    return (
      <g key={n}>
        {/* the top section */}
        <rect {...box(0, vTop, -zero, dims.d - zero, x0, x0 + dims.w)} {...wall} />
        <rect {...box(0, vTop, 0, clearDepth, x0 + t, x0 + dims.w - t)} {...inner} />
        {openings.flatMap((o, k) =>
          o.side
            ? [
                // the slot's channel along its side wall, its plate inside it, and the fold along the back for the rest
                <rect
                  key={`s${k}`}
                  {...box(0, vTop, 0, run, cx + o.x - o.w / 2, cx + o.x + o.w / 2)}
                  {...vent}
                />,
                <rect
                  key={`p${k}`}
                  {...box(
                    0,
                    vTop,
                    0,
                    run,
                    cx + o.x - o.side * (o.w / 2),
                    cx + o.x - o.side * (o.w / 2 + t),
                  )}
                  fill={pal.ink}
                />,
                ...(rest > 1e-9
                  ? [
                      <rect
                        key={`f${k}`}
                        {...box(
                          0,
                          vTop,
                          clearDepth - o.w,
                          clearDepth,
                          o.side < 0 ? cx + o.x - o.w / 2 : cx + o.x + o.w / 2 - rest,
                          o.side < 0 ? cx + o.x - o.w / 2 + rest : cx + o.x + o.w / 2,
                        )}
                        {...vent}
                      />,
                    ]
                  : []),
              ]
            : [],
        )}
        {path.legs.map((leg, k) => (
          <polygon
            key={`tl${k}`}
            points={[
              ...leg.sections.map((s) => `${ux(s.z, 0)},${vTop(s.cx - s.w / 2)}`),
              ...[...leg.sections].reverse().map((s) => `${ux(s.z, 0)},${vTop(s.cx + s.w / 2)}`),
            ].join(" ")}
            {...air}
          />
        ))}
        {path.turns.map((turn, k) => (
          <rect
            key={`tt${k}`}
            {...box(0, vTop, turn.z0, turn.z1, turn.cx - turn.w / 2, turn.cx + turn.w / 2)}
            {...air}
          />
        ))}
        {path.bay && (
          <rect
            {...box(0, vTop, path.bay.z0, path.bay.z1, path.bay.x, path.bay.x + path.bay.w)}
            fill="none"
            stroke={pal.muted}
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        )}
        {path.bay && (
          <rect
            {...box(
              0,
              vTop,
              path.bay.boardZ,
              path.bay.boardZ + path.bay.boardIn * way,
              path.bay.x,
              path.bay.x + path.bay.w,
            )}
            {...wall}
          />
        )}
        {path.bay &&
          placed.chamber.drivers
            .filter((d) => placed.spots.has(d))
            .flatMap((d, j) =>
              driverSpots(placed, d).map((spot, i) => {
                const r = driverAcrossIn(d) / 2;
                if (r <= 0 || !path.bay) return null;
                const x = spot.xIn;
                return (
                  <rect
                    key={`td${j}.${i}`}
                    {...box(0, vTop, path.bay.boardZ, path.bay.bodyZ, x - r, x + r)}
                    fill={pal.muted}
                  />
                );
              }),
            )}
        {/* the side section */}
        <rect {...box(1, vSide, -zero, dims.d - zero, y0, y0 + dims.h)} {...wall} />
        <rect {...box(1, vSide, 0, clearDepth, y0 + t, y0 + dims.h - t)} {...inner} />
        {slot &&
          !openings.some((o) => o.side) &&
          openings.map((o, k) => (
            <rect
              key={`fs${k}`}
              {...box(1, vSide, 0, Math.min(slot.len, clearDepth), y0 + o.y, y0 + o.y + o.h)}
              {...vent}
            />
          ))}
        {path.legs.map((leg, k) => (
          <polygon
            key={`sl${k}`}
            points={[
              ...leg.sections.map((s) => `${ux(s.z, 1)},${vSide(s.cy + s.h / 2)}`),
              ...[...leg.sections].reverse().map((s) => `${ux(s.z, 1)},${vSide(s.cy - s.h / 2)}`),
            ].join(" ")}
            {...air}
          />
        ))}
        {path.turns.map((turn, k) => (
          <rect key={`st${k}`} {...box(1, vSide, turn.z0, turn.z1, turn.y0, turn.y1)} {...air} />
        ))}
        {path.bay && (
          <rect
            {...box(1, vSide, path.bay.z0, path.bay.z1, path.bay.y, path.bay.y + path.bay.h)}
            fill="none"
            stroke={pal.muted}
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        )}
        {path.bay && (
          <rect
            {...box(
              1,
              vSide,
              path.bay.boardZ,
              path.bay.boardZ + path.bay.boardIn * way,
              path.bay.y,
              path.bay.y + path.bay.h,
            )}
            {...wall}
          />
        )}
        {path.bay &&
          placed.chamber.drivers
            .filter((d) => placed.spots.has(d))
            .flatMap((d, j) =>
              driverSpots(placed, d).map((spot, i) => {
                const r = driverAcrossIn(d) / 2;
                if (r <= 0 || !path.bay) return null;
                const y = spot.yIn;
                return (
                  <rect
                    key={`sd${j}.${i}`}
                    {...box(1, vSide, path.bay.boardZ, path.bay.bodyZ, y - r, y + r)}
                    fill={pal.muted}
                  />
                );
              }),
            )}
      </g>
    );
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      role="img"
      aria-label={`Top and side sections of ${horns.length} horn chamber${horns.length === 1 ? "" : "s"}`}
    >
      {panels}
    </svg>
  );
}
