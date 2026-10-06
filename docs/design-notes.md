# Design notes

Findings that drove the current configuration. Everything modeled with
the planner's model (`tools/calc.js`; earlier notes used `model/vented-box.js`, now removed) unless a source is cited.

## Current configuration

|     |                                                                           |
| --- | ------------------------------------------------------------------------- |
| Sub | Eminence NSW4018-8 in 266 L net, 80 in² × 14" letterbox, Fb 32.6 Hz       |
| Mid | Eminence KappaLite 3012HO, 120 Hz – ~950 Hz                               |
| HF  | Eminence N314T-8 on an ATH A460G2 (1.4" throat adapter must be generated) |
| Amp | Powersoft Ottocanali 4K4, non-DSP                                         |

Sub cabinet: 28 × 32 × 24", 123 lb loaded, thermally limited at the full 1600 W,
15.4 m/s port air speed, 78% of Xmax, F3 34 Hz, 125.5 dB at 35 Hz.

## Sub driver

Displacement volume is what decides this, not cone area or power rating.

|                  | Vd       | AES    | Xmax    | Notes                                                 |
| ---------------- | -------- | ------ | ------- | ----------------------------------------------------- |
| NSW4018-8        | 1850 cm³ | 1600 W | 15.2 mm | Thermally limited in any sane box. The pick.          |
| Nero-18SW1100D   | 1533 cm³ | 1100 W | 12.2 mm | 45.6 lb — pushes a 250 L build over the weight limit. |
| Definimax 4018LF | 1022 cm³ | 1200 W | 8.6 mm  | Cone-limited at ~856 W. Can't use its rating.         |

A **pair of 15s loses to one NSW** in every case tested (KappaLite 3015LF,
CannaBass, Kappa Pro-15LF V2, Omega Pro-15-2KW, LAB 15). Two 15s give more cone
area but less Vd, because all the affordable 15s are short-throw. The LAB 15 is
the only one close, and only below 35 Hz, where it wants a horn rather than a
reflex box.

## The box beats the driver

160 L → 250 L with the port opened 63 → 90 in² gains ~2.5 dB and 3 Hz for either
driver. Swapping Nero → NSW in the same box gains 0.4–0.6 dB. Spend volume before
spending money on drivers.

## Tuning higher does not buy efficiency

Passband sensitivity moves 1.1 dB across a 20 Hz swing in Fb. A reflex box's
efficiency is set by Bl²/Re, Sd and Mms; the port only decides where its
contribution lands. Horn loading is the only way to buy real efficiency —
see the Paraflex / hybrid-horn note below.

Small win available: **90 in² × 13"** instead of 80 in² × 14" moves Fb to 35.1,
holds F3 at 34, stays thermal at 1600 W, gains 0.3 dB at 35 Hz and 1.0 dB at 45,
costs 1.6 dB at 30.

## Crossover geometry

Acoustic centers: sub 16", mid 39", horn 55" above the floor.

| transition          | spacing | d/λ  | verdict                        |
| ------------------- | ------- | ---- | ------------------------------ |
| sub → mid @ 120 Hz  | 23"     | 0.20 | inside λ/4, sums as one source |
| sub → mid @ 150 Hz  | 23"     | 0.26 | marginal                       |
| mid → horn @ 950 Hz | 16"     | 1.08 | null at 28° off axis           |

The mid-to-horn lobe cannot be fixed by moving parts: λ/4 at 950 Hz is 3.6", and
an 18.1" horn over a 12.6" frame bottoms out at ~15.4". **Stack vertically** so
the null cone opens up and down, where nobody stands — never side by side. See
`null-cone.svg`.

Fixes, in order of cost: steeper crossover (LR8) narrows the affected band; a
coaxial removes the spacing but forces the crossover up to ~1.2 kHz; an MEH or a
B&C triaxial removes it and crosses _lower_ (600–800 Hz).

## Hybrid horns

The SBS Slammer / Richard Long lineage is horn-loaded front with reflex loading
out the sides. JBL documented the same topology in the 1960s: the **4560A**
"horn and vented rear reflex chamber give usable response to 45 Hz with maximum
loading above 200 Hz", and adds 6 dB above 200 Hz. Also patented twice —
US5898138 (Delgado / Klipsch) and US8627920 (Moore).

Modeled against our reflex box, a 4560-scaled bin **loses 9.8 dB at 35 Hz** and
gains 4–5 dB from 100–200 Hz. Wrong side of our 120 Hz crossover. A horn-loaded
_mid_ gains ~5 dB at 150 Hz tapering to nothing by 500 Hz, which EQs back out.
Horn loading only pays here as part of a 4-way with much more mouth area.

## Sub height

Boundary gain survives elevation: half-space loading holds while the sub is well
inside λ/4 of the floor, which is 84" at 40 Hz. What bites is the floor-bounce
notch, and it is a top-of-band problem:

| sub acoustic center  | notch at 3 m | at 10 m |
| -------------------- | ------------ | ------- |
| 0.4 m (16", current) | 437 Hz       | 1280 Hz |
| 1.2 m (47")          | 152 Hz       | 429 Hz  |
| 1.6 m (63")          | 118 Hz       | 324 Hz  |

Keep the sub on the floor for a clean crossover region, not for deep bass.
Halfway up is the worst place; if it must be raised, go higher rather than partway.

## Planner conventions

Every cabinet in the planner is custom: W/H/D and vent geometry are sliders, and
the 3D view, the alignment table, the response chart and the limit flags all
recompute from them. The eight published cabinets (upright column, compact
column, block tall/compact/wide, tower column, cube) survive only as starting
points in a "Start from" list and as seeded saved configurations; they are no
longer a separate mode.

Saved configurations are the way back to a setup. Each one is a whole-system
snapshot — sub box and vent, mid, horn, compression driver, crossover, colors,
layout, bracing — kept in the artifact's document store, so they persist across
republishes and can be read back later.

Chart scale is fixed at 80–135 dB so configurations compare directly rather than
rescaling under you.
