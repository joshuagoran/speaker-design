# Horn sub tab: plan

A future tab that models horn-loaded subs (tapped horn first, then
front-loaded) with the same outputs as the vented sub.

`horn-mock.html` is a static layout mock. **Its numbers are shaped, not
calculated** — use it for layout only. Open it in a browser (it loads
three.js from cdnjs).

## What the tab shows

- Tiles: gross volume, horn path length, tuning, max SPL at 40 and 60 Hz, weight.
- 3D cutaway of the folded cabinet, reusing the planner's three.js scene.
- Max SPL per frequency, overlaid on the saved vented sub for comparison.
- Rows: max SPL at 35/45/60 Hz with the limit named, peak excursion (and
  where), mouth air speed, gain against the vented box.
- Checks: cone unloading below tuning (highpass advice), weight, lowpass
  advice (tapped horns have peaks and nulls above ~3.5× tuning).

## Model

Hornresp is closed source, so rebuild the physics (all public):

1. **Driver**: reuse the T/S block from `boxModel` in
   `tools/stack-planner.app.jsx` (Bl, Re, Mms, Cms, Rms, Sd; add Le).
2. **Horn segments**: each segment is a two-port (ABCD) matrix for a
   conical, exponential or parabolic flare, from throat area S1, mouth
   area S2 and length L. Lossless 1D (Webster) to start; add a small
   loss term later.
3. **Chambers**: rear chamber (Vrc) and throat chamber (Vtc) as acoustic
   compliances; a port or duct as a mass.
4. **Radiation**: piston-in-baffle impedance at the mouth, with a
   space setting (2π floor, π floor + wall, pair stacked = double mouth).
5. **Topologies**:
   - Front-loaded horn: cone front → throat chamber → horn; rear → sealed chamber.
   - Tapped horn: cone front taps the path at S2, cone rear at S3; both
     ends of the path open (S1 closed end, S4 mouth).
6. **Outputs** per frequency: volume velocity at the mouth → SPL, cone
   excursion, mouth air speed. Limits exactly as the vented sub: Xmax,
   2 × AES, amp voltage, air speed; broadband music limit plus a
   per-frequency max curve.

Frequency grid 15–300 Hz. Accuracy is good below ~100 Hz; folds and
the top of the band are approximate (the same is true of Hornresp).

## Validation (before trusting it)

- Pick one published tapped horn with Hornresp inputs, enter the same
  driver and segments, and match Hornresp's SPL and excursion within
  ~1 dB / 10% below 100 Hz.
- Sanity check: quarter-wave tuning ≈ c / (4 × path length). The mock's
  38 Hz for a 3.4 m path is wrong for this reason.

## Cabinet and 3D

- Turn the segment table into a fold layout: fixed width, fold count,
  panel positions along the depth, driver baffle location at S2/S3.
- Compute gross volume, panel list and weight (3/4″ birch, 2.3 lb/ft²,
  plus bracing) from that layout, not from a rule of thumb.
- Folds change the effective path length; use the centre-line length of
  each fold as the segment length.

## Steps

1. `hornModel()` next to `boxModel()`, tapped horn only; unit-check it
   against the validation design.
2. Horn tab (hash `#horn`), controls: driver, segments S1–S4 and lengths,
   Vrc, amp, highpass, placement.
3. Fold layout + 3D + weight.
4. Front-loaded horn topology.
5. Save/restore horn configs in the same `configs` collection with a
   `kind: "horn"` field.

## Driver notes (from the planner's data)

Horn loading wants low Qts and a strong motor (high Bl²/Re).
The 18FH500's motor is the weakest of the 18s listed (Bl²/Re ≈ 71);
the B&C 18NW100 (Qts 0.26, Bl²/Re ≈ 154) and FaitalPRO 18FX600 (Qts 0.28,
Bl²/Re ≈ 120) are the better horn candidates that still work in a small
vented box.
