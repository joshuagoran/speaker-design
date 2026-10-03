import { test } from "vite-plus/test";
import assert from "node:assert";
import { selectCards, type SelectCardsOptions } from "../src/lib/optimizer/selectCards";

// a synthetic pool: designs with a price, a weight, a level, a change count and a family (same family = same design)
interface D {
  id: string;
  price: number;
  lb: number;
  level: number;
  ch: number;
  fam: string;
}
type G = "cheaper" | "lighter" | "louder";
const cur = { price: 100, lb: 20, level: 90 };
const d = (id: string, price: number, lb: number, level: number, ch = 3, fam = id): D => ({
  id,
  price,
  lb,
  level,
  ch,
  fam,
});
const obj: Record<G, (p: D) => number> = {
  cheaper: (p) => p.price,
  lighter: (p) => p.lb,
  louder: (p) => -p.level,
};
const beats: Record<G, (a: Pick<D, "price" | "lb" | "level">, b: typeof a) => boolean> = {
  cheaper: (a, b) => a.price < b.price,
  lighter: (a, b) => a.lb <= b.lb - 1,
  louder: (a, b) => a.level >= b.level + 1,
};
const opts = (pool: D[], o: Partial<SelectCardsOptions<D, G>> = {}): SelectCardsOptions<D, G> => ({
  pool,
  goal: "cheaper",
  goals: ["cheaper"],
  objective: (g, p) => obj[g](p),
  beatsCurrent: (g, p) => beats[g](p, cur),
  beats: (g, a, b) => beats[g](a, b),
  meets: (p) => p.level >= cur.level - 1,
  differs: (p, chosen) => chosen.every((k) => k.fam !== p.fam),
  changeCount: (p) => p.ch,
  currentFails: false,
  hasCurrent: true,
  altAxes: ["lighter", "louder"],
  labels: {
    first: { label: "First", why: "first" },
    fix: { label: "Fixes your design", why: "fix" },
    alt: (g) => ({ label: `alt ${g}`, why: g }),
  },
  ...o,
});
const ids = (r: ReturnType<typeof selectCards<D, G>>) => r.cards.map((k) => `${k.label}:${k.p.id}`);

test("selectCards: the first card is the goal's best that keeps the level and beats your design", () => {
  const pool = [
    d("a", 90, 20, 90),
    d("b", 70, 20, 80), // cheapest, but loses the level
    d("c", 80, 20, 90),
    d("e", 120, 20, 95), // keeps the level but costs more
  ];
  const r = selectCards(opts(pool, { altAxes: [] }));
  assert.deepEqual(ids(r), ["First:c"]);
  assert.equal(r.goalMissing, false);
  assert.equal(r.cards[0].why, "first");
});

test("selectCards: stacked goals need a design that beats your design on every goal", () => {
  const pool = [d("a", 80, 20, 90), d("b", 90, 18, 90)];
  const r = selectCards(opts(pool, { goals: ["cheaper", "lighter"], altAxes: [] }));
  assert.deepEqual(ids(r), ["First:b"]);
});

test("selectCards: nothing beats a passing design: no first card and goalMissing", () => {
  const pool = [d("a", 120, 25, 90)];
  const r = selectCards(opts(pool));
  assert.deepEqual(r.cards, []);
  assert.equal(r.goalMissing, true);
});

test("selectCards: a failing design gets the best design that passes as a fix, with the fallback only when asked", () => {
  const passes = [d("a", 130, 25, 90), d("b", 120, 25, 90)];
  const r = selectCards(opts(passes, { currentFails: true, altAxes: [] }));
  assert.deepEqual(ids(r), ["Fixes your design:b"]);
  assert.equal(r.goalMissing, false);
  // nothing keeps the level: no fix, unless the fallback takes the goal's best anyway
  const loses = [d("a", 130, 25, 50), d("b", 120, 25, 50)];
  assert.deepEqual(ids(selectCards(opts(loses, { currentFails: true, altAxes: [] }))), []);
  assert.deepEqual(
    ids(selectCards(opts(loses, { currentFails: true, altAxes: [], fixFallback: true }))),
    ["Fixes your design:b"],
  );
});

