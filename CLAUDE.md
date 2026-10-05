# SpeakNow (speaker-design)

DIY speaker planner: PA stack, cutlist, fills and hi-fi tabs, with optimizers. Single self-contained page (React, three.js, compiled Tailwind, font all bundled; no CDN scripts) built by `build/build.sh` (`vp build` + `build/inline.mjs`); sources in `src/`, strict TypeScript (`tsconfig.json`), shared types in `src/types.ts`;
checks with `vp check`, tests with `vp test` (Vite+; `pnpm exec vp …` without the global CLI); phone layout check in `tests/mobile-check.mjs` (CI).

## UI rules

- **Charts use fixed axes.** Never autoscale a chart to its data; give it a fixed range for its purpose so designs compare
  by eye as settings change.
- **Charts on the same view share the same scales**, x and y. Frequency charts use the PA stack's x axis (15 Hz–20 kHz);
  every Hi-fi dB chart uses `HIFI_TOP` / `HIFI_BOT`; the PA response chart and the PA optimizer cards use 80–135 dB.
  The coverage map colours the level against the target on a fixed −12 to +6 dB scale (`COVERAGE_MAP_DB`).
- Colours: CMYK brand (cyan actions and horn/tweeter, magenta mid-bass/woofer, yellow accents) plus black, white and two
  grays; status colours stay green / orange / red. The palette lives in `src/styles/palette.ts`; Tailwind's colour names are remapped from it in `tailwind.config.js`.
- Light and dark themes (follows the device, with the header's System / Light / Dark switch): every colour comes from the
  palette tokens and works in both. Classes switch through CSS variables (no `dark:` variants, no `bg-white`; cards use
  `bg-panel`); colours drawn from code read `usePalette()` (`src/hooks/useTheme.ts`). Data colours (`DISPERSION_SCALE`,
  the coverage scale, cabinet finishes, the 3D view's driver parts `PARTS_3D`) and the marks drawn on them (`ON_DATA`)
  are the same in both themes. The only colour literals outside the palette are the favicon, the colour picker's
  rainbow ring and the cabinet finish data.
  `tests/contrast.test.ts` checks text 4.5:1 and lines 3:1 in both.
- Dispersion maps (owner-approved colour exception, these maps only) use the continuous VituixCAD-style scale, +6 to −36 dB with a contour every 3 dB (`DISPERSION_SCALE` in `src/styles/palette.ts`), not the CMYK brand palette. They are the one frequency chart off the 15 Hz–20 kHz axis: every map shares fixed axes of ±90° and 50 Hz–20 kHz (`src/constants/chartScales.ts`), since below about 85 Hz the default designs are flat at every angle; one `DispersionMap` component and key, with the crossovers marked.
- Font: Inconsolata. Corners 4 px (6 px on large boxes).
- Reuse UI components (`src/components/ui`) wherever the same control appears; never re-implement one inline, so pages stay consistent.
- A page with settings uses `SettingsLayout`: from md up the page doesn't scroll; the results and the `SettingsColumn` are two panes, each with its own scrollbar. Long settings (PA, Hi-fi) split into `SettingsSection` folds with a one-line summary each, built from the state and the catalogue. Page width and gutters come from `PAGE_WIDTH` (`src/styles/layout.ts`).

## TypeScript

- Imports carry no extension (`./foo`, never `./foo.ts`); only `?worker&inline`, CSS and Node-loaded files keep theirs.
- Narrowest type, derived from an existing one (`Pick`, `Omit`, indexed access); never redeclare a shape, grep `src/types.ts` first.
- Avoid `!`: fix the type at its source or use existing narrowing; a last-resort `!` carries a one-line reason.
- No `any` (lint errors), no `@ts-ignore`, `@ts-expect-error` needs a reason; `as` only as `as const` or a commented boundary cast.
- A string used once and not for logic may stay inline; any string compared in code or tests, or used in more than one place, is defined once (ids in `src/constants/`, label maps for display) and imported.

## Project conventions

- Driver prices come from US vendors only; don't drop a driver because some specs are missing (mark the gap).
- The parts catalogue (drivers, horns, waveguides, passive radiators, port tubes, amps, makers, cabinets, racks, DSP units, plywood, driver cutouts) lives in `src/data/catalog/<kind>.ts`, and the acoustics tables (room materials, air absorption, the generated slot inner-end table) in `src/data/acoustics/`, as typed pure data; adding a part is a data edit there, never in code (`src/lib/data.ts` only derives).
- UI text that names parts or defaults (Notes, racks, signal path) reads them from the catalogue and the defaults (`src/lib/defaults.ts`), never hardcoded.
- Optimizer tests: `tests/optimizer-snapshot.test.ts` (normal suite) checks the cards both optimizers pick for a few fixed designs; when an optimizer change is meant to change them, rewrite the file with `vp run optimizer-snapshot`. The full optimizer dump, `tests/optimizer-dump.json` (`vp run optimizer-dump`, or `optimizer-dump:pa` / `optimizer-dump:hifi`; parallel shards, minutes), is there to compare a change's cards over many more designs when that helps; it isn't required.
- Don't push straight to `main` (it deploys via GitHub Actions). Before pushing a change, ask the user whether they want a PR or a direct push to `main`.

## Commits and PRs

- Name task branches readably, e.g. `hifi-slot-vent`, not `claude/<random-words>`.
- Never attach session links (e.g. `Claude-Session:` trailers or claude.ai/code URLs) to commit messages, PR descriptions or comments.
- A PR that finishes an issue says `Closes #N` so merging closes it.
