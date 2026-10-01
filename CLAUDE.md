# SpeakNow (speaker-design)

DIY speaker planner: PA stack, cutlist, fills and hi-fi tabs, with optimizers. Single page built by `tools/build.sh`;
checks with `vp check`, tests with `vp test` (Vite+; `pnpm exec vp …` without the global CLI); phone layout check in `tests/mobile-check.mjs` (CI).

## UI rules

- **Charts use fixed axes.** Never autoscale a chart to its data; give it a fixed range for its purpose so designs compare
  by eye as settings change.
- **Charts on the same view share the same scales**, x and y. Frequency charts use the PA stack's x axis (15 Hz–20 kHz);
  every Hi-fi dB chart uses `HIFI_TOP` / `HIFI_BOT`; the PA response chart and the PA optimizer cards use 80–135 dB.
- Colours: CMYK brand (cyan actions and horn/tweeter, magenta mid-bass/woofer, yellow accents) plus black, white and two
  grays; status colours stay green / orange / red. Tailwind's colour names are remapped in `tools/stack-planner.head.html`.
- Font: Inconsolata. Corners 4 px (6 px on large boxes).

## Project conventions

- Driver prices come from US vendors only; don't drop a driver because some specs are missing (mark the gap).
- Push changes to `main` (deploys via GitHub Actions) unless working on a feature branch the user asked for.
