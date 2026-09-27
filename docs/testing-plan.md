# Test plan for the planner's calculations

Goal: every number the planner shows comes from a tested, pure function, and
each function has been checked against an independent reference (a textbook
formula, a closed-form limit, or a manufacturer's published figure).

## 1. Make the calculations testable

Most maths lives inside `StackPlanner()` in `tools/stack-planner.app.jsx`.
Move it into a plain module that both the page and the tests import.

- New file `tools/calc.js` (ES module, no React):
  - primitives: `hpGain`, `lr24lp`, `lr24hp`, complex helpers
  - `boxModel`, `closedBox`
  - geometry: `inToL`, `boxL`, `portGeom(portStyle, box, cVent, wall)`, `netVolume`
  - limits: `subLimits(mdl, ts, ampW, portMax)` (today's `lim`), `subMaxCurve` (`maxAt`),
    `midMaxCurve` (`midMaxAt`), `subMusicAtXo`
  - horn: `hornModel(cd, horn, xoHi, hfAmpW)`, `pistonBeam(Sd, f)`, `hornBeam(horn, f)` (Keele)
  - weights: `subWeight`, `midWeight` (with `PLY_LB`)
  - fills: `fillHfLimit` (today's `hfLimW`)
  - cutlist: `boxParts`, `cutParts`, `packSheets`, `f8`
- Build: add `--bundle` to the esbuild call in `tools/build.sh` so the page imports
  `calc.js` (React/three stay globals). Output stays one HTML file.
- Driver/horn/cabinet tables move to `tools/data.js` so tests can iterate them.
- No behaviour change in this step: the page must render the same numbers.
  Check by loading each config in `data/configs-seed.json` before and after and
  diffing the rendered stat rows (Playwright script, run once).

## 2. Test runner

- `node --test tests/` (built in, no dependencies). `npm test` wrapper via a tiny
  `package.json` with `"type": "module"`.
- CI: add a `test` job to `.github/workflows/pages.yml` that runs before deploy;
  a failing test blocks the Pages deploy.
- Tolerances written per test (e.g. ±0.1 dB, ±1 %), never exact float equality.

## 3. Tests and the independent check for each

| Area | Tests | Independent reference ("double check") |
|---|---|---|
| Filters | BW24 −3.01 dB at fc; LR24/LR48 −6.02 dB at fc; asymptotic slope 24/48 dB/oct one decade out; LR24 LP+HP magnitudes each −6 dB at fc | Butterworth/Linkwitz–Riley definitions |
| Sealed box `closedBox` | Fc = Fs·√(1+Vas/Vb); Qtc = Qts·√(1+Vas/Vb) (with the model's Qes/Qms); F3 of a 2nd-order highpass for Qtc 0.5/0.707/1.0; excursion at 20 Hz tends to V·Bl/(Re·k) stiffness limit; √2 peak factor | Small's closed-box equations |
| Vented box `boxModel` | Fb equals Helmholtz with the 1.46·r end correction; midband SPL at 1 W into Re equals 112.2 + 10·log10(η0), η0 = 4π²·Fs³·Vas/(c³·Qes) (half space); excursion minimum near Fb; port velocity peak near Fb; with a tiny port it converges to `closedBox`; highpass multiplies SPL, excursion and velocity equally | Small's vented-box theory; reference efficiency formula; alignment check against a textbook QB3/SBB4 example |
| Two implementations | `model/vented-box.js` and planner `boxModel` give the same Fb/SPL/excursion for the same box (±0.1 dB) | cross-implementation |
| Published designs | Model vs maker's recommended enclosure for 2–3 drivers (e.g. 18Sound 18LW2420 app note, Ciare 18.00SW reflex, B&C 15FW76 80 L / 50 Hz): tuning within 1 Hz, response shape within ~1.5 dB above Fb | manufacturer data |
| Limits | first limit is the smallest of port/Xmax/thermal/amp voltage; thermal V = √(2·AES·8); per-frequency max never exceeds the broadband amp-limited curve; scaling a curve by amp voltage shifts it by 20·log | definition |
| Horn | P = min(amp into Z, 2·AES·derate); derate = (xo/aesXo)² below aesXo; SPL = sens + 10·log P; LR24 −6 dB at xo; −12 dB/oct below lowHz | datasheet method as documented in README |
| Beamwidth | piston −6 dB where ka·sinθ ≈ 2.2 (compare to exact 2·J1(x)/x = 0.5 at x ≈ 2.215); Keele f = 25 000/(W·θ) gives ~540 Hz for 460 mm / 100° | Bessel piston directivity; Keele (1975) |
| Geometry | `boxL` for 3/4″ and 1/2″ walls and 0–1.5″ inset against hand calcs; port area per style (letterbox fins, side ducts with dividers, round tubes); net volume subtracts driver, duct, bracing | hand calculation |
| Weights | panel areas × PLY_LB + driver + hardware for a known box | hand calculation |
| Fills | HF limit through the pad: 2·AES·(Z/8)·10^(pad/10) | definition |
| Cutlist | for each joint, panels reassemble to the outer W×H×D; back = (W−t)×(H−t); baffle = inner opening minus slot band; packing: no overlaps, every part inside the sheet, kerf respected, oversize parts reported, sheet count ≥ total area / sheet area; `f8` rounds to 1/16 | geometry invariants |
| Driver data | every entry has the fields the model needs; Qts ≈ Qes·Qms/(Qes+Qms) (±3 %); Qes from Bl, Mms, Re, Fs within ±10 %; Vas from Mms, Sd, Fs within ±15 %; mismatches listed in a known-exceptions file with a note, not silently ignored | Thiele–Small identities |
| Regression | each seed config: net volume, Fb, max SPL at 35/45/60 Hz, first limit, mid max at XO, horn gap, weights stored in `tests/golden.json`; any change needs an intentional update | snapshot |

## 4. Double-checking while writing the tests

- Write each expected value from the reference formula in the test itself, not by
  copying the function's output.
- When a test fails, decide whether the code or the reference is wrong; record the
  decision in `docs/calc-audit.md` (what, why, fix).
- Known suspects to look at first:
  - `boxModel` leakage `Ral = 7/(2π·Fb·Cab)` (QL 7) and port loss `0.3` — document or justify
  - band average used for `ref` (80–200 Hz) vs sensitivity row maths
  - `netL` subtracts a fixed 3 L bracing; the cutlist now knows the braces
  - folded-duct cutlist lengths are approximate
  - horn model ignores the horn's own gain (sensitivity is on the maker's reference horn)
  - Keele constant and piston model are rules of thumb (label them in the UI)

## 5. Verification by two subagents

1. **Plan reviewer**: reads this plan and the code, lists calculations the plan
   misses, weak references, and tests that would pass with wrong code.
2. **Calculation auditor**: independently re-derives and numerically checks the
   formulas in the code (without running this plan's tests), reports errors or
   questionable assumptions with file:line.

Their findings are folded into this plan before implementation starts.

## 6. Order of work

1. Extract `calc.js` / `data.js`, rebuild, confirm identical output.
2. Primitives, sealed, vented, limits tests.
3. Horn, beamwidth, geometry, weights, fills.
4. Cutlist and packing.
5. Driver-data consistency and golden regression.
6. CI job.
