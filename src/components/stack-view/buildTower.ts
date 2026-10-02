import { buildSubwoofer } from "./buildSubwoofer";
import { buildMid } from "./buildMid";
import { buildHorn } from "./buildHorn";
import { towerSpec, TOWER_MID_HEIGHT_IN } from "./stackHeights";
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
    plinth,
    portStyle,
    portGeom,
  }: Pick<Props, "sub" | "mid" | "horn" | "plinth" | "portStyle" | "portGeom">,
): { top: number } {
  const s = sub.box;
  const { archTop, hornSectionH } = towerSpec(s, ctx.wall, horn);
  const { top: subTop, baffleZ } = buildSubwoofer(ctx, {
    sub,
    box: s,
    portStyle,
    portGeom,
    plinth,
    tower: { mid, horn },
  });
  const { top: hornY } = buildMid(ctx, {
    mid,
    box: { w: s.w, h: TOWER_MID_HEIGHT_IN, d: s.d },
    y: subTop,
    baffleZ,
  });
  // the horn sits on the sub's footprint: centre height, and the mouth flush with the shared baffle face
  return buildHorn(ctx, {
    horn,
    y: hornY,
    mount: s,
    tower: {
      cy: archTop ? hornY + (s.w / 2 - ctx.wall) : hornY + (horn.size.h + 2) / 2,
      z: baffleZ - horn.size.d + 0.2,
      width: s.w - 2 * ctx.wall - 1,
      sectionH: hornSectionH,
    },
  });
}
