# Calculation audit

Findings from the independent audit and the plan review (Sep 2026).
Status: **open** until fixed with a test that would have caught it.

## Bugs and errors (fix with a test)

| # | Where (tools/stack-planner.app.jsx) | Problem | Size | Fix |
|---|---|---|---|---|
| 1 | `closedBox` ref, ~l.445 | "Midband" reference averaged over 200–500 Hz, where low-Qtc boxes are still rising | 12NDL76 at 45 L: Box F3 154 vs 214 Hz, sensitivity 1.8 dB low; 12FW76: 174 vs 285 Hz. Misses "rolls off above the crossover" | Reference to the high-frequency asymptote (analytic), or closed-form F3 from Fc/Qtc |
| 2 | `boxModel` end correction, ~l.376 | End correction from total port area; n tubes / 2 side ducts get √n too much | 2×6″: Fb −1.4 Hz (−4.8 %); 4×4″: −2.2 Hz (−8.3 %) | Pass port count n; `1.46·√(Sp/(n·π))`. Letterbox on the floor may need *more* correction (Fb up to ~6 % high): calibrate |
| 3 | `FillsPage` sens/f3, ~l.1476–1480 | Vented `ref`/`f3` taken after the LR24 highpass; sealed path ignores it | sens −1.2 dB at hp 70, −3.8 dB at hp 100; f3 82.5 vs 62.1 Hz. Feeds HF pad and "HF limits first", "Some kick" | Compute ref/f3 from unfiltered response in both paths |
| 4 | `netL`, ~l.1932 | Duct wood not subtracted (shelf + fins ~5–6 L letterbox; side-duct walls ~7 L each) | net volume high by up to ~5 % | Subtract internal part volumes from the cutlist |
| 5 | `boxModel` radiated sum, ~l.388 | Leakage flow included in radiated volume velocity | +0.35 dB at 20 Hz, 0 above 50 Hz | `Ut = Ud·Zbox/Zc` |
| 6 | `boxModel` port loss, ~l.385 | 0.3 acoustic Ω ≈ lossless (Qp ~12 000) | with Qp 50: −0.2 dB at Fb, excursion at Fb +11 % | `Rp = ωb·Map/Qp`, Qp ≈ 50–100 |
| 7 | `peakX`/`peakVel` window, ~l.402 | Limits searched only 20–90 Hz | first limit can be wrong at low hpf / BW24 | search the whole curve |
| 8 | `maxAt`, ~l.1952 | Per-frequency sine allowed to 2×AES | 3 dB optimistic for sines | decide and document (sine vs music); test it |
| 9 | FillsPage walls | Volume with 3/4″ walls, weight with 1/2″ | net ~10 % off | one wall thickness |
| 10 | slot port area | Fin thickness uses wall ply (comment says 3/4″ fins) | small | decide fin thickness |
| 11 | Keele constant | 25 000 used; 1e6 in·°·Hz = 25 400 m·°·Hz | 1.6 % | use 25 400 |
| 12 | `PLY_LB[wall]` | NaN for other thicknesses | — | guard |

## Clean-ups

- Dead code in `const port` after the braced block (~l.1905–1929).
- `model/vented-box.js` and `tools/vented-sub-bench.html` hold copies of `boxModel`: re-export from `calc.js` or delete.
- Stale `mStuff` field in saved configs.

## Documented assumptions (keep, but label and test)

- Leakage QL = 7; stuffing ×1.15; default displacement 4 L (15″) / 2.5 L (12″); netL floor 20 L; fixed 3 L bracing.
- Thermal limit √(2·AES·8) assumes 8 Ω nominal.
- Horn sensitivity is on the maker's reference horn; derate 6 dB/oct below aesXo is a rule of thumb.
- Piston and Keele beamwidths are rules of thumb.
- Weights don't subtract corner overlaps or cut-outs (few % high).

## Driver data mismatches (> 10 %)

| Driver | Mismatch | Effect |
|---|---|---|
| B&C 18PS100 | Vas 245 L listed vs 283 L from Mms/Sd/Fs | none (model uses Mms) |
| 18Sound 12NLW9300 | Qes 0.45 listed vs 0.394 derived | Qtc reads ~12 % low |
| Lavoce WAF123.01 | Vas 42 L vs 37.3 L | none |
| B&C 10NW64 | Vas 27.5 L vs 30.6 L | none |

## Confirmed correct

Filters (BW/LR shapes, LR24 sum = 1 at xo); boxModel circuit (independent mechanical model within 0.01 dB); Fb = Helmholtz; tiny port → closedBox (0.07 dB); closedBox Fc/Qtc exact; boxL; limit scaling and thermal rule; horn power, derate, roll-off; piston −6 dB at ka·sinθ = 2.2; fills hfLimW; cutlist panel sizes and packing; weight arithmetic.
