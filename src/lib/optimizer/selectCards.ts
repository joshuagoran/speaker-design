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
  /** with nothing passing `meets`, the fix is the goal's best design anyway */
  fixFallback?: boolean;
  labels: { first: CardRole; fix: CardRole; alt: (g: G) => CardRole };
  /** 3 when absent */
  maxCards?: number;
}

export interface SelectedCard<P> extends CardRole {
  p: P;
}

/**
 * The cards, in order: (1) the best design on the goal that keeps what the goals keep and beats your design on every
 * goal, or, when there is none and your design fails a check, the best design that passes, as a fix; (2) the smallest
 * change (at most one thing) that does the same; (3) one alternative per axis, each beating your design and the first
 * card on its own axis, until the cards run out. `goalMissing` is set when no design beats yours and yours passes.
 */
export function selectCards<P, G extends string>(
  o: SelectCardsOptions<P, G>,
): { cards: SelectedCard<P>[]; goalMissing: boolean } {
  const { pool, goal, goals, objective, beatsCurrent, beats, meets, differs, tieBreak } = o;
  const max = o.maxCards ?? 3;
  const best = (list: readonly P[], g: G): P | undefined =>
    list.slice().sort((a, b) => {
      const d = objective(g, a) - objective(g, b);
      return tieBreak ? d || tieBreak(a, b) : d;
    })[0];
  const beatsAll = (p: P) => goals.every((g) => beatsCurrent(g, p));
  const cards: SelectedCard<P>[] = [];
  const chosen = () => cards.map((k) => k.p);
  const first = best(
    pool.filter((p) => meets(p) && beatsAll(p)),
    goal,
  );
  if (first) cards.push({ p: first, ...o.labels.first });
  else if (o.currentFails) {
    const fix = best(pool.filter(meets), goal) ?? (o.fixFallback ? best(pool, goal) : undefined);
    if (fix) cards.push({ p: fix, ...o.labels.fix });
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
    if (q) cards.push({ p: q, ...o.labels.alt(g) });
  }
  return { cards, goalMissing: !first && !o.currentFails };
}
