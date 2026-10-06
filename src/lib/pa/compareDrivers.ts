import { CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../data";
import { designProblemList, evaluateDesign } from "./optimize";
import type {
  PaDesignConfig,
  PaProblemId,
  PaDriverCompareRow,
  PaDriverPart,
  PaProblemLimits,
} from "../../types";

/** Each part's options, in table order. */
const OPTIONS = {
  sub: SUB_OPTIONS,
  mid: MID_OPTIONS,
  cd: CD_OPTIONS,
  horn: HORN_OPTIONS,
} satisfies Record<
  PaDriverPart,
  readonly { id: string; name: string; price: number | null; lb?: number }[]
>;

/**
 * Every option for one part dropped into your design with everything else as it is, modeled with the planner's own
 * model and checked against the optimizer's limits: the ones that add no problem first, then by the part's price
 * (unpriced last).
 */
// problems whose words carry an amount that differs per option: never marked as your design's too
const PER_OPTION: ReadonlySet<PaProblemId> = new Set<PaProblemId>([
  "midQtc",
  "overWeight",
  "overBudget",
]);

export function compareDrivers(
  cur: PaDesignConfig,
  part: PaDriverPart,
  lim: PaProblemLimits,
): PaDriverCompareRow[] {
  const yours = new Set(designProblemList(evaluateDesign(cur), lim).map((p) => p.id));
  const rows = OPTIONS[part].map((o): PaDriverCompareRow => {
    const m = evaluateDesign({ ...cur, [part]: o.id });
    return {
      id: o.id,
      name: o.name,
      price: o.price,
      yours: o.id === cur[part],
      lb:
        part === "sub"
          ? m
            ? m.subLb
            : null
          : part === "mid"
            ? m
              ? m.midLb
              : null
            : (o.lb ?? null),
      m: m && {
        price: m.price,
        priceKnown: m.priceKnown,
        out: m.out,
        f3: m.f3,
        qtc: m.qtc,
        midGap: m.midGap,
        hornGap: m.hornGap,
      },
      problems: designProblemList(m, lim).map((p) => ({
        ...p,
        yoursToo: yours.has(p.id) && !PER_OPTION.has(p.id),
      })),
    };
  });
  // an option fails only by what it adds: a problem your design has whatever you pick doesn't sort it down
  const fails = (r: PaDriverCompareRow) => Number(r.problems.some((p) => !p.yoursToo));
  return rows.sort((a, b) => fails(a) - fails(b) || (a.price ?? Infinity) - (b.price ?? Infinity));
}