test("selectCards: the smallest change changes at most one thing, differs from the first card and needs a current design", () => {
  const pool = [
    d("a", 80, 20, 90, 3), // first
    d("a2", 85, 20, 90, 1, "a"), // one change, but the same design as the first card
    d("b", 95, 20, 90, 1), // one change
    d("c", 90, 20, 90, 2), // cheaper, two changes
  ];
  const r = selectCards(opts(pool, { altAxes: [] }));
  assert.deepEqual(ids(r), ["First:a", "Smallest change:b"]);
  assert.equal(r.cards[1].why, "Changes one thing from your design.");
  assert.deepEqual(ids(selectCards(opts(pool, { altAxes: [], hasCurrent: false }))), ["First:a"]);
});

test("selectCards: alternatives follow the axes' order, beat your design and the first card on their axis, and pass the filter", () => {
  const pool = [
    d("a", 80, 19, 91), // first
    d("l", 95, 15, 90), // lighter
    d("l2", 99, 18.5, 90), // lighter than you, not 1 lb lighter than the first card
    d("v", 98, 20, 96), // louder
    d("v2", 99, 20, 99), // loudest, filtered out below
  ];
  assert.deepEqual(ids(selectCards(opts(pool))), ["First:a", "alt lighter:l", "alt louder:v2"]);
  assert.deepEqual(ids(selectCards(opts(pool, { altAxes: ["louder", "lighter"] }))), [
    "First:a",
    "alt louder:v2",
    "alt lighter:l",
  ]);
  const r = selectCards(opts(pool, { altFilter: (g, p) => g !== "louder" || p.level < 98 }));
  assert.deepEqual(ids(r), ["First:a", "alt lighter:l", "alt louder:v"]);
  assert.equal(r.cards[2].why, "louder");
});

test("selectCards: an alternative must differ from every card so far", () => {
  const pool = [d("a", 80, 19, 91), d("l", 95, 15, 96, 3, "x"), d("v", 98, 20, 95, 3, "x")];
  // l is both the lightest and the loudest; v is the same design, so it can't be the louder card
  assert.deepEqual(ids(selectCards(opts(pool))), ["First:a", "alt lighter:l"]);
});

test("selectCards: maxCards caps the alternatives", () => {
  const pool = [d("a", 80, 19, 91), d("l", 95, 15, 90), d("v", 98, 20, 96)];
  assert.deepEqual(ids(selectCards(opts(pool, { maxCards: 2 }))), ["First:a", "alt lighter:l"]);
  assert.equal(selectCards(opts(pool)).cards.length, 3);
});

test("selectCards: ties keep the pool's order unless a tie-break is given", () => {
  const pool = [d("x", 80, 19, 91), d("y", 80, 18, 91)];
  assert.deepEqual(ids(selectCards(opts(pool, { altAxes: [] }))), ["First:x"]);
  const r = selectCards(opts(pool, { altAxes: [], tieBreak: (a, b) => a.lb - b.lb }));
  assert.deepEqual(ids(r), ["First:y"]);
});

test("selectCards: an alternative that beats only your design, or only the first card, on its axis is skipped", () => {
  // x is the lightest after the first card and lighter than you, but not 1 lb lighter than the first card
  const notFirst = [d("a", 80, 19, 91), d("x", 99, 18.5, 90)];
  assert.deepEqual(ids(selectCards(opts(notFirst, { altAxes: ["lighter"] }))), ["First:a"]);
  // y is louder than the (quieter) first card but not 1 dB louder than your design
  const notYou = [d("a", 80, 19, 89.5), d("y", 99, 20, 90.6)];
  assert.deepEqual(ids(selectCards(opts(notYou, { altAxes: ["louder"] }))), ["First:a"]);
});
