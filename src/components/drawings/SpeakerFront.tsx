import { useRef, useState } from "react";
import type {
  BandId,
  FacePoint,
  FoldWall,
  Horn,
  HornFold,
  PositionFocus,
  SpeakerDriver,
  SpeakerSpec,
} from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { alpha } from "../../styles/palette";
import { bandColor } from "../../lib/speaker/bandColor";
import {
  dragStart,
  draggedPosition,
  othersKey,
  unblockedPosition,
  type DragBounds,
} from "../../lib/speaker/driverDrag";
import { POSITION_AXIS, type PositionAxis } from "../../constants/speakerResults";
import { AmtPlate, RibbonPlate } from "./HifiFront";
import {
  driverAcrossIn,
  driverHorn,
  driverSpots,
  driversOnBaffle,
  hornFlare,
  onTop,
  PORT_RULE,
  portRule,
  radiatorsAt,
  roundPortsAt,
  speakerBounds,
  type PlacedChamber,
  type HornFlare,
  slotOpeningsAt,
  hornFitsWhereSet,
  hornCutoutBox,
  chamberHardwareBox,
} from "../../lib/speaker/speakerLayout";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { foldDrawing } from "../../lib/speaker/foldHorn";
import { hardwareFrontMarks } from "../stack-view/buildHardware";
import { paConeRadius } from "../stack-view/buildCone";
import { HORN_LIFT_IN } from "../../constants/paLayouts";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  hifiDriverById,
  MID_OPTIONS,
  SPEAKER_SUB_OPTIONS,
} from "../../lib/data";
import { coneParts } from "../../lib/speaker/driverParts";
import { CM2_PER_IN2 } from "../../constants/units";
import { byId } from "../../lib/tables";
import { isAmt, isRibbon } from "../../lib/hifi/hifi";
import { PANEL } from "../../constants/cutParts";
import { subVentHoles } from "../stack-view/buildSubwoofer";
import { subVentPlan } from "../../lib/pa/subVentPlan";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { HORN_CUTOUT_SHAPE, TOWER_HORN_WALL_GAP_IN, towerHornCutout } from "../../lib/pa/tower";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { DRIVER_KIND, FOLD_WALL, PORT_SHAPE } from "../../constants/speakerSpec";

interface Props {
  spec: Pick<SpeakerSpec, "cabinet" | "bands">;
  /**
   * moves a driver entry dragged on the baffle to `position` (the spec's terms); absent: the drivers stay put (a card, a
   * stack's drawing)
   */
  onMoveDriver?: (chamber: number, driver: number, position: FacePoint) => void;
  /** the driver position field with focus: its point (the center line, or the bottom) is marked; null: none */
  focus?: PositionFocus | null;
}

/** The light fill a driver takes inside its band's outline. */
const DRIVER_FILL_ALPHA = 0.18;
/** The marked point's dot radius and the measure line's dash, px. */
const MARK_DOT_PX = 3;
const MARK_DASH = "3 2";
/**
 * The measure's label size, its gap from the line and its halo, and the half-length of the + at a driver's center, in the
 * drawing's units (`VIEW_PX` across its longer side, scaled to its box).
 */
const MARK_FONT_PX = 7.5;
const MARK_LABEL_GAP_PX = 3;
const MARK_HALO_PX = 1.5;
const CENTER_PLUS_PX = 3;

/** A position as its field shows it, in, to the hundredth: signed across, plain up. */
const markLabel = (v: number, signed: boolean) => {
  const r = Math.round(v * 100) / 100;
  return `${signed && r > 0 ? "+" : ""}${r}″`;
};

/** A driver dragged on the baffle: its entry, where its group started, where it may go, and the pointer's start. */
interface Drag {
  chamber: number;
  driver: number;
  start: FacePoint;
  bounds: DragBounds;
  from: { x: number; y: number };
  /** the last position sent, so a move that rounds to it sends nothing */
  last: FacePoint;
  /** where the chamber's other drivers stood when the drag began (`othersKey`): the drag never moves them */
  others: string;
}

