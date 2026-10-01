# Optimizer: proposal

Goal: in the planner, set limits (price, weight, amp power, box dimensions) and get the best
configuration, plus two competitive alternatives, in about a second, without leaving the page.

## Inputs (a new "Optimize" panel)

| Limit                                      | Applies to                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Max price, drivers per stack (or per pair) | sub + mid + compression driver + horn                                                                                                                              |
| Max loaded weight per box                  | sub box, mid box (default 125 lb)                                                                                                                                  |
| Amp power per channel                      | sub, mid, HF (fixed inputs, not searched)                                                                                                                          |
| Max W × H × D                              | sub box, mid box (and optional exact values to lock a dimension)                                                                                                   |
| Goal                                       | **Deep** (lowest F3 at a target SPL), **Loud** (most music-limit SPL at 40 Hz), **Balanced** (default: weighted), **Light** (least weight that meets a target SPL) |
| Optional locks                             | keep the current sub/mid/horn, layout, wall ply, vent style                                                                                                        |

## Output

Three result cards, each a complete config: drivers, box sizes, vent, tuning, highpass, crossovers.
Each card shows the planner's own numbers (Fb, F3, max SPL at 35/45 Hz, first limit, weight, price)
and has a **Load** button that applies it through the existing `restore()`, so the whole page (3D view,
chips, cutlist) updates. The three are chosen to be different: the best by the goal, then the best
Pareto alternatives with a different driver or vent style (e.g. "2 dB less, 25 lb lighter, $180 cheaper").

## Why it can be fast

Measured today (Node, one core): `boxModel` 360 µs (420 frequency points), `closedBox` 220 µs,
`cutParts` 4 µs, the whole `subSystem` ~1.1 ms. A naive grid over 21 subs × box sizes × 4 vent styles ×
slot/tube sizes × lengths × highpass is ~10⁷ points: hours. The plan cuts that by 10⁴:

1. **Split the problem.** Sub, mid and HF only couple through the crossovers ("keeps up" gaps), total
   price and total weight. Optimize each band on its own, keep its top ~15, then combine
   (15 × 15 × 15 = 3 375 cheap checks) against the joint limits.
2. **Solve the vent instead of searching it.** For a box, vent style and target Fb, the duct length
   follows from Helmholtz with our end correction; the vent area follows from the port-speed limit at
   the power the driver can take. So the vent collapses to a 1-D search over Fb (about 8 values),
   and "Duct too long" rules prune impossible ones up front.
3. **Search volume, not dimensions.** Net volume drives the response; shape only matters for fit,
   weight and the letterbox width. Search ~12 volumes × 3 shapes inside the max dimensions.
4. **A fast screening model.** A specialised `boxModel` with plain real arithmetic (no complex-number
   objects) at ~32 frequencies from 15 to 150 Hz, returning only what the score needs (SPL, excursion,
   port speed): target ~5 µs per candidate instead of 360 µs. Internal wood from a closed-form
   estimate per vent style instead of building the cutlist.
5. **Prune early.** Drop drivers over the budget or weight before modelling; drop a (driver, volume)
   branch when its best tuning is already worse than the current 15th place (branch and bound).
6. **Refine with the real model.** Take the top ~40 screened candidates, run a short local search
   (coordinate descent on volume, Fb, highpass) using the planner's own `subSystem`, and report those
   numbers, so a loaded result shows exactly what the card said.
7. **Off the main thread.** Run in a Web Worker (`calc.js` is pure, so esbuild bundles it into the worker
   as a second entry). Results stream in as they improve; the page stays responsive; a new run cancels
   the old one.

Rough budget: sub screening ~20k candidates × 5 µs ≈ 0.1 s; mid (36 drivers × 10 volumes × 6 crossovers,
sealed, cheap) ≈ 0.05 s; horns (8 × 9 pairs) trivial; refinement 3 bands × 40 × ~1 ms ≈ 0.15 s. Target:
**under 1 s on a laptop, under 3 s on a phone.**

