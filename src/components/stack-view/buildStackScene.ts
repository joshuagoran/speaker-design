import * as THREE from "three";
import { createSceneContext } from "./sceneContext";
import { buildSubwoofer } from "./buildSubwoofer";
import { buildMid } from "./buildMid";
import { buildHorn } from "./buildHorn";
import { buildTower } from "./buildTower";
import { buildPoleSpacer, buildSatelliteColumns, SATELLITE_COLUMN_D_IN } from "./buildSupports";
import { MID_GAP_IN, SATELLITE_COLUMN_H_IN } from "./stackHeights";
import { createScaleFigure } from "./geometry";
import type {
  Dims3,
  Horn,
  MidDriver,
  PaLayout,
  PaPortGeometry,
  PortStyle,
  SubDriver,
} from "../../types";

export interface Props {
  sub: SubDriver & { box: Dims3 };
  mid: MidDriver & { box: Dims3 };
  horn: Horn;
  plinth: number;
  cutaway: boolean;
  portStyle: PortStyle;
  layout: PaLayout;
  baffleColor: string;
  /** explicit vent geometry when the cabinet is custom */
  portGeom?: Partial<PaPortGeometry>;
  wall?: number;
  inset?: number;
  /** a `FinishId` or a paint colour (hex) */
  cabFinish?: string;
  spacerH?: number;
}

/** Builds the PA stack as a Group (no DOM or WebGL needed); the units are the props' inches. */
export function buildStackScene({
  sub,
  mid,
  horn,
  plinth,
  cutaway,
  portStyle,
  layout,
  baffleColor,
  portGeom,
  wall = 0.75,
  inset = 0.75,
  cabFinish = "birch",
  spacerH = 20,
}: Props): THREE.Group {
  const ctx = createSceneContext({ wall, inset, cabFinish, baffleColor, cutaway });
  const { group } = ctx;
  const s = sub.box;
  if (layout === "tower") {
    buildTower(ctx, { sub, mid, horn, plinth, portStyle, portGeom });
  } else {
    const { top: subTop, group: subGroup } = buildSubwoofer(ctx, {
      sub,
      box: s,
      portStyle,
      portGeom,
      plinth,
    });
    // the mid cube: on the sub, on a spacer above it, or on round columns either side of it
    const satX = s.w / 2 + SATELLITE_COLUMN_D_IN / 2 + 6; // columns clear of the sub
    const midBaseY =
      layout === "satellite"
        ? SATELLITE_COLUMN_H_IN
        : layout === "pole"
          ? subTop + spacerH
          : subTop + MID_GAP_IN;
    const xs = layout === "satellite" ? [-satX, satX] : [0];
    if (layout === "pole") buildPoleSpacer(ctx, { y: subTop, rise: spacerH, parent: subGroup });
    if (layout === "satellite") buildSatelliteColumns(ctx, { xs });
    const { top: hornY } = buildMid(ctx, { mid, box: mid.box, y: midBaseY, xs });
    buildHorn(ctx, { horn, y: hornY, xs, mount: mid.box });
  }

  // 5 ft 9 in scale figure, billboarded
  const figure = createScaleFigure(69);
  figure.name = "scale-figure";
  figure.position.set(-s.w * 1.4, 0, 3);
  group.add(figure);
  return group;
}
