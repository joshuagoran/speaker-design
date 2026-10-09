import { buildSubwoofer } from "./buildSubwoofer";
import { buildMid } from "./buildMid";
import { buildHorn } from "./buildHorn";
import { towerMidDims, towerSpec, TOWER_HORN_WALL_GAP_IN } from "../../lib/pa/tower";
import type { SceneContext } from "./sceneContext";
import type { Props } from "./buildStackScene";

/**
 * The tower layout: one enclosure per side. The mid chamber and horn section share the sub's footprint and sit directly on
 * it, behind one baffle, so the three read as one cabinet. Returns the y of the top.
 */
export function buildTower(
  ctx: SceneContext,
  {
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
  }: Pick<
    Props,
    | "sub"
    | "mid"
    | "horn"
    | "cd"
    | "plinth"
    | "portStyle"
    | "portGeom"
    | "subBracing"
    | "subKeepOut"
    | "subHardware"
  >,
): { top: number } {
  const s = sub.box;
  const spec = towerSpec(s, ctx.wall, horn);
  const { top: subTop, baffleZ } = buildSubwoofer(ctx, {
    sub,
    box: s,
    portStyle,
    portGeom,
    plinth,
    tower: { mid, horn },
    bracing: subBracing,
    keepOut: subKeepOut,
    hardware: subHardware,
  });
  const { top: hornY } = buildMid(ctx, {
    mid,
    box: towerMidDims(s),
    y: subTop,
    baffleZ,
  });
  // the horn sits on the sub's footprint: its center height, and the mouth on the shell's front plane
  return buildHorn(ctx, {
    horn,
    cd,
    y: hornY,
    mount: s,
    tower: {
      cy: plinth + spec.hornCenter,
      width: s.w - 2 * ctx.wall - 2 * TOWER_HORN_WALL_GAP_IN,
      sectionH: spec.hornSectionH,
    },
  });
}
