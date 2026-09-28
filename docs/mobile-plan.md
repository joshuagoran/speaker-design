# Mobile responsiveness plan

Audit at 390 × 844 (iPhone 14) in headless Chromium, all four views, Sep 2026.

## Findings

| # | Issue | Where | Severity |
|---|---|---|---|
| 1 | No `<meta name="viewport">`: phones render the 980 px desktop layout zoomed out to ~40 % | `tools/stack-planner.head.html`, `tools/pages.head.html` | blocker |
| 2 | Controls sit below all results (~4000 px down): each slider change means scrolling away from the 3D view and numbers | Planner | high |
| 3 | Chip heads are `shrink-0`: long heads ("Mid much wider than the horn at the crossover", "Below the driver's minimum crossover") squeeze the body into a 1–2 word column running off the card | chips in all sections | high |
| 4 | Tables wider than the screen: planner cost/weight table 419 px, Cutlist 640 px (Notes column cut off), Notes table 826 px | Planner totals, Cutlist, Notes | high |
| 5 | Chart text unreadable: SVG uses a fixed viewBox, so 9–10 px labels shrink to ~6 px at 358 px wide; legends overlap the curves | `ResponseChart`, beamwidth chart | medium |
| 6 | Stat tiles: 3-column grid leaves grey empty cells; "100°×100°" overflows its tile | tile grids | medium |
| 7 | 46 tap targets under 32 px tall (vent style buttons, joint/sheet buttons, swatches); Apple/Google guidance is 44/48 px | controls | medium |
| 8 | Sheet layouts: 2 per row at ~160 px, part labels ~6 px | Cutlist | low |
| 9 | `px-8` gutters (32 px) waste 16 % of the width | header, main | low |
| 10 | 3D view is 471 px tall; OK, but it pushes the numbers below the fold | Planner | low |

The Fills page is fine once #1 is fixed (no overflow).

## Plan

### Phase 1: quick fixes (one PR)
1. Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to both head files; add a build check that it's present.
2. Gutters `px-4 md:px-8`.
3. Chips: stack head above body below `sm` (`flex-col sm:flex-row`), drop `shrink-0` on small screens.
4. Tables: wrap each in `overflow-x-auto` with the first column sticky; on the Cutlist, hide the Notes column below `sm` and show the note under the part name.
5. Tiles: `grid-cols-2 sm:grid-cols-3`, no filler cells; allow values to wrap or shrink (`text-lg sm:text-xl`).
6. Tap targets: `min-h-[40px]` on option buttons and swatches, larger slider thumbs (`accent` + `h-6` input on touch).

### Phase 2: layout for phones
7. **Controls next to results.** Below `md`, move the control panel into a bottom sheet with tabs (Sub · Mid · Horn · Cabinet · Amps) that stays open over the lower half of the screen, with a sticky mini summary on top (Fb, max SPL @ 35 Hz, weight, first limit) so changes show immediately. Desktop keeps the side column.
8. 3D view: `aspect-[4/3]` on phones (~290 px) with a tap-to-expand full-screen button.
9. Sections (Sub, Mid-bass, Horn, Totals) collapse to accordions on phones, Sub open by default; remember state per viewer in localStorage.

### Phase 3: charts and cutlist
10. Charts: measure the container (ResizeObserver) and draw in real pixels so text stays 11–12 px; fewer x-ticks below 400 px (20, 50, 100, 200, 1k, 5k); legend below the plot.
11. Cutlist sheets: one per row below `sm`, labels scale with the sheet, tap a sheet to zoom.

### Testing
- Playwright script (`tests/mobile.spec` run in CI after build, not in `npm test`): load `dist/site/index.html` at 390 × 844 and 768 × 1024 for each view and a few seed configs, and assert
  - `document.documentElement.scrollWidth <= innerWidth` (no horizontal page scroll),
  - every button/select/input ≥ 40 px tall,
  - no chip body narrower than 120 px,
  - no page errors.
- Screenshots of each view saved as CI artifacts for a visual check.
- Manual check on a real iPhone and Android (Safari's bottom bar and `100vh` behave differently from headless Chromium: use `dvh`).

### Order and size
Phase 1 is about half a day and fixes most of what's visibly broken. Phase 2 is the real usability change (1–2 days). Phase 3 is polish.
