import { useUnits } from "../../hooks/useUnits";
import type { PositionFocus, SidePoint, SpeakerSpec } from "../../types";
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
  roundPortsAt,
  slotOpeningsAt,
  speakerLayout,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { baffleInsetIn } from "../../lib/speaker/chamberAir";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { bracingRegions } from "../../lib/build/bracing";
import { coneDepthIn } from "../../lib/speaker/driverParts";
import { foldDrawing } from "../../lib/speaker/foldHorn";
import { add, drawnSeg, left, sub, unit } from "../../lib/speaker/foldGeometry";
import { subVentPlan } from "../../lib/build/ventPlan";
import { hornDepth } from "../../lib/data";
import { HORN_LIFT_IN } from "../../constants/paLayouts";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { FOLD_WALL, PORT_SHAPE } from "../../constants/speakerSpec";
import { POSITION_AXIS } from "../../constants/speakerResults";
import { PANEL } from "../../constants/cutParts";

interface Props {
  spec: Pick<SpeakerSpec, "cabinet" | "bands">;
  /** the driver position field with focus: a horn on the top's depth is marked from the front edge; null: none */
  focus?: PositionFocus | null;
}

/** The marked point's dot radius, px. */
const MARK_DOT_PX = 3;

/**
 * What the side drawing spans, in: front to back (the deepest chamber, a horn on the top, a straight horn past its
 * walls) and floor to top (the chambers and the horns on their tops), and its scale, px per inch. The fronts line up
 * at depth 0, as the 3D view builds them.
 */
export function speakerSideFrame(
  cabinet: Pick<SpeakerSpec["cabinet"], "chambers" | "panel" | "construction" | "insetIn">,
) {
  const layout = speakerLayout(cabinet);
  const zero = baffleInsetIn(cabinet) + cabinet.panel.thicknessIn;
  let depth = layout.size.d,
    maxY = layout.size.h;
  for (const placed of layout.chambers) {
    for (const d of placed.chamber.drivers) {
      const horn = driverHorn(d);
      if (!horn || !onTop(d)) continue;
      depth = Math.max(depth, d.position.yIn + hornDepth(horn));
      maxY = Math.max(maxY, placed.y0 + placed.dims.h + HORN_LIFT_IN + horn.size.h);
    }
    const flare = hornFlare(cabinet, placed);
    if (flare)
      for (const leg of flare.path.legs)
        for (const s of leg.sections) {
          depth = Math.max(depth, zero + s.z);
          maxY = Math.max(maxY, s.cy + s.h / 2);
        }
  }
  /** px per inch */
  const k = (VIEW_PX - 2 * PAD_PX) / Math.max(depth, maxY, 1);
  return { layout, depth, maxY, zero, k };
}

/**
 * The speaker cut through its center, seen from the right, the front at the left, to scale (the layout the front
 * drawing and the 3D view read): each chamber's walls, baffle and back in section, its frame's inset, and inside it a
 * Box chamber's drivers (each cone's basket and motor, in its band's color), its port or slot, and its braces and ribs
 * (seen through, light); a horn chamber's straight flare (each leg, the turns, the drivers' bay and board) or its drawn
 * fold's boards, with its drivers on them; a horn on the top standing on the lid. The mouth and a vent opening in a
 * wall show as gaps in it.
 */
