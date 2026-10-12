// Where a space's subs stand (the PA Coverage page's "Subs in the stacks", "Center pair" and "One center sub", lib/pa/
// coverage coverageBoxes): a preset that rewrites a space whose stacks are a top standing on its sub. Pure.
//
// In the stacks, nothing changes. Otherwise each stack's top stands alone at the stack's spot, at the height it had on
// its sub (the PA page keeps the tops' height), and the subs stand at the cluster's spot on the stacks' lift: two side
// by side (a sub's width apart, center to center), or one. Each part keeps its level and delay from the stack (the PA
// page's one sub delay for all subs), and its amp channels: the tops theirs, the subs the stacks' sub channels in turn.
import type {
  DesignLayers,
  FloorPoint,
  SpaceChannel,
  SpacePlacement,
  SubPlacement,
} from "../../types";
import { stackResponse } from "./stackResponse";
import { stackLayout } from "./stackLayout";
import { speakerLayout } from "./speakerLayout";
import { spacePlacement } from "./specParts";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { INCHES_PER_FOOT } from "../../constants/units";
import { SUB_PLACEMENT } from "../../constants/subPlacement";

/** A placement's channels for one member, as the member of a speaker alone (member 0). */
const channelsOf = (channels: readonly SpaceChannel[], member: number) =>
  channels.filter((c) => c.member === member).map((c) => ({ ...c, member: 0 }));

/**
 * The space with its subs where `subs` puts them, `cluster` the center subs' spot (ft); unchanged in the stacks, or when
 * the space's stack isn't a top standing on its sub.
 */
export function withSubPlacement(
  layers: DesignLayers,
  subs: SubPlacement,
  cluster: FloorPoint,
): DesignLayers {
  const { stack, speakers, space } = layers;
  const [subMember, topMember] = stack.members;
  if (subs === SUB_PLACEMENT.stacks || stack.members.length !== 2 || topMember.pose.on !== 0)
    return layers;
  const sub = speakers.find((s) => s.id === subMember.speakerId);
  const isStack = (p: SpacePlacement) => p.item.kind === SPACE_ITEM.stack && p.item.id === stack.id;
  const stacks = space.placements.filter(isStack);
  if (!sub || !stacks.length) return layers;
  const response = stackResponse(stack, speakers);
  const delay = (k: number) => response.members[k]?.delayMs ?? 0;
  /** the top's bottom above the stack's base, in */
  const topLiftIn = stackLayout(stack, speakers)[1].at.y;
  const tops = space.placements.map((p): SpacePlacement =>
    isStack(p)
      ? {
          ...p,
          item: { kind: SPACE_ITEM.speaker, id: topMember.speakerId },
          liftIn: p.liftIn + topLiftIn,
          levelDb: p.levelDb + topMember.levelDb,
          delayMs: p.delayMs + delay(1),
          channels: channelsOf(p.channels, 1),
        }
      : p,
  );
  const halfFt = speakerLayout(sub.cabinet).size.w / 2 / INCHES_PER_FOOT;
  const spots =
    subs === SUB_PLACEMENT.single
      ? [cluster]
      : [-1, 1].map((side) => ({ x: cluster.x + side * halfFt, y: cluster.y }));
  const subPlacements = spots.map((spot, k): SpacePlacement => {
    const from = stacks[Math.min(k, stacks.length - 1)];
    return {
      ...spacePlacement(
        spot,
        { kind: SPACE_ITEM.speaker, id: sub.id },
        from.liftIn,
        channelsOf(from.channels, 0),
      ),
      levelDb: from.levelDb + subMember.levelDb,
      delayMs: from.delayMs + delay(0),
    };
  });
  return { ...layers, space: { ...space, placements: [...tops, ...subPlacements] } };
}
