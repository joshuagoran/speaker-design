# Hi-fi tab: plan (branch `hifi`)

A fifth tab for small home speakers. It reuses the planner's box models, charts, cutlist and optimizer, and
adds only what a home 2-way needs. Nothing on the PA tabs changes.

## Scope (v1)
- 2-way only: a 5–8″ woofer and a tweeter (dome, or a 1″ compression driver on a small waveguide).
- Crossover is active/DSP: no passive network design, but the crossover point and slope are modelled
  (LR24 by default, LR48 optional).
- Bookshelf or floorstander; sealed or vented (round port or slot).
- Optimizer in v1.

## Inputs
- Woofer, tweeter, box (W × H × D, or volume with a shape), vent, plywood/MDF thickness.
- Crossover frequency and slope; tweeter level trim.
- Amp power per channel (woofer and tweeter separately, since it's active); default 100 W / 50 W.
- Room: listening distance, placement (free-standing, near the back wall, corner), room size.

## Model
- Woofer: the planner's `boxModel` (vented) and `closedBox` (sealed) at the amp voltage, with its limits
  (cone travel, port air speed, power rating, amp), through the crossover low-pass.
- **Baffle step**: 6 dB loss below f3 ≈ 115 / baffle width (m), shown as a shelf on the chart, with an
  optional DSP compensation amount (it costs that much headroom, which the max-output curve shows).
- **Placement**: boundary gain below ~ 343 / (4 × distance to wall): +3 dB near a wall, +6 dB in a corner
  (simple shelf, not a room simulation).
- Tweeter: sensitivity and power like the horn model (derated below its rated highpass), through the
  crossover high-pass; its resonance and minimum crossover checked.
- Listening level: max output at 1 m, less 20·log(distance), plus both speakers (+3 dB in the room).

## Listening position and dispersion
- Top-down room view with the pair (spacing, toe-in) and a draggable seat; ear height and driver heights.
- Response at the seat: each driver's off-axis loss (woofer and dome as pistons, 2·J1(x)/x with
  x = ka·sin θ; a waveguide as constant coverage above its mouth's control frequency, piston-like below),
  distance loss, and the woofer/tweeter path difference from their vertical spacing, which moves the
  crossover lobe up or down (summed with phase, not just levels).
- Dispersion map: level vs horizontal angle (0–90°) and frequency, normalised to on-axis, so beaming and the
  crossover hand-off show directly; a vertical map for the lobe.
- The response chart gains an "at the seat" curve next to the on-axis one.

## Checks (chips)
- Crossover above the woofer's beaming point (dispersion narrower than the tweeter or waveguide).
- Crossover below the tweeter's minimum, or within an octave of its resonance.
- Tweeter runs out first / woofer runs out first (who limits the level).
- Qtc outside 0.5–0.8 (sealed); port air speed; cone travel; driver won't fit the baffle.
- Baffle-step compensation using more headroom than the woofer has.

## Output
- Response chart (woofer, tweeter, sum) with the hover readout; max-output chart at the seat.
- Summary tiles: F3 (in room), max clean level at the seat, weight, cost for the pair.
- 3D preview and cutlist, reusing the existing ones (one box type, no duct fins).

## Optimizer
Same engine pattern as the PA optimizer, smaller search: woofer × tweeter × volume × tuning × crossover.
Goals, stackable in priority order: **Smallest box**, **Deepest bass**, **Cheapest**, **Loudest at the seat**.
Locks on every input, box dimensions free / ≤ / =, results as cards with a front view and response chart.

## Drivers
About 16 woofers and 12 tweeters. US, Japanese and European brands (Eminence, Dayton, Fostex, B&C, Faital,
18 Sound, Beyma, SB Acoustics, Scan-Speak, Peerless). Prices from US vendors only; a driver with missing
specs is kept with the gap marked. Stored as `HIFI_WOOFERS` / `HIFI_TWEETERS` in `data.js`.

## Work order
1. Driver data.
2. Model and chips in `tools/hifi.js`, with tests (baffle step, boundary gain, crossover checks, limits).
3. Tab UI: controls, charts, tiles, chips; phone layout.
4. Listening position, dispersion map.
5. Cutlist and a front view (the PA 3D scene is built around the stack; a simple front view fits a 2-way).
6. Optimizer and cards.
7. Mobile check in CI covers the new tab.