## Scoring

- Hard limits: every input limit, plus the planner's "bad" chips (driver won't fit, duct too long).
- Goal score, from the same numbers the planner shows (music limit, per-frequency max SPL, F3).
- Soft penalties, from the existing chip thresholds: Qtc outside 0.5–0.8, mid runs out first, horn
  runs out first, mid/horn beamwidth mismatch at the crossover, port-limited, over 125 lb.
- Everything comes from `calc.js` and `chips.js`, so the optimizer can't disagree with the page.

## Code layout

- `tools/optimize.js`: pure search (screening model, vent solver, per-band search, combiner, refinement).
- `tools/optimize.worker.js`: thin wrapper; `build.sh` bundles and inlines it (the page stays one file).
- UI: an "Optimize" section in the planner (desktop: above the controls; phones: a fifth sheet tab).

## Tests

- The screening model matches `boxModel` within 0.3 dB and 1 % Fb over the driver table.
- The vent solver: Fb of the solved vent equals the target (via `boxModel`) within 0.5 %.
- Every returned config meets every limit when re-evaluated with `subSystem`/`midSystem`/`chipsOf`.
- On a small space, results match an exhaustive brute force (optimality check).
- A timing test in CI: a standard run finishes under a budget (e.g. 2 s in Node).

## Order of work

1. Fast screening model + vent solver, with tests.
2. Sub search + refinement (Node, CLI output to check against current configs).
3. Mid and HF searches, combiner, joint limits.
4. Worker and UI cards.
5. Timing and optimality tests in CI.

## Revisions after review (supersede the sections above where they conflict)

Two reviews: technical (search soundness, speed) and usability (inputs, results, flow).

### Usability

- **Start from what I have.** Pre-fill every input from the current config, the README constraints
  (125 lb, driver budgets, US vendors) and the current amp settings (shown read-only). Default action:
  "Find better than my current design".
- **Visible inputs, four:** room (500 / 750 / 1000 sq ft, outdoor), max lb per box, budget (per stack or
  for the pair, stated), goal. Everything else under **Advanced** (max W×H×D, locks, vent style, ply,
  layout, excluded drivers, drivers I already own).
- **Goals as outcomes, with a number:** "Match my current output, cheapest", "…lightest",
  "Go as low as possible", "Loudest". The target is shown, e.g. "clean 118 dB at 45 Hz per stack (music
  limit)", derived from the room size. Scores use `spl30/35/45` (add `spl40`) and say music or sine.
- **Cards labelled by trade-off, not rank.** Each shows deltas vs the current design (price, heaviest box,
  F3, max SPL at 45 Hz, first limit), why it won, what limits it, the spec at a glance, its warning chips,
  a buildability line ("duct 14″ fits; 2 sheets 3/4″ birch"), "modelled, not measured" and price dates.
  Cards 2 and 3 must differ in driver or vent style.
- **Never an empty result.** If nothing fits, re-run with each limit relaxed 10–20 % and say which one
  unlocks results ("nothing under 125 lb reaches it; 140 lb or +$60 would").
- **Preview, Load, Undo, Save as.** Load snapshots the current design first (persistent Undo); results are
  full snapshots so `restore()` leaves nothing stale; Save as uses the saved-configs store.
- **Buildable, boring results.** Must pass every "bad" chip and the cutlist (no oversize parts); round to
  1/8″, standard tube diameters, 10–15 % port-speed margin, Qtc 0.5–0.8 hard for cards.
- **Phones:** an "Optimize" button opens a full-screen sheet (not a fifth tab); four inputs stacked,
  Advanced collapsed; cards stacked one at a time; Load/Undo pinned. Show a spinner, then all three cards
  once (no reshuffling list).

### Technical

