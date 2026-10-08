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
  BoxBracing,
  BoxHardwarePlan,
  BoxKeepOut,
  CompressionDriver,
  Dims3,
  Horn,
  HornMountId,
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
  /** the compression driver behind the horn */
  cd: Pick<CompressionDriver, "body" | "exit">;
  plinth: number;
  cutaway: boolean;
  portStyle: PortStyle;
  layout: PaLayout;
  baffleColor: string;
  /** a paint color (hex) for the horn body; absent or empty: the horn's catalog finish */
  hornColor?: string;
  /** what holds a driver bolted straight to its horn on the mid box's lid; absent: the L-bracket */
  hornMount?: HornMountId;
  /** explicit vent geometry when the cabinet is custom */
  portGeom?: Partial<PaPortGeometry>;
  wall?: number;
  inset?: number;
  /** a `FinishId` or a paint color (hex) */
  cabFinish?: string;
  spacerH?: number;
  /** the boxes' braces and ribs (lib/bracing), drawn inside them (they show in the cutaway) */
  subBracing?: BoxBracing;
  midBracing?: BoxBracing | null;
  /** what each box's braces keep clear of (lib/pa/calc): their drivers are drawn in the cutaway */
  subKeepOut?: BoxKeepOut;
  midKeepOut?: BoxKeepOut | null;
  /** each box's handles, input dish and horn posts (lib/pa/hardware), drawn on its faces */
  subHardware?: BoxHardwarePlan;
  midHardware?: BoxHardwarePlan | null;
}

/** Builds the PA stack as a Group (no DOM or WebGL needed); the units are the props' inches. */
export function buildStackScene({
  sub,
  mid,
  horn,
  cd,
  plinth,
  cutaway,
  portStyle,
  layout,
  baffleColor,
  hornColor,
  hornMount,
  portGeom,
  wall = 0.75,
  inset = 0.75,
  cabFinish = "birch",
  spacerH = 20,
  subBracing,
  midBracing,
  subKeepOut,
  midKeepOut,
  subHardware,
  midHardware,
}: Props): THREE.Group {
  const ctx = createSceneContext({
    wall,
    inset,
    cabFinish,
    baffleColor,
    cutaway,
    horn,
    hornColor,
  });
  const { group } = ctx;
  const s = sub.box;
  if (layout === "tower") {
    buildTower(ctx, {
      sub,
      mid,
      horn,
      cd,
      plinth,
      portStyle,
      portGeom,
      subBracing,
      subKeepOut,
      subHardware,
    });
  } else {
    const { top: subTop, group: subGroup } = buildSubwoofer(ctx, {
      sub,
      box: s,
      portStyle,
      portGeom,
      plinth,
      bracing: subBracing,
      keepOut: subKeepOut,
      hardware: subHardware,
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
    const { top: hornY } = buildMid(ctx, {
      mid,
      box: mid.box,
      y: midBaseY,
      xs,
      bracing: midBracing,
      keepOut: midKeepOut,
      hardware: midHardware,
    });
    buildHorn(ctx, { horn, cd, y: hornY, xs, mount: mid.box, hornMount });
  }

  // 5 ft 9 in scale figure, billboarded
  const figure = createScaleFigure(69);
  figure.name = "scale-figure";
  figure.position.set(-s.w * 1.4, 0, 3);
  group.add(figure);
  return group;
}
