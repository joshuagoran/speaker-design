import { CD_OPTIONS, HORN_OPTIONS, MID_OPTIONS, SUB_OPTIONS } from "../data";
import { designProblems, evaluateDesign } from "./optimize";
import type {
  PaDesignConfig,
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
 * Every option for one part dropped into your design with everything else as it is, modelled with the planner's own
 * model and checked against the optimizer's limits: the ones that pass first, then by the part's price (unpriced last).
 */
export function compareDrivers(
  cur: PaDesignConfig,
  part: PaDriverPart,
  lim: PaProblemLimits,
): PaDriverCompareRow[] {
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
      problems: designProblems(m, lim),
    };
  });
  return rows.sort(
    (a, b) =>
      Number(a.problems.length > 0) - Number(b.problems.length > 0) ||
      (a.price ?? Infinity) - (b.price ?? Infinity),
  );
}