- **Bands are coupled, so no per-band top-K by a single score.** The mid must keep up with the sub's music
  limit at xoLo, the horn with the mid at xoHi; price and weight are shared (a knapsack); the tower layout
  ties mid to sub dimensions. Search xoLo and xoHi explicitly (6–8 values each), keep a Pareto front per
  band over (quality, price, weight) indexed by crossover, then chain sub[xoLo] → mid[xoLo, xoHi] →
  HF[xoHi]. A sub is scored by what the best affordable mid can match, not by raw output.
- **The vent is a 1-D root find, not closed form.** Length sets Leff, the back-wall term of the end
  correction, the duct volume and the internal wood, so solve length for the target Fb by bisection
  (3–5 steps; Fb falls with length). Area isn't free: slot or throat size is the variable, width/height
  come from the box. Pick the smallest vent that keeps the port from being the binding limit, within
  the fit rules, which the optimizer imports from `chips.js` rather than re-implementing.
  `duct2DEndCorr` (55–170 µs) gets a cached L = ∞ sum per (h, X) plus the short back-wall correction.
- **No second physics model.** Instead of a separate screening model: `boxModel` gets an optional coarser
  grid (a subset of the same 12–300 Hz points, peaks refined by a parabola), used only to rank; final
  numbers always come from the full `subSystem`/`midSystem`. Tests check ranking agreement (top-K recall)
  against the full model, not a dB tolerance, and that closed-form internal wood equals the cutlist.
- **Search (volume, aspect)** with ~5 aspects: shape sets slot width/side-duct height, end corrections and
  weight, not only fit.
- **Valid pruning only:** upper bound on SPL per driver (mass-line level at the thermal/amp cap), lower
  bounds on price and weight, driver-fit by max dimensions. Budget: 0.5–1 s laptop, stream on phones.
- **Hard constraints added:** horn/driver exit match, mid "driver won't fit", minimum crossovers,
  stack height and width; which "warn" chips are hard is listed explicitly.
- **Worker:** second esbuild entry, inlined as `<script type="text/plain">` (same `</script` guard), started
  from a Blob URL with a run id for cancellation; main-thread fallback where workers are blocked (test in
  the claude.ai artifact).
- **Test:** a loaded result reproduces its card's numbers exactly.

### Scope: first version

Sub + mid jointly with xoLo (the horn follows from xoHi and is cheap to enumerate), pre-filled inputs,
three cards with deltas, Preview/Load/Undo/Save as, near-miss message, worker. Later: Pareto chain over
both crossovers, locks, owned/excluded drivers, outdoor target, "explain" view of rejected options.

## Status (first version, branch `optimizer`)

Built: the Optimizer switch; lock icons on drivers, vent style, plywood, highpass, crossovers and the three amp powers (an unlocked amp is searched up to its slider maximum, then comes back at the least power that keeps the card's output and keeps each band up);
unlocked / ≤ / = on each box dimension; room, weight, budget and goal inputs; three cards (the
goal's winner, then alternatives that beat it on their own axis by any saving, or at least 3 lb, 1 dB or 2 Hz);
Preview, Load (saves the previous design when signed in), Undo, Save as; the "nothing fits" message.

Changes from the plan: output is scored as the lowest clean music-limit level from 40 to 90 Hz (a response
peak at 45 Hz could otherwise win); the layout, finish and amps are never changed; box dimensions step in
whole inches; about 1 s in Node, 1–4 s in the page.

### Stacked goals (branch `stack-goals`)

Goals start unselected on every load (the search waits for one); tap to select, tap again to deselect.
Tap more than one goal; the tap order shows on the buttons (1 · Cheaper, 2 · Lighter). The first goal ranks the
designs; the main card ("Cheaper + lighter") must also beat your design on every other goal. The other cards
are single-goal options, to show what dropping a goal buys. If nothing beats your design on all of them, the
panel says so. "Clear all locks" resets every lock and box-size limit; "Lock all" locks everything (box sizes exact) so you can unlock just the one or two things to change.
Cards show a to-scale front view (your design's outline dashed behind it) and the sub's clean output from
20 to 200 Hz against yours, with the scored 40–90 Hz band shaded; hover or drag to read values.
