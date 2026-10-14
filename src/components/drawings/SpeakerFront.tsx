import type { Horn, SpeakerDriver, SpeakerSpec } from "../../types";
import { usePalette } from "../../hooks/useTheme";
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
} from "../../lib/speaker/speakerLayout";
import { paConeRadius } from "../stack-view/buildCone";
import { HORN_LIFT_IN } from "../../constants/paLayouts";
import { CD_OPTIONS, FILL_OPTIONS, hifiDriverById, MID_OPTIONS, SUB_OPTIONS } from "../../lib/data";
import { byId } from "../../lib/tables";
import { isAmt, isRibbon } from "../../lib/hifi/hifi";
import { PANEL } from "../../constants/cutParts";
import { subVentHoles, subVentPlan } from "../stack-view/buildSubwoofer";
import { HIFI_BOX_LAYOUT } from "../../constants/hifiLayout";
import { HORN_CUTOUT_SHAPE, TOWER_HORN_WALL_GAP_IN, towerHornCutout } from "../../lib/pa/tower";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { DRIVER_KIND, PORT_SHAPE } from "../../constants/speakerSpec";

interface Props {
  spec: Pick<SpeakerSpec, "cabinet">;
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
export function speakerFrontFrame(cabinet: Pick<SpeakerSpec["cabinet"], "chambers" | "panel">) {
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
export function SpeakerFront({ spec }: Props) {
  const pal = usePalette();
  const { cabinet } = spec;
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
          {
            fill: pal.muted,
            stroke: pal.ink,
            strokeWidth: 1,
          },
        ),
      ];
    }
    switch (d.kind) {
      case DRIVER_KIND.sub:
      case DRIVER_KIND.mid: {
        const size =
          d.kind === DRIVER_KIND.sub
            ? byId(SUB_OPTIONS, d.driverId)?.size
            : byId(MID_OPTIONS, d.driverId)?.size;
        return size === undefined ? [] : [circle(key, x, y, paConeRadius(size), cone)];
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
          circle(key, x, y, r, cone),
          // a coaxial's HF in the woofer's center: its horn's mouth and the phase plug
          ...(d.kind === DRIVER_KIND.coaxial
            ? [
                circle(`${key}m`, x, y, r * C.hornMouthPerCone, { fill: pal.muted }),
                circle(`${key}p`, x, y, r * C.hornThroatPerCone * C.plugPerThroat, {
                  fill: pal.edge,
                }),
              ]
            : []),
        ];
      }
      case DRIVER_KIND.tweeter: {
        const tw = hifiDriverById("tweeter", d.driverId);
        if (!tw) return [];
        if (horn && !tw.ownGuide)
          return [
            mouth(key, mouthShape(horn), x, y, horn.size.w, horn.size.h, { fill: pal.muted }),
            circle(`${key}t`, x, y, 0.5, { fill: pal.edge }),
          ];
        const face = tw.ownGuide ?? tw.faceplate;
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
          ];
        if (isAmt(tw)) return [<AmtPlate key={key} cx={px(x)} cy={py(y)} plate={face} k={k} />];
        return [
          rect(key, x, y, face.w, face.h, {
            rx: face.w === face.h ? (face.w * k) / 2 : 3,
            fill: pal.muted,
          }),
          circle(`${key}t`, x, y, 0.5, { fill: pal.edge }),
        ];
      }
      case DRIVER_KIND.compression: {
        if (horn) {
          // its cutout in the baffle, as the tower opens it inside the chamber's walls (the cutlist's and the 3D view's)
          const cut = towerHornCutout(hornCutoutBox(placed, t), t, horn);
          return [
            mouth(key, cut, x, y, cut.w, cut.h, {
              fill: pal.muted,
              stroke: pal.ink,
              strokeWidth: 1.2,
            }),
          ];
        }
        const cd = byId(CD_OPTIONS, d.driverId);
        return cd ? [circle(key, x, y, cd.exit / 2, opening)] : [];
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
    // a straight path shows its drivers through the throat; a folded one has them out of sight
    if (path.folds === 0)
      placed.chamber.drivers.forEach((d, j) =>
        driverSpots(placed, d).forEach((spot, n) => {
          const across = driverAcrossIn(d);
          if (across > 0)
            out.push(
              circle(
                `b${i}.${j}.${n}`,
                spot.xIn + path.driverShift.x,
                spot.yIn + path.driverShift.y,
                across / 2,
                behind,
              ),
            );
        }),
      );
    return out;
  };

  const ro = cabinet.roundoverIn;
  const shells = layout.oneShell
    ? [{ x0: -layout.size.w / 2, y0: 0, w: layout.size.w, h: layout.size.h }]
    : layout.chambers.map((c) => ({ x0: c.x0, y0: c.y0, w: c.dims.w, h: c.dims.h }));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
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
      {layout.chambers.flatMap((placed, i) => {
        const { chamber } = placed;
        const parts = vent(placed, i);
        // a horn built into the box: the panel edges inside the face, its mouth in the baffle with the flare's sections
        // seen through it (each segment's end, the straight walls between), and the drivers behind its throat
        const flare = hornFlare(cabinet, placed);
        if (flare) parts.push(...hornParts(placed, flare, i));
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
          if (!driversOnBaffle(chamber) && !onTop(d)) return;
          // a horn that no longer fits where it is set isn't drawn (the page says so)
          if (!hornFitsWhereSet(placed, d)) return;
          driverSpots(placed, d).forEach((s, n) =>
            parts.push(...driver(d, placed, s.xIn, s.yIn, `d${i}.${j}.${n}`)),
          );
        });
        return parts;
      })}
    </svg>
  );
}
