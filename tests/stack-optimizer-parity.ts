// The parity runs of tests/stack-optimize.test.ts: the PA optimizer's cards on each PA preset (stack, pole, satellites,
// tower), read as stacks (the L1 adapters, the music balance worked out for each card's parts), beside the
// Stack optimizer's cards on the same goal and limits. Both at the PA room rule's target (1000 sq ft, about 113 dB at
// 1 m), scored by the Stack optimizer's own evaluation: each side's best on the goal among the designs that keep what the
// goal keeps and are inside the Stack optimizer's space.
import { optimizePaStack, roomRequiredSpl } from "../src/lib/pa/optimize";
import { optimizeStack } from "../src/lib/speaker/optimize/optimizeStack";
import { evaluateStack } from "../src/lib/speaker/optimize/stackEvaluate";
import { outerSize } from "../src/lib/speaker/optimize/evaluate";
import { isConeKind } from "../src/lib/speaker/driverParts";
import { WOOFER_OPTIONS } from "../src/pages/speaker/speakerParts";
import { byId } from "../src/lib/tables";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { paBalancedLayers } from "../src/lib/speaker/paBalance";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { FILL_OPTIONS } from "../src/lib/data";
import { keepsFrom, SPEAKER_GOAL_KEEPS } from "../src/lib/optimizer/goalKeeps";
import { keepGap } from "../src/lib/optimizer/shortfall";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import type {
  PaLayout,
  SpeakerDriver,
  SpeakerGoal,
  SpeakerSpec,
  StackDesign,
  StackOptimizerMetrics,
} from "../src/types";

/** The PA presets, each with its PA layout. */
export const PA_PRESETS = [
  [STACK_PRESET.paStack, "stack"],
  [STACK_PRESET.paPole, "pole"],
  [STACK_PRESET.paSatellite, "satellite"],
  [STACK_PRESET.paTower, "tower"],
] as const satisfies readonly (readonly [string, PaLayout])[];

/** The room the PA optimizer is given, and the target both sides take: its rule's level at 1 m. */
export const PARITY_ROOM = 1000;
export const PARITY_TARGET_DB = roomRequiredSpl(PARITY_ROOM);

/** A goal the PA optimizer offers too. */
export type PaParityGoal = Exclude<SpeakerGoal, "smaller">;

/** A goal's number from a stack's metrics: lower is better. */
export const stackGoalValue = (g: SpeakerGoal, m: StackOptimizerMetrics) =>
  ({
    cheaper: m.price,
    lighter: m.lb,
    smaller: m.volumeL,
    lower: m.f3 ?? Infinity,
    louder: -(m.musicDb ?? -Infinity),
  })[g];

/** One side's best design on the goal that keeps what the goal keeps, and its cards' counts. */
export interface StackParitySide {
  value: number | null;
  cards: number;
  inSpace: number;
  keeping: number;
}

export interface StackParityRun {
  preset: string;
  goal: PaParityGoal;
  start: number;
  stack: StackParitySide;
  pa: StackParitySide;
  /** the PA cards outside the space, each with why */
  outside: string[];
}

/** A cone's nominal size, in (null for a datasheet driver or an unknown id). */
const coneSize = (d: SpeakerDriver) =>
  isConeKind(d.kind)
    ? (byId(WOOFER_OPTIONS, d.driverId)?.size ?? byId(FILL_OPTIONS, d.driverId)?.size ?? null)
    : null;

/**
 * Why a stack is outside the Stack optimizer's space from the preset (null: inside): the same members and speakers,
 * the same chambers and driver entries, each cone of the same nominal size, the same plywood, each box ×0.7 to ×1.5
 * on each axis, the same vents' shape.
 */
