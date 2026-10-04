// The card selection both optimizers share: a pool of evaluated designs in, up to three cards out. Each engine keeps
// its own goal tables and wording and hands them in as callbacks; the order of the cards is decided here.

/** A card's heading and the sentence under it. */
export interface CardRole {
  label: string;
  why: string;
}

export interface SelectCardsOptions<P, G extends string> {
  pool: readonly P[];
  /** the primary goal: it ranks the first card, the fix and the smallest change */
  goal: G;
  /** every selected goal, primary first */
  goals: readonly G[];
  /** lower is better */
  objective: (g: G, p: P) => number;
  /** the design beats your design on this axis (true when there is no current design) */
  beatsCurrent: (g: G, p: P) => boolean;
  /** design `a` beats design `b` on this axis */
  beats: (g: G, a: P, b: P) => boolean;
  /** the design keeps what the goals keep from your design */
  meets: (p: P) => boolean;
  /** the design is a different design from every card chosen so far */
  differs: (p: P, chosen: readonly P[]) => boolean;
  /** how many things the design changes from yours */
  changeCount: (p: P) => number;
  /** your design fails a check */
  currentFails: boolean;
  /** your design could be modelled */
  hasCurrent: boolean;
  /** orders designs the objective ties on; none keeps the pool's order */
  tieBreak?: (a: P, b: P) => number;
  /** the axes the alternatives are drawn from, in order and without repeats */
  altAxes: readonly G[];
  /** an extra condition on an alternative for its axis */
  altFilter?: (g: G, p: P) => boolean;
  /**
   * how far a design falls short of what the goals keep (0 when it meets them); with nothing passing `meets`, the fix is
   * the design that falls least short, labelled `closest`
   */
  shortfall?: (p: P) => number;
  labels: { first: CardRole; fix: CardRole; closest?: CardRole; alt: (g: G) => CardRole };
  /** 3 when absent */
  maxCards?: number;
}

/** Which card it is, for code to tell cards apart without reading their labels: an alternative names its axis. */
export type CardSlot<G extends string> =
  | { kind: "first" | "fix" | "closest" | "smallest" }
  | { kind: "alt"; axis: G };

export interface SelectedCard<P, G extends string> extends CardRole {
  p: P;
  slot: CardSlot<G>;
}

/**
 * The cards, in order: (1) the best design on the goal that keeps what the goals keep and beats your design on every
 * goal, or, when there is none and your design fails a check, the best design that passes, as a fix; (2) the smallest
 * change (at most one thing) that does the same; (3) one alternative per axis, each beating your design and the first
 * card on its own axis, until the cards run out. `goalMissing` is set when no design beats yours and yours passes;
 * `fixMisses` when the fix is only the closest (it passes the checks but misses what the goals keep).
 */
export function selectCards<P, G extends string>(
  o: SelectCardsOptions<P, G>,
): { cards: SelectedCard<P, G>[]; goalMissing: boolean; fixMisses: boolean } {
  const { pool, goal, goals, objective, beatsCurrent, beats, meets, differs, tieBreak } = o;
  const max = o.maxCards ?? 3;
  const best = (list: readonly P[], g: G): P | undefined =>
    list.slice().sort((a, b) => {
      const d = objective(g, a) - objective(g, b);
      return tieBreak ? d || tieBreak(a, b) : d;
    })[0];
  const beatsAll = (p: P) => goals.every((g) => beatsCurrent(g, p));
  const cards: SelectedCard<P, G>[] = [];
  const chosen = () => cards.map((k) => k.p);
  const first = best(
    pool.filter((p) => meets(p) && beatsAll(p)),
    goal,
  );
  let fixMisses = false;
  if (first) cards.push({ p: first, slot: { kind: "first" }, ...o.labels.first });
  else if (o.currentFails) {
    const fix = best(pool.filter(meets), goal);
    if (fix) cards.push({ p: fix, slot: { kind: "fix" }, ...o.labels.fix });
    else if (o.shortfall && pool.length) {
      const short = o.shortfall;
      const closest = pool.reduce((a, p) => {
        const d = short(p) - short(a);
        return d < 0 || (d === 0 && objective(goal, p) < objective(goal, a)) ? p : a;
      });
      cards.push({ p: closest, slot: { kind: "closest" }, ...(o.labels.closest ?? o.labels.fix) });
      fixMisses = true;
    }
  }
  if (o.hasCurrent) {
    const taken = chosen();
    const small = best(
      pool.filter((p) => o.changeCount(p) <= 1 && differs(p, taken) && meets(p) && beatsAll(p)),
      goal,
    );
    if (small)
      cards.push({
        p: small,
        slot: { kind: "smallest" },
        label: "Smallest change",
        why: "Changes one thing from your design.",
      });
  }
  for (const g of o.altAxes) {
    if (cards.length >= max) break;
    const taken = chosen();
    const q = best(
      pool.filter(
        (p) =>
          differs(p, taken) &&
          (!o.altFilter || o.altFilter(g, p)) &&
          beatsCurrent(g, p) &&
          (!first || beats(g, p, first)),
      ),
      g,
    );
    if (q) cards.push({ p: q, slot: { kind: "alt", axis: g }, ...o.labels.alt(g) });
  }
  return { cards, goalMissing: !first && !o.currentFails, fixMisses };
}