/** The points a curved vent opening is drawn with. */
const HOLE_POINTS = 24;
/** The drawing's size, px, and its margin. */
const VIEW_PX = 150;
const PAD_PX = 4;
/**
 * A horn's mouth shape by the one rule the baffle cutout, the cutlist and the 3D view take (lib/pa/tower
 * towerHornCutout): a meshed horn's silhouette (drawn as the ellipse its area takes), a rectangle with rounded corners
 * (a rectangular mouth, or a horn with no profile), or a circle. Sized here in a box that holds the mouth's width, so
 * a rectangular mouth keeps its own.
 */
const mouthShape = (horn: Horn) =>
  towerHornCutout({ w: horn.size.w + 2 * TOWER_HORN_WALL_GAP_IN }, 0, horn);

/**
 * What the front drawing spans, in: the speaker's extent (lib/speaker/speakerLayout `speakerBounds`, the horns on its
 * top included), and its margin at the drawing's scale (a drawing placed among others lines up with them).
 */
export function speakerFrontFrame(
  cabinet: Pick<SpeakerSpec["cabinet"], "chambers" | "panel" | "construction" | "insetIn">,
) {
  const { layout, minX, maxX, maxY } = speakerBounds(cabinet);
  /** px per inch */
  const k = (VIEW_PX - 2 * PAD_PX) / Math.max(maxX - minX, maxY);
  return { layout, minX, maxX, maxY, k, padIn: PAD_PX / k };
}

/**
 * Front view of any speaker spec, to scale, as its layout places the parts (lib/speaker/speakerLayout, the 3D view's
 * too): each chamber's outline, the drivers (a PA cone, a Hi-fi woofer's frame with a coaxial's HF in it, a tweeter's
 * plate, a ribbon's or an AMT's own, a horn's mouth in the baffle or on the top), the port by its engine's rule (the
 * PA's as its front view draws it, the Hi-fi's), the radiators, and a horn-loaded chamber's mouth. A Hi-fi port or a
 * radiator on the back is drawn dashed (behind). The top is drawn flat (an arched top too, for now).
 */
