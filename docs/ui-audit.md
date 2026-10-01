# UI audit (stack planner)

Scope: `tools/stack-planner.app.jsx` (2665 lines) and `tools/stack-planner.head.html`. Line refs are approximate and from the `passive-radiator` branch.

## 1. Component consistency

Shared today: `Pick` 687, `Slider` 810, `FoldHead` 800, `LockBtn`/`DimLock` 1554/1561, `RankBadge` 1598. Everything else is ad hoc.

| Pattern                          | Sites                                                                                   | Problem                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segmented / toggle button        | ~20 (1018, 1043, 1131, 1150, 1164, 1451, 1506, 1722, 2135, 2201, 2413, 2486, 2496, ...) | Active style hand-written each time; helpers `seg`/`optSeg`/`btn` differ in padding and inactive bg; port selector (1164) is a joined group, others use `gap-1`; `aria-pressed` on only a few |
| Card / panel                     | 1157, 1177, 1184, 1454, 1466, 2505-2586; large: 1054, 1732, 2154                        | `rounded ... px-3 py-3` vs `rounded-lg p-4`; margins vary                                                                                                                                     |
| Field label                      | 21x `text-sm text-stone-500 mb-1`                                                       | Variants at 844, 1124, 1151, 1185; Slider uses stone-600, Pick stone-500                                                                                                                      |
| Number input + unit              | 1059, 1741, 1745                                                                        | Same classes; `+e.target.value \|\| 0` forces blank to 0; no label; budget persisted in Hi-fi only                                                                                            |
| Section header                   | 15 `<h2>` with inline fontFamily                                                        | Redundant inline style; h3 sizes vary                                                                                                                                                         |
| Run/Search CTA + optimizer panel | 1054-1070 vs 1732-1760                                                                  | Near-copies                                                                                                                                                                                   |
| Lock-all / clear-locks bar       | 1041-1051 vs 2199-2215                                                                  | Near-copies; two lock-state shapes                                                                                                                                                            |
| Colour swatch picker             | 2440-2455 vs 2459-2477                                                                  | Copy-pasted; no aria-label                                                                                                                                                                    |
| Button sizes                     | 1043, 2161, 2183, 2231, 2245                                                            | No scale; secondary bg `stone-50` vs `white`                                                                                                                                                  |
| Slider units                     | ~50                                                                                     | Units passed as `"&#8243;"`, `" Hz"`, `"°"`; step 0.5 shows 2 decimals                                                                                                                        |

Proposed components: `Seg`, `ToggleBtn`, `Button`, `Card`, `Field`, `NumberField`, `SectionHead`, `OptimizerPanel`/`OptimizerBar`, `SwatchPicker`, `fmt` helpers.

## 2. Excess text -> tooltips

No tooltip component exists; the 20 tooltips are native `title=` (invisible on touch). Candidates: 1123-1128 "At the seat", 1213 option notes, 1227-1233 DSP "Division of labour", 1264/1272/1293 "Ruled out", 1298/1314/1319/1335, 1411, 1444, 1517/1539 cut-list intro, 2292/2361/2401/2646-2655 driver/mid/horn notes, 939/1707 "Limited by", 1115/1438/2301/2353/2393 status chip bodies, 1713, 1160-1170 box-type `tip`.

Proposed: one `<Tip text>` (button, not hover-only; `aria-describedby`; tap toggle; Esc/blur dismiss).

## 3. Legibility

Palette is remapped in `head.html` (~30-45): stone-400/500/600 = #707070, page bg white, font Inconsolata (reads small).

- Sizes: text-xs 79, text-sm 105, text-[11px] 6, text-[10px] 2.
- `text-stone-500` 87 uses; #707070 on white ~4.9:1 (marginal), on #e6e6e6 ~4.0:1 (fails).
- Brand cyan #0082c8 + white ~4.2:1 fails AA at small sizes (buttons 1068/1757, RankBadge 1599 at 11px).
- Disabled states use opacity 35/40/50.
- Worst: 1599, 852, 1713, 2237, 791, 926, 1694, 1553 (lock buttons).

Proposed: muted text #595959; darker accent (~#006ba6); min caption 13px, body 14-15px; labels min 12px; disabled via fill, not opacity. Two one-line edits in `head.html` cover ~120 spots.

## 4. Other issues

- Selects/sliders/inputs have no accessible name (labels are `div`/`span`); no `aria-valuetext`.
- Focus ring is yellow #ffd400 (~1.4:1); `focus:outline-none` on select (696) and text input (2161) removes it.
- Most segmented groups lack `aria-pressed`/`role="group"`; tabs lack tabpanel/aria-controls.
- Touch targets: lock buttons 24px, swatches 28px, checkbox/radio, "Delete" (2190); coarse minimum is 40px, guideline is 44px.
- `title` on disabled buttons (1717) never fires.
- Hover-only states; no touch equivalent.
- Hi-fi controls inline, PA in a bottom sheet (2408) on mobile; port selector (1164) cramped at narrow widths.
- Inch symbol written three ways; mixed `toFixed` precision; inconsistent unit spacing.
- Number inputs: `inputMode="numeric"` blocks decimals on iOS.
- Vertical rhythm (`mt-2..mt-8`) and radius (`rounded` vs `rounded-lg`/`rounded-xl`) have no scale.

## Suggested order

1. `Seg` + `ToggleBtn` + `Button`
2. `Field` + label wiring (Pick, Slider, NumberField)
3. `Tip`
4. Colour/type tokens
5. `Card`, `SectionHead`
6. `fmt` helper, inch-symbol normalisation
7. Merge `OptimizerPanel`s, `SwatchPicker`
8. Remove `focus:outline-none` from select/text input
