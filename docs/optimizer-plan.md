# Optimizer: proposal

Goal: in the planner, set limits (price, weight, amp power, box dimensions) and get the best
configuration, plus two competitive alternatives, in about a second, without leaving the page.

## Inputs (a new "Optimize" panel)

| Limit | Applies to |
|---|---|
| Max price, drivers per stack (or per pair) | sub + mid + compression driver + horn |
| Max loaded weight per box | sub box, mid box (default 125 lb) |
| Amp power per channel | sub, mid, HF (fixed inputs, not searched) |
| Max W × H × D | sub box, mid box (and optional exact values to lock a dimension) |
| Goal | **Deep** (lowest F3 at a target SPL), **Loud** (most music-limit SPL at 40 Hz), **Balanced** (default: weighted), **Light** (least weight that meets a target SPL) |
| Optional locks | keep the current sub/mid/horn, layout, wall ply, vent style |

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
