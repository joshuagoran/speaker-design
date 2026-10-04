# SpeakNow (speaker-design)

DIY speaker planner: PA stack, cutlist, fills and hi-fi tabs, with optimizers. Single self-contained page (React, three.js, compiled Tailwind, font all bundled; no CDN scripts) built by `build/build.sh` (`vp build` + `build/inline.mjs`); sources in `src/`, strict TypeScript (`tsconfig.json`), shared types in `src/types.ts`;
checks with `vp check`, tests with `vp test` (Vite+; `pnpm exec vp …` without the global CLI); phone layout check in `tests/mobile-check.mjs` (CI).

## UI rules

- **Charts use fixed axes.** Never autoscale a chart to its data; give it a fixed range for its purpose so designs compare
  by eye as settings change.
- **Charts on the same view share the same scales**, x and y. Frequency charts use the PA stack's x axis (15 Hz–20 kHz);
  every Hi-fi dB chart uses `HIFI_TOP` / `HIFI_BOT`; the PA response chart and the PA optimizer cards use 80–135 dB.
- Colours: CMYK brand (cyan actions and horn/tweeter, magenta mid-bass/woofer, yellow accents) plus black, white and two
  grays; status colours stay green / orange / red. The palette lives in `src/styles/palette.ts`; Tailwind's colour names are remapped from it in `tailwind.config.js`.
- Font: Inconsolata. Corners 4 px (6 px on large boxes).

## TypeScript

- Imports carry no extension (`./foo`, never `./foo.ts`); only `?worker&inline`, CSS and Node-loaded files keep theirs.
- Narrowest type, derived from an existing one (`Pick`, `Omit`, indexed access); never redeclare a shape, grep `src/types.ts` first.
- Avoid `!`: fix the type at its source or use existing narrowing; a last-resort `!` carries a one-line reason.
- No `any` (lint errors), no `@ts-ignore`, `@ts-expect-error` needs a reason; `as` only as `as const` or a commented boundary cast.
- A string used once and not for logic may stay inline; any string compared in code or tests, or used in more than one place, is defined once (ids in `src/constants/`, label maps for display) and imported.

## Project conventions

- Driver prices come from US vendors only; don't drop a driver because some specs are missing (mark the gap).
- The parts catalogue (drivers, horns, waveguides, passive radiators, port tubes, amps, makers, cabinets, racks, DSP units, plywood, driver cutouts) lives in `src/data/catalog/<kind>.ts`, and the room acoustics tables (materials, air absorption) in `src/data/acoustics/`, as typed pure data; adding a part is a data edit there, never in code (`src/lib/data.ts` only derives).
- UI text that names parts or defaults (Notes, racks, signal path) reads them from the catalogue and the defaults (`src/lib/defaults.ts`), never hardcoded.
- Any change to an optimizer (PA or Hi-fi search, card selection, or the models they call) regenerates `tests/optimizer-dump.json` with `vp run optimizer-dump` on the merged main and commits it; the quick snapshot test (`tests/optimizer-snapshot.test.ts`) is updated in the same PR.
- Don't push straight to `main` (it deploys via GitHub Actions). Before pushing a change, ask the user whether they want a PR or a direct push to `main`.

## Commits and PRs

- Name task branches readably, e.g. `hifi-slot-vent`, not `claude/<random-words>`.
- Never attach session links (e.g. `Claude-Session:` trailers or claude.ai/code URLs) to commit messages, PR descriptions or comments.
- A PR that finishes an issue says `Closes #N` so merging closes it.