function outsideWhy(d: StackDesign, preset: StackDesign): string | null {
  if (d.stack.members.length !== preset.stack.members.length) return "members";
  for (const s of preset.speakers) {
    const o: SpeakerSpec | undefined = d.speakers.find((x) => x.id === s.id);
    if (!o || o.cabinet.chambers.length !== s.cabinet.chambers.length) return "chambers";
    const sameDrivers = o.cabinet.chambers.every((c, k) =>
      c.drivers.every((dr, j) => {
        const t = s.cabinet.chambers[k].drivers[j];
        return !!t && dr.kind === t.kind && coneSize(dr) === coneSize(t);
      }),
    );
    if (!sameDrivers) return "driver size";
    if (o.cabinet.panel.thicknessIn !== s.cabinet.panel.thicknessIn) return "plywood";
    const ventShape = (x: SpeakerSpec) =>
      x.cabinet.chambers.map((c) =>
        c.vent.kind === VENT_KIND.vented
          ? [c.vent.kind, c.vent.port.shape ?? PORT_SHAPE.round, c.vent.port.n]
          : [c.vent.kind],
      );
    if (JSON.stringify(ventShape(o)) !== JSON.stringify(ventShape(s))) return "vent style";
    const a = outerSize(o).sizeIn,
      b = outerSize(s).sizeIn;
    if (
      !(["w", "h", "d"] as const).every(
        (k) => a[k] >= b[k] * 0.7 - 0.01 && a[k] <= b[k] * 1.5 + 0.01,
      )
    )
      return "box size range";
  }
  return null;
}

/** The best of these stacks on the goal among the ones inside the space that keep what it keeps at the target. */
function best(
  designs: readonly StackDesign[],
  preset: StackDesign,
  g: SpeakerGoal,
): StackParitySide {
  const start = evaluateStack(preset).metrics;
  const keep = keepsFrom(SPEAKER_GOAL_KEEPS, PARITY_TARGET_DB, start.f3 ?? Infinity)[g];
  const inside = designs.filter((d) => outsideWhy(d, preset) === null);
  const values = inside.flatMap((d) => {
    const m = evaluateStack(d).metrics;
    const gap = keepGap(keep, { db: m.musicDb ?? -Infinity, f3: m.f3 ?? Infinity });
    return gap === 0 ? [stackGoalValue(g, m)] : [];
  });
  return {
    value: values.length ? Math.min(...values) : null,
    cards: designs.length,
    inSpace: inside.length,
    keeping: values.length,
  };
}

/** A PA preset: the PA optimizer (no budget or weight limit to speak of) against the Stack optimizer. */
export function paPresetParity(
  preset: (typeof PA_PRESETS)[number][0],
  layout: PaLayout,
  goal: PaParityGoal,
): StackParityRun {
  const identity = { id: "parity", name: "Parity" };
  const read = presetLayers(preset, identity);
  const design: StackDesign = { stack: read.stack, speakers: read.speakers };
  const cur = defaultPaDesign(layout);
  const pa = optimizePaStack({
    cur,
    room: PARITY_ROOM,
    maxLb: 1000,
    budget: 5000,
    goals: [goal],
    locks: {},
  });
  // each card as the PA page applies it, read as the preset is read (its poses), its balance worked out for its parts
  const legacy = pa.cards.map((k): StackDesign => {
    const cfg = { ...cur, ...k.config };
    const layers = paBalancedLayers(cfg, layersFromPa(cfg, identity, DEFAULT_COVERAGE_LAYOUT));
    return {
      stack: {
        ...layers.stack,
        members: layers.stack.members.map((m, i) => ({
          ...m,
          pose: design.stack.members[i]?.pose ?? m.pose,
        })),
      },
      speakers: layers.speakers,
    };
  });
  const ours = optimizeStack(design, [goal], {
    targetDb: PARITY_TARGET_DB,
    budget: null,
    maxLb: null,
    maxHeightIn: null,
  });
  return {
    preset,
    goal,
    start: stackGoalValue(goal, evaluateStack(design).metrics),
    stack: best(
      ours.cards.map((c) => c.design),
      design,
      goal,
    ),
    pa: best(legacy, design, goal),
    outside: legacy.flatMap((d, i) => {
      const why = outsideWhy(d, design);
      return why ? [`${pa.cards[i]?.label}: ${why}`] : [];
    }),
  };
}