export function SpeakerFront({ spec, onMoveDriver, focus = null }: Props) {
  const pal = usePalette();
  const { cabinet } = spec;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  /** the driver entry being dragged, so the view shows its position while it moves */
  const [dragging, setDragging] = useState<Pick<Drag, "chamber" | "driver"> | null>(null);
  const t = cabinet.panel.thicknessIn;
  const { layout, minX, maxX, maxY, k } = speakerFrontFrame(cabinet);
  if (!layout.chambers.length) return null;
  const W = (maxX - minX) * k + 2 * PAD_PX,
    H = maxY * k + 2 * PAD_PX;
  const px = (x: number) => PAD_PX + (x - minX) * k,
    py = (y: number) => PAD_PX + (maxY - y) * k;
  /** a rectangle by its center and size, inches */
  const rect = (
    key: string,
    cx: number,
    cy: number,
    w: number,
    h: number,
    props: React.SVGProps<SVGRectElement>,
  ) => (
    <rect key={key} x={px(cx - w / 2)} y={py(cy + h / 2)} width={w * k} height={h * k} {...props} />
  );
  const circle = (
    key: string,
    cx: number,
    cy: number,
    r: number,
    props: React.SVGProps<SVGCircleElement>,
  ) => <circle key={key} cx={px(cx)} cy={py(cy)} r={r * k} {...props} />;
  /**
   * a horn's mouth by its center and size, inches, in its shape (`mouthShape`, or the baffle cutout's): the meshed
   * silhouette as an ellipse, a rounded rectangle, or a circle
   */
  const mouth = (
    key: string,
    shape: Pick<ReturnType<typeof towerHornCutout>, "shape" | "r">,
    cx: number,
    cy: number,
    w: number,
    h: number,
    props: Pick<React.SVGProps<SVGElement>, "fill" | "stroke" | "strokeWidth">,
  ) =>
    shape.shape === HORN_CUTOUT_SHAPE.outline ? (
      <ellipse key={key} cx={px(cx)} cy={py(cy)} rx={(w * k) / 2} ry={(h * k) / 2} {...props} />
    ) : shape.shape === HORN_CUTOUT_SHAPE.circle ? (
      circle(key, cx, cy, Math.min(w, h) / 2, props)
    ) : (
      rect(key, cx, cy, w, h, { rx: shape.r * k, ...props })
    );
  const opening = { fill: pal.ink };
  const cone = { fill: pal.edge, stroke: pal.muted, strokeWidth: 1 };
  /** a driver part in its band's color (lib/speaker/bandColor): the outline, and a light fill inside it */
  const inBand = (band: BandId | undefined) => {
    const { stroke } = bandColor(spec.bands, band ?? "", pal);
    return { fill: alpha(stroke, DRIVER_FILL_ALPHA), stroke, strokeWidth: 1.2 };
  };
  /** a part on the back, behind the baffle */
  const behind = { fill: "none", stroke: pal.muted, strokeDasharray: "3 2" };

  /** a chamber's port by its engine's rule */
  const vent = (placed: PlacedChamber, i: number) => {
    const rule = portRule(placed.chamber);
    const { cx, y0, dims } = placed;
    if (!rule) return [];
    if (rule.rule === PORT_RULE.hifi) {
      const { port } = rule;
      if (port.shape === PORT_SHAPE.slot)
        // each of the stacked slots
        return slotOpeningsAt(placed, port, t).map((o, j) =>
          rect(`v${i}.${j}`, cx + o.x, y0 + o.y + o.h / 2, o.w, o.h, opening),
        );
      // each cut to its tube's outside, as the 3D view cuts it
      const { panel, spots } = roundPortsAt(placed, port);
      return spots.map((s, j) =>
        circle(
          `v${i}.${j}`,
          cx + s.x,
          y0 + s.y,
          s.r + HIFI_BOX_LAYOUT.portTubeWallIn,
          panel === PANEL.back ? behind : opening,
        ),
      );
    }
    // the PA's, as the 3D view cuts them (stack-view/buildSubwoofer): the tubes' or the side ducts' openings, and the
    // letterbox's mouths under its shelf, between its fins
    const plan = subVentPlan(rule.sub, dims, rule.portStyle, rule.portGeom, t);
    const holes = subVentHoles(plan, dims, t, { x: cx, plinth: y0, baffleCy: 0 }).map((h, j) => (
      <path
        key={`v${i}.${j}`}
        d={`${h
          .getPoints(HOLE_POINTS)
          .map((q, n) => `${n ? "L" : "M"}${px(q.x)},${py(q.y)}`)
          .join("")}Z`}
        {...opening}
      />
    ));
    // the letterbox's openings between its fins (lib/pa/calc slotFinLayout)
    const band =
      plan.bandH > 0
        ? plan.fins.openings.map((x, j) =>
            rect(
              `v${i}.s${j}`,
              cx + x,
              y0 + t + plan.ductH / 2,
              plan.fins.open,
              plan.ductH,
              opening,
            ),
          )
        : [];
    return [...holes, ...band];
  };

  /** one driver at (x, y): on the baffle, or its horn standing on the top */
  const driver = (d: SpeakerDriver, placed: PlacedChamber, x: number, y: number, key: string) => {
    const horn = driverHorn(d);
    /** its first band's color; a coaxial's HF takes its second band's */
    const color = inBand(d.bands[0]);
    const hfColor = inBand(d.bands[1] ?? d.bands[0]);
    if (horn && onTop(d)) {
      // its foot on the lid, a quarter of its width, as the Hi-fi front view draws a waveguide on the top
      const foot = horn.size.w / 4;
      return [
        rect(`${key}f`, x, y + HORN_LIFT_IN / 2, foot, HORN_LIFT_IN, { fill: pal.ink }),
        mouth(
          `${key}h`,
          mouthShape(horn),
          x,
          y + HORN_LIFT_IN + horn.size.h / 2,
          horn.size.w,
          horn.size.h,
          color,
        ),
      ];
    }
    switch (d.kind) {
      case DRIVER_KIND.sub:
      case DRIVER_KIND.mid: {
        const size =
          d.kind === DRIVER_KIND.sub
            ? byId(SPEAKER_SUB_OPTIONS, d.driverId)?.size
            : byId(MID_OPTIONS, d.driverId)?.size;
        return size === undefined ? [] : [circle(key, x, y, paConeRadius(size), color)];
      }
      case DRIVER_KIND.woofer:
      case DRIVER_KIND.coaxial: {
        const size =
          d.kind === DRIVER_KIND.woofer
            ? hifiDriverById("woofer", d.driverId)?.size
            : byId(FILL_OPTIONS, d.driverId)?.size;
        if (size === undefined) return [];
        const r = (size * HIFI_FRONT_PARTS.wooferFramePerSize) / 2;
        const C = HIFI_FRONT_PARTS.coax;
        return [
          circle(key, x, y, r, color),
          // a coaxial's HF in the woofer's center, in its own band's color: its horn's mouth and the phase plug
          ...(d.kind === DRIVER_KIND.coaxial
            ? [
                circle(`${key}m`, x, y, r * C.hornMouthPerCone, { ...hfColor, fill: pal.panel }),
                circle(`${key}p`, x, y, r * C.hornThroatPerCone * C.plugPerThroat, hfColor),
              ]
            : []),
        ];
      }
      case DRIVER_KIND.tweeter: {
        const tw = hifiDriverById("tweeter", d.driverId);
        if (!tw) return [];
        if (horn && !tw.ownGuide)
          return [
            mouth(key, mouthShape(horn), x, y, horn.size.w, horn.size.h, color),
            circle(`${key}t`, x, y, 0.5, { fill: color.stroke }),
          ];
        const face = tw.ownGuide ?? tw.faceplate;
        /** the plate's outline in its band's color, over a ribbon's or an AMT's own drawing */
        const outline = rect(`${key}o`, x, y, face.w, face.h, {
          rx: HIFI_FRONT_PARTS.plateCornerIn * k,
          fill: "none",
          stroke: color.stroke,
          strokeWidth: 1.5,
        });
        if (isRibbon(tw))
          return [
            <RibbonPlate
              key={key}
              cx={px(x)}
              cy={py(y)}
              w={face.w * k}
              h={face.h * k}
              corner={HIFI_FRONT_PARTS.plateCornerIn * k}
            />,
            outline,
          ];
        if (isAmt(tw))
          return [<AmtPlate key={key} cx={px(x)} cy={py(y)} plate={face} k={k} />, outline];
        return [
          rect(key, x, y, face.w, face.h, {
            rx: face.w === face.h ? (face.w * k) / 2 : 3,
            ...color,
          }),
          circle(`${key}t`, x, y, 0.5, { fill: color.stroke }),
        ];
      }
      case DRIVER_KIND.compression: {
        if (horn) {
          // its cutout in the baffle, as the tower opens it inside the chamber's walls (the cutlist's and the 3D view's)
          const cut = towerHornCutout(hornCutoutBox(placed, t), t, horn);
          return [mouth(key, cut, x, y, cut.w, cut.h, color)];
        }
        const cd = byId(CD_OPTIONS, d.driverId);
        return cd ? [circle(key, x, y, cd.exit / 2, { ...opening, stroke: color.stroke })] : [];
      }
    }
  };

  /** a horn-loaded chamber's drawing: see where it is used */
  const hornParts = (placed: PlacedChamber, flare: HornFlare, i: number) => {
    const { mouth, path } = flare;
    const { clear } = placed;
    // the path's last leg ends at the mouth: its sections are what shows through it, nested
    const seen = path.legs[path.legs.length - 1].sections;
    /** where a segment starts or ends: the outlines drawn (the steps between are the flare's walls) */
    const joints = seen.filter((sec) => sec.joint);
    const corner = (n: number) =>
      seen
        .map((sec) => {
          const x = sec.cx + ((n % 2 ? 1 : -1) * sec.w) / 2,
            y = sec.cy + ((n < 2 ? -1 : 1) * sec.h) / 2;
          return `${px(x)},${py(y)}`;
        })
        .join(" ");
    const line = { fill: "none", stroke: pal.muted, strokeWidth: 0.8 };
    const out: React.JSX.Element[] = [
      // the walls' inside edges: the clear face the horn, the vents and the drivers stand in
      rect(`e${i}`, clear.x + clear.w / 2, clear.y + clear.h / 2, clear.w, clear.h, {
        fill: "none",
        stroke: pal.muted,
        strokeWidth: 0.8,
      }),
      rect(`m${i}`, mouth.x + mouth.w / 2, mouth.y + mouth.h / 2, mouth.w, mouth.h, {
        rx: 2,
        fill: pal.panel,
        stroke: pal.ink,
        strokeWidth: 1.2,
      }),
      ...joints.map((sec, j) =>
        rect(`s${i}.${j}`, sec.cx, sec.cy, sec.w, sec.h, { ...line, strokeWidth: 0.6 }),
      ),
      ...[0, 1, 2, 3].map((n) => <polyline key={`w${i}.${n}`} points={corner(n)} {...line} />),
    ];
    // a straight path shows its drivers through the throat (their frames dashed, their cones' outlines solid), and the
    // walls' back edges across them; a folded one has them out of sight
    if (path.folds === 0) {
      placed.chamber.drivers.forEach((d, j) =>
        driverSpots(placed, d).forEach((spot, n) => {
          const across = driverAcrossIn(d);
          const x = spot.xIn,
            y = spot.yIn;
          if (across > 0) out.push(circle(`b${i}.${j}.${n}`, x, y, across / 2, behind));
          const sd = coneParts(d)?.ts.Sd;
          if (sd)
            out.push(
              circle(`c${i}.${j}.${n}`, x, y, Math.sqrt(sd / CM2_PER_IN2 / Math.PI), {
                ...line,
                stroke: inBand(d.bands[0]).stroke,
              }),
            );
        }),
      );
      // the throat: the walls' back edges, over the cones where the horn loads them
      const [throat] = path.legs[0].sections;
      for (const side of [-1, 1])
        out.push(
          <line
            key={`t${i}.${side}`}
            x1={px(throat.cx + (side * throat.w) / 2)}
            x2={px(throat.cx + (side * throat.w) / 2)}
            y1={py(throat.cy - throat.h / 2)}
            y2={py(throat.cy + throat.h / 2)}
            stroke={pal.ink}
            strokeWidth={1.2}
          />,
        );
    }
    return out;
  };

  /**
   * A drawn (folded) horn's mouth where it is on the baffle: the clear width, from its lower to its upper edge up the
   * baffle, as the flare's mouth is drawn, inside the panel edges. Its boards and drivers are inside: none on the face.
   * The rear chamber's vent opening is drawn the same way, dark on the baffle and dashed (behind) on the back.
   */
  const foldParts = (placed: PlacedChamber, fold: Pick<HornFold, "mouth" | "vent">, i: number) => {
    const { clear } = placed;
    const mouthIn = fold.mouth;
    const from = Math.max(0, Math.min(mouthIn.fromIn, mouthIn.toIn));
    const to = Math.min(clear.h, Math.max(mouthIn.fromIn, mouthIn.toIn));
    const { vent } = fold;
    const ventFrom = vent ? Math.max(0, Math.min(vent.fromIn, vent.toIn)) : 0;
    const ventTo = vent ? Math.min(clear.h, Math.max(vent.fromIn, vent.toIn)) : 0;
    return [
      rect(`e${i}`, clear.x + clear.w / 2, clear.y + clear.h / 2, clear.w, clear.h, {
        fill: "none",
        stroke: pal.muted,
        strokeWidth: 0.8,
      }),
      ...(mouthIn.wall === FOLD_WALL.baffle && to > from
        ? [
            rect(`m${i}`, clear.x + clear.w / 2, clear.y + (from + to) / 2, clear.w, to - from, {
              rx: 2,
              fill: pal.panel,
              stroke: pal.ink,
              strokeWidth: 1.2,
            }),
          ]
        : []),
      ...(vent &&
      (vent.wall === FOLD_WALL.baffle || vent.wall === FOLD_WALL.back) &&
      ventTo > ventFrom
        ? [
            rect(
              `fv${i}`,
              clear.x + clear.w / 2,
              clear.y + (ventFrom + ventTo) / 2,
              clear.w,
              ventTo - ventFrom,
              { rx: 1, ...(vent.wall === FOLD_WALL.back ? behind : opening) },
            ),
          ]
        : []),
    ];
  };

  // the handles and posts the build plans, seen edge-on where they stand out of the sides and the lid (the same parts and
  // faces the 3D view draws: stack-view/buildHardware)
  const build = cabinetBuild(cabinet);
  const hardware = layout.chambers.flatMap((placed, i) => {
    const plan = build.chambers[i]?.hardware;
    if (!plan) return [];
    const on = chamberHardwareBox(cabinet, placed);
    return hardwareFrontMarks(plan, on.box, on.y0, on.cx).map((m, j) =>
      rect(`hw${i}.${j}`, m.x, m.y, m.w, m.h, {
        fill: pal.muted,
        stroke: pal.ink,
        strokeWidth: 0.6,
      }),
    );
  });
  /** the pointer in the drawing's units (its viewBox), from a pointer event; null before the drawing is laid out */
  const toDrawing = (e: React.PointerEvent) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  /** the handlers a draggable driver entry's group takes */
  const dragProps = (placed: PlacedChamber, chamber: number, entry: number) => {
    if (!onMoveDriver) return {};
    const d = placed.chamber.drivers[entry];
    return {
      style: { cursor: "move", touchAction: "none" },
      onPointerDown: (e: React.PointerEvent<SVGGElement>) => {
        const from = toDrawing(e);
        if (!from) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const { center, bounds } = dragStart(placed, driverSpots(placed, d), driverAcrossIn(d));
        drag.current = {
          chamber,
          driver: entry,
          start: center,
          bounds,
          from,
          last: center,
          others: othersKey(cabinet, chamber, entry, center),
        };
        setDragging({ chamber, driver: entry });
      },
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const now = drag.current;
    const at = now && toDrawing(e);
    if (!now || !at || !onMoveDriver) return;
    // stopped where it would push another driver aside
    const next = unblockedPosition(
      cabinet,
      now.chamber,
      now.driver,
      now.others,
      now.last,
      draggedPosition(
        now.start,
        { xIn: (at.x - now.from.x) / k, yIn: -(at.y - now.from.y) / k },
        now.bounds,
      ),
    );
    if (next.xIn === now.last.xIn && next.yIn === now.last.yIn) return;
    now.last = next;
    onMoveDriver(now.chamber, now.driver, next);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(null);
  };

  /**
   * The measures of one driver entry's position, each from its reference to the group's center with the field's value:
   * across from the chamber's center line, up from its bottom. A focused field shows its own; a drag shows both.
   */
  const measures = (chamber: number, entry: number, axes: readonly PositionAxis[]) => {
    const placed = layout.chambers[chamber];
    const d = placed?.chamber.drivers[entry];
    if (!placed || !d) return null;
    const { center } = dragStart(placed, driverSpots(placed, d), driverAcrossIn(d));
    const x = placed.cx + center.xIn,
      y = placed.y0 + center.yIn;
    const line = { stroke: pal.ink, strokeWidth: 1.2 };
    const label = {
      fontSize: MARK_FONT_PX,
      fill: pal.ink,
      stroke: pal.panel,
      strokeWidth: MARK_HALO_PX,
    };
    return (
      <g aria-hidden="true" style={{ paintOrder: "stroke" }}>
        {axes.map((axis) => {
          const across = axis === POSITION_AXIS.across;
          /** the origin on the reference line, level with the driver (across) or under it (up) */
          const origin = across ? { x: placed.cx, y } : { x, y: placed.y0 };
          return (
            <g key={axis}>
              {across ? (
                <line
                  x1={px(placed.cx)}
                  x2={px(placed.cx)}
                  y1={py(placed.y0)}
                  y2={py(placed.y0 + placed.dims.h)}
                  {...line}
                  strokeDasharray={MARK_DASH}
                />
              ) : (
                <line
                  x1={px(placed.x0)}
                  x2={px(placed.x0 + placed.dims.w)}
                  y1={py(placed.y0)}
                  y2={py(placed.y0)}
                  {...line}
                  strokeWidth={2.5}
                />
              )}
              <line x1={px(origin.x)} y1={py(origin.y)} x2={px(x)} y2={py(y)} {...line} />
              <circle cx={px(origin.x)} cy={py(origin.y)} r={MARK_DOT_PX} fill={pal.ink} />
              <text
                x={across ? px((origin.x + x) / 2) : px(x) + MARK_LABEL_GAP_PX}
                y={across ? py(y) - MARK_LABEL_GAP_PX : py((origin.y + y) / 2)}
                textAnchor={across ? "middle" : "start"}
                dominantBaseline={across ? "auto" : "middle"}
                {...label}
              >
                {markLabel(across ? d.position.xIn : d.position.yIn, across)}
              </text>
            </g>
          );
        })}
        <circle cx={px(x)} cy={py(y)} r={MARK_DOT_PX} fill="none" {...line} />
      </g>
    );
  };
  const mark = dragging
    ? measures(dragging.chamber, dragging.driver, [POSITION_AXIS.across, POSITION_AXIS.up])
    : focus && focus.axis !== POSITION_AXIS.back
      ? measures(focus.chamber, focus.driver, [focus.axis])
      : null;

  const ro = cabinet.roundoverIn;
  const shells = layout.oneShell
    ? [{ x0: -layout.size.w / 2, y0: 0, w: layout.size.w, h: layout.size.h }]
    : layout.chambers.map((c) => ({ x0: c.x0, y0: c.y0, w: c.dims.w, h: c.dims.h }));
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label={`Front view, ${layout.size.w} × ${layout.size.h}″, ${layout.chambers.length} chamber${layout.chambers.length === 1 ? "" : "s"}`}
    >
      {layout.chambers.map((c, i) => (
        <rect
          key={`c${i}`}
          x={px(c.x0)}
          y={py(c.y0 + c.dims.h)}
          width={c.dims.w * k}
          height={c.dims.h * k}
          fill={pal.edge}
          fillOpacity={0.85}
          stroke={pal.ink}
          strokeWidth="1.2"
        />
      ))}
      {/* the line where each shell's roundover starts */}
      {ro > 0 &&
        shells.map((s, i) => (
          <rect
            key={`r${i}`}
            x={px(s.x0 + ro)}
            y={py(s.y0 + s.h - ro)}
            width={Math.max(0, s.w - 2 * ro) * k}
            height={Math.max(0, s.h - 2 * ro) * k}
            fill="none"
            stroke={pal.muted}
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        ))}
      {hardware}
      {layout.chambers.flatMap((placed, i) => {
        const { chamber } = placed;
        const parts = vent(placed, i);
        // a horn built into the box: the panel edges inside the face, its mouth in the baffle with the flare's sections
        // seen through it (each segment's end, the straight walls between), and the drivers behind its throat
        const flare = hornFlare(cabinet, placed);
        if (flare) parts.push(...hornParts(placed, flare, i));
        // a drawn horn: its mouth where it is on the baffle, and its vent where it is on the baffle or the back
        const drawing = foldDrawing(cabinet, chamber);
        const onFace = (w: FoldWall | undefined) => w === FOLD_WALL.baffle || w === FOLD_WALL.back;
        if (
          drawing &&
          (drawing.fold.mouth.wall === FOLD_WALL.baffle || onFace(drawing.fold.vent?.wall))
        )
          parts.push(...foldParts(placed, drawing.fold, i));
        // the passive radiators: on the baffle as a cone, on the back dashed
        radiatorsAt(cabinet, placed).spots.forEach((s, j) =>
          parts.push(
            rect(`p${i}.${j}`, placed.cx + s.x, placed.y0 + s.y, s.shape.w, s.shape.h, {
              rx: (s.shape.w * k) / 2,
              ...(s.panel === PANEL.baffle ? cone : behind),
            }),
          ),
        );
        // the drivers on the baffle (a front-loaded horn's sit inside, at its throat) and the horns on the top
        chamber.drivers.forEach((d, j) => {
          if ((drawing || !driversOnBaffle(chamber)) && !onTop(d)) return;
          // a horn that no longer fits where it is set isn't drawn (the page says so)
          if (!hornFitsWhereSet(placed, d)) return;
          const drawn = driverSpots(placed, d).flatMap((s, n) => [
            ...driver(d, placed, s.xIn, s.yIn, `d${i}.${j}.${n}`),
            // its center, as a +
            <path
              key={`d${i}.${j}.${n}+`}
              d={`M${px(s.xIn) - CENTER_PLUS_PX} ${py(s.yIn)}h${2 * CENTER_PLUS_PX}M${px(s.xIn)} ${py(s.yIn) - CENTER_PLUS_PX}v${2 * CENTER_PLUS_PX}`}
              stroke={pal.ink}
              strokeWidth={1.2}
            />,
          ]);
          // a driver on the baffle drags as one group with its entry's other drivers (a horn on the top stays put)
          parts.push(
            onTop(d) ? (
              <g key={`d${i}.${j}`}>{drawn}</g>
            ) : (
              <g key={`d${i}.${j}`} {...dragProps(placed, i, j)}>
                {drawn}
              </g>
            ),
          );
        });
        return parts;
      })}
      {mark}
    </svg>
  );
}