export function SpeakerSide({ spec, focus = null }: Props) {
  const units = useUnits();
  const pal = usePalette();
  const { cabinet } = spec;
  const t = cabinet.panel.thicknessIn;
  const inset = baffleInsetIn(cabinet);
  const { layout, depth, maxY, zero, k } = speakerSideFrame(cabinet);
  if (!layout.chambers.length) return null;
  const build = cabinetBuild(cabinet);
  const W = depth * k + 2 * PAD_PX,
    H = maxY * k + 2 * PAD_PX;
  /** depth back from the front, and height up from the floor, in, to px */
  const px = (z: number) => PAD_PX + z * k,
    py = (y: number) => PAD_PX + (maxY - y) * k;
  const rect = (z0: number, z1: number, y0: number, y1: number) => ({
    x: px(Math.min(z0, z1)),
    y: py(Math.max(y0, y1)),
    width: Math.abs(z1 - z0) * k,
    height: Math.abs(y1 - y0) * k,
  });
  const points = (list: readonly { z: number; y: number }[]) =>
    list.map((p) => `${px(p.z)},${py(p.y)}`).join(" ");
  const { wall, inner, air, vent, brace, gap, inBand } = sectionStyles(pal, spec.bands);

  /** a cone driver's basket and motor in section: from the baffle's front face back, its cutout `r` round `y` */
  const conePolygon = (y: number, r: number, depthIn: number) => {
    const front = inset;
    return points([
      { z: front, y: y + r },
      { z: front + depthIn * BASKET_SHARE, y: y + r * MOTOR_SHARE },
      { z: front + depthIn, y: y + r * MOTOR_SHARE },
      { z: front + depthIn, y: y - r * MOTOR_SHARE },
      { z: front + depthIn * BASKET_SHARE, y: y - r * MOTOR_SHARE },
      { z: front, y: y - r },
    ]);
  };

  /** one chamber in section, at its height (its front at depth 0) */
  const chamber = (placed: PlacedChamber, i: number) => {
    const { chamber: c, dims, y0, clear } = placed;
    const out: React.JSX.Element[] = [];
    const clearTop = clear.y + clear.h;
    const backZ = dims.d - t;
    // the walls, the baffle and the back in section, the clear inside, and the frame's inset (open in front)
    out.push(<rect key={`w${i}`} {...rect(0, dims.d, y0, y0 + dims.h)} {...wall} />);
    out.push(<rect key={`c${i}`} {...rect(zero, backZ, clear.y, clearTop)} {...inner} />);
    if (inset > 0) out.push(<rect key={`i${i}`} {...rect(0, inset, clear.y, clearTop)} {...gap} />);

    // the braces and ribs, seen through (light): the back from the baffle's inside face, up from the clear floor
    const built = build.chambers[i];
    if (built)
      bracingRegions(
        built.bracing,
        { x: built.inside.iw, y: built.inside.ih, z: built.inside.inD },
        t,
      ).forEach((r, j) =>
        out.push(
          <rect
            key={`b${i}.${j}`}
            {...rect(zero + r.z[0], zero + r.z[1], clear.y + r.y[0], clear.y + r.y[1])}
            {...brace}
          />,
        ),
      );

    // the port: a Hi-fi round port's tubes or slot's channel, a PA letterbox's channel or its tubes
    const rule = portRule(c);
    const hifiPort = rule?.rule === PORT_RULE.hifi ? rule.port : null;
    if (hifiPort?.shape === PORT_SHAPE.slot) {
      const len = Math.min(hifiPort.len, backZ - zero);
      slotOpeningsAt(placed, hifiPort, t).forEach((o, j) =>
        out.push(
          <rect
            key={`v${i}.${j}`}
            {...rect(inset, zero + len, y0 + o.y, y0 + o.y + o.h)}
            {...vent}
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
          <rect key={`v${i}.${j}`} {...rect(z0, z1, y0 + s.y - r, y0 + s.y + r)} {...vent} />,
        );
      });
    } else if (rule?.rule === PORT_RULE.pa) {
      const plan = subVentPlan(rule.sub, dims, rule.portStyle, rule.portGeom, t);
      const len = Math.min(plan.tubeVent.len, backZ - inset);
      if (plan.bandH > 0)
        out.push(
          <rect
            key={`v${i}`}
            {...rect(inset, inset + len, y0 + t, y0 + t + plan.ductH)}
            {...vent}
          />,
        );
      plan.tubes?.tubes.forEach((p, j) =>
        out.push(
          <rect
            key={`v${i}.${j}`}
            {...rect(inset, inset + len, y0 + t + p.y - plan.portR, y0 + t + p.y + plan.portR)}
            {...vent}
          />,
        ),
      );
    }

    // a straight horn: its legs and turns, the drivers' bay and board, and the drivers behind the throat
    const flare = hornFlare(cabinet, placed);
    if (flare) {
      const { path, mouth } = flare;
      out.push(<rect key={`m${i}`} {...rect(0, zero, mouth.y, mouth.y + mouth.h)} {...gap} />);
      path.legs.forEach((leg, j) =>
        out.push(
          <polygon
            key={`l${i}.${j}`}
            points={points([
              ...leg.sections.map((s) => ({ z: zero + s.z, y: s.cy + s.h / 2 })),
              ...[...leg.sections].reverse().map((s) => ({ z: zero + s.z, y: s.cy - s.h / 2 })),
            ])}
            {...air}
          />,
        ),
      );
      path.turns.forEach((u, j) =>
        out.push(
          <rect key={`u${i}.${j}`} {...rect(zero + u.z0, zero + u.z1, u.y0, u.y1)} {...air} />,
        ),
      );
      const { bay } = path;
      if (bay) {
        const way = path.folds % 2 === 0 ? 1 : -1;
        out.push(
          <rect
            key={`bd${i}`}
            {...rect(
              zero + bay.boardZ,
              zero + bay.boardZ + bay.boardIn * way,
              bay.y,
              bay.y + bay.h,
            )}
            {...wall}
          />,
        );
        c.drivers.forEach((d, j) =>
          driverSpots(placed, d).forEach((spot, n) => {
            const r = driverAcrossIn(d) / 2;
            if (r <= 0) return;
            out.push(
              <rect
                key={`hd${i}.${j}.${n}`}
                {...rect(zero + bay.boardZ, zero + bay.bodyZ, spot.yIn - r, spot.yIn + r)}
                {...inBand(d.bands[0])}
              />,
            );
          }),
        );
      }
    }

    // a drawn fold: its boards, its mouth and vent as gaps in their walls, and the drivers on their board
    const drawing = foldDrawing(cabinet, c);
    if (drawing) {
      const { fold, parts } = drawing;
      /** a side-section point (back from the baffle's inside face, up from the clear floor) in the drawing's terms */
      const at = (q: SidePoint) => ({ z: zero + q.zIn, y: clear.y + q.yIn });
      for (const opening of [fold.mouth, fold.vent]) {
        if (!opening) continue;
        const from = Math.min(opening.fromIn, opening.toIn),
          to = Math.max(opening.fromIn, opening.toIn);
        const key = `o${i}.${opening === fold.mouth ? "m" : "v"}`;
        if (opening.wall === FOLD_WALL.baffle)
          out.push(<rect key={key} {...rect(0, zero, clear.y + from, clear.y + to)} {...gap} />);
        else if (opening.wall === FOLD_WALL.back)
          out.push(
            <rect key={key} {...rect(backZ, dims.d, clear.y + from, clear.y + to)} {...gap} />,
          );
        else if (opening.wall === FOLD_WALL.top)
          out.push(
            <rect key={key} {...rect(zero + from, zero + to, clearTop, y0 + dims.h)} {...gap} />,
          );
        else out.push(<rect key={key} {...rect(zero + from, zero + to, y0, clear.y)} {...gap} />);
      }
      fold.boards.forEach((_, j) => {
        const seg = drawnSeg(fold.boards, j, t);
        const n = left(unit(sub(seg.b, seg.a)));
        out.push(
          <polygon
            key={`fb${i}.${j}`}
            points={points(
              [
                add(seg.a, n, t / 2),
                add(seg.b, n, t / 2),
                add(seg.b, n, -t / 2),
                add(seg.a, n, -t / 2),
              ].map(at),
            )}
            {...wall}
          />,
        );
      });
      const color = inBand(c.drivers.find((d) => coneDepthIn(d) !== null)?.bands[0]);
      parts.forEach((part, j) =>
        out.push(
          <g key={`fd${i}.${j}`}>
            <polygon points={points(part.body.map(at))} {...color} />
            <line
              x1={px(at(part.coneLine.from).z)}
              y1={py(at(part.coneLine.from).y)}
              x2={px(at(part.coneLine.to).z)}
              y2={py(at(part.coneLine.to).y)}
              stroke={color.stroke}
              strokeWidth={1.5}
            />
          </g>,
        ),
      );
    }

    // the drivers on the baffle (each height once: a row's drivers stand behind each other here)
    if (!drawing && driversOnBaffle(c))
      c.drivers.forEach((d, j) => {
        if (onTop(d)) return;
        const r = driverAcrossIn(d) / 2;
        if (r <= 0) return;
        const color = inBand(d.bands[0]);
        const horn = driverHorn(d);
        const heights = [...new Set(driverSpots(placed, d).map((s) => s.yIn))];
        heights.forEach((y, n) => {
          const key = `d${i}.${j}.${n}`;
          const cone = coneDepthIn(d);
          if (cone !== null) {
            out.push(<polygon key={key} points={conePolygon(y, r, cone)} {...color} />);
            return;
          }
          if (horn) {
            // a horn set into the baffle: its flare from the mouth back to the throat, its driver behind
            const hd = hornDepth(horn);
            const mouthH = horn.size.h / 2;
            out.push(
              <polygon
                key={key}
                points={points([
                  { z: inset, y: y + mouthH },
                  { z: inset + hd, y: y + mouthH * THROAT_SHARE },
                  { z: inset + hd, y: y - mouthH * THROAT_SHARE },
                  { z: inset, y: y - mouthH },
                ])}
                {...color}
              />,
            );
            return;
          }
          out.push(
            <rect
              key={key}
              {...rect(inset, inset + SMALL_DRIVER_DEPTH_IN, y - r, y + r)}
              {...color}
            />,
          );
        });
      });

    // a horn on the top: standing on the lid, its mouth `yIn` back from the front
    c.drivers.forEach((d, j) => {
      const horn = driverHorn(d);
      if (!horn || !onTop(d)) return;
      const base = y0 + dims.h + HORN_LIFT_IN;
      const z0 = d.position.yIn;
      out.push(
        <polygon
          key={`th${i}.${j}`}
          points={points([
            { z: z0, y: base + horn.size.h },
            { z: z0 + hornDepth(horn), y: base + (horn.size.h * (1 + THROAT_SHARE)) / 2 },
            { z: z0 + hornDepth(horn), y: base + (horn.size.h * (1 - THROAT_SHARE)) / 2 },
            { z: z0, y: base },
          ])}
          {...inBand(d.bands[0])}
        />,
      );
    });
    return out;
  };

  /** the point a horn on the top's depth field measures from: the chamber's front edge */
  const mark = (() => {
    if (focus?.axis !== POSITION_AXIS.back) return null;
    const placed = layout.chambers[focus.chamber];
    const d = placed?.chamber.drivers[focus.driver];
    const horn = d && driverHorn(d);
    if (!placed || !d || !horn) return null;
    const top = placed.y0 + placed.dims.h;
    const y = top + HORN_LIFT_IN + horn.size.h / 2;
    const line = { stroke: pal.ink, strokeWidth: 1.2 };
    return (
      <g aria-hidden="true">
        <line x1={px(0)} x2={px(0)} y1={py(placed.y0)} y2={py(top)} {...line} strokeWidth={2.5} />
        <line x1={px(0)} x2={px(0)} y1={py(top)} y2={py(y)} {...line} strokeDasharray={DASH} />
        <line x1={px(0)} y1={py(y)} x2={px(d.position.yIn)} y2={py(y)} {...line} />
        <circle cx={px(0)} cy={py(y)} r={MARK_DOT_PX} fill={pal.ink} />
      </g>
    );
  })();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      role="img"
      aria-label={`Side view, cut through the center, ${units.amount("boxLength", layout.size.d)} × ${units.amount("boxLength", layout.size.h)}${units.cutMark}, ${layout.chambers.length} chamber${layout.chambers.length === 1 ? "" : "s"}`}
    >
      {layout.chambers.flatMap(chamber)}
      {mark}
    </svg>
  );
}
