# Calculation audit

Findings from the independent audit and the plan review (Sep 2026).
Status: **open** until fixed with a test that would have caught it. Fixed items name their test.

## Bugs and errors (fix with a test)

| # | Where (tools/stack-planner.app.jsx) | Problem | Size | Fix |
|---|---|---|---|---|
| 1 | `closedBox` ref, ~l.445 | "Midband" reference averaged over 200–500 Hz, where low-Qtc boxes are still rising | 12NDL76 at 45 L: Box F3 154 vs 214 Hz, sensitivity 1.8 dB low; 12FW76: 174 vs 285 Hz. Misses "rolls off above the crossover" | Reference to the high-frequency asymptote (analytic), or closed-form F3 from Fc/Qtc — **fixed** (tests/sealed.test.js: F3 vs 2nd-order, ref vs mass line) |
| 2 | `boxModel` end correction, ~l.376 | End correction from total port area; n tubes / 2 side ducts get √n too much | 2×6″: Fb −1.4 Hz (−4.8 %); 4×4″: −2.2 Hz (−8.3 %) | Pass port count n; `1.46·√(Sp/(n·π))`. Letterbox on the floor may need *more* correction (Fb up to ~6 % high): calibrate — **fixed** for round tubes and side ducts (tests/vented.test.js); letterbox **fixed**: rigid-piston end correction of the rectangular mouth (closed form, checked by numerical integration) with the floor as a mirror at both ends (tests/slot.test.js); slot configs read ~1.5 Hz (4 %) lower |
| 3 | `FillsPage` sens/f3, ~l.1476–1480 | Vented `ref`/`f3` taken after the LR24 highpass; sealed path ignores it | sens −1.2 dB at hp 70, −3.8 dB at hp 100; f3 82.5 vs 62.1 Hz. Feeds HF pad and "HF limits first", "Some kick" | Compute ref/f3 from unfiltered response in both paths — **fixed**: sensitivity from the unfiltered asymptote, f3 includes the highpass for both box types |
| 4 | `netL`, ~l.1932 | Duct wood not subtracted (shelf + fins ~5–6 L letterbox; side-duct walls ~7 L each) | net volume high by up to ~5 % | Subtract internal part volumes from the cutlist — **fixed**: net volume subtracts internal wood from the cutlist parts (tests/geometry.test.js) |
| 5 | `boxModel` radiated sum, ~l.388 | Leakage flow included in radiated volume velocity | +0.35 dB at 20 Hz, 0 above 50 Hz | `Ut = Ud·Zbox/Zc` — **fixed** (tests/vented.test.js tiny-port and B4) |
| 6 | `boxModel` port loss, ~l.385 | 0.3 acoustic Ω ≈ lossless (Qp ~12 000) | with Qp 50: −0.2 dB at Fb, excursion at Fb +11 % | `Rp = ωb·Map/Qp`, Qp ≈ 50–100 — **fixed**: Qp 50 default, optional arg |
| 7 | `peakX`/`peakVel` window, ~l.402 | Limits searched only 20–90 Hz | first limit can be wrong at low hpf / BW24 | search the whole curve — **fixed** (tests/limits.test.js) |
| 8 | `maxAt`, ~l.1952 | Per-frequency sine allowed to 2×AES | 3 dB optimistic for sines | decide and document (sine vs music); test it — open: kept (program rating); documented |
| 9 | FillsPage walls | Volume with 3/4″ walls, weight with 1/2″ | net ~10 % off | one wall thickness — **fixed**: fills volume uses 1/2″ walls |
| 10 | slot port area | Fin thickness uses wall ply (comment says 3/4″ fins) | small | decide fin thickness — decided: fins use the wall ply, as the cutlist does |
| 11 | Keele constant | 25 000 used; 1e6 in·°·Hz = 25 400 m·°·Hz | 1.6 % | use 25 400 — **fixed**: 25 400 (tests/horn.test.js) |
| 12 | `PLY_LB[wall]` | NaN for other thicknesses | — | guard — **fixed**: `plyLb()` falls back to 3/4″ |

## Clean-ups

- ~~Dead code in `const port`~~ removed (now `ventGeom` in calc.js).
- `model/vented-box.js` now wraps `calc.js`. `tools/vented-sub-bench.html` still has its own old copy (standalone bench, not deployed).
- ~~Stale `mStuff` field in saved configs~~ removed from the seed file; configs already saved in Firestore keep it, and the app ignores it.
- Mid-bass (`midSystem`, `subThroughLp`) and Fills (`fillSystem`) maths moved into calc.js with tests (tests/mid.test.js, tests/fills.test.js) and golden snapshots of every fill driver, vented and sealed.
- Side ducts now use the same rectangular-mouth end correction, with the side wall mirroring the inner end only (the outer mouth is at the cabinet edge). A tall thin mouth has less correction than a circle of equal area, so side-duct Fb moved **up**: light block 37.0 → 37.9 Hz. Inner end now modelled as a piston opening into the box interior (a 2D duct: the wall the vent sits on, the opposite wall, and the back wall behind the mouth; the side walls or floor/top at the ends of the long dimension make it 2D). Outer end: the ground mirrors the side-duct mouth along its height. The fuller inner-end model lowers the inner correction (the opposite wall confines the flow) but the back wall raises it; net: letterbox configs −0.3 to −1.6 Hz, side-duct pair +0.1 Hz, single side duct −2 Hz, folded +0.8 Hz (tests/slot.test.js). The back-wall gap is clamped to at least the vent height, matching the planner's "Duct too long" check.

## Documented assumptions (keep, but label and test)

- Leakage QL = 7; stuffing ×1.15; default displacement 4 L (15″) / 2.5 L (12″); netL floor 20 L. (The fixed 3 L bracing allowance is replaced by the internal wood from the cutlist.)
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

## Found while writing the tests

- Sub weight counted 2 braces with 1/2″ walls while the cutlist has 3 (mid: 1 vs 2) — **fixed** (tests/geometry.test.js).
- Five more fill drivers have datasheet Vas/Qes that disagree with their Mms/Bl (Ciare NDCX10, FaitalPRO 8HX230/8HX240, Eminence Beta 8CX) — listed as known in tests/drivers.test.js.
- Port air speed does not always peak at Fb (with Fb above Fs it peaks near the lower impedance peak); the planner row no longer says "near Fb".
- The Fb shift from the end-correction fix: saved "lil block stack LE (optimized)" (2 × 3.5″ tubes) now reads 33.1 Hz, was 32.0.
- Slot calibration moved the saved letterbox configs: lil block stack LE 38.7 → 37.1 Hz, lil block stack 39.4 → 37.7, idk tweaked 38.6 → 36.9, idk 36.9 → 35.4, blocky 36.8 → 35.3, lil tower / compact-ish 37.6 → 36.1. Not a measurement: the image method is the textbook treatment for a vent on a boundary; an impedance sweep of the built box is still the check.
