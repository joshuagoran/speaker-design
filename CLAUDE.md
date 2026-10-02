# SpeakNow (speaker-design)

DIY speaker planner: PA stack, cutlist, fills and hi-fi tabs, with optimizers. Single self-contained page (React, three.js, compiled Tailwind, font all bundled; no CDN scripts) built by `build/build.sh` (`vp build` + `build/inline.mjs`); sources in `src/`;
checks with `vp check`, tests with `vp test` (Vite+; `pnpm exec vp …` without the global CLI); phone layout check in `tests/mobile-check.mjs` (CI).

## UI rules

- **Charts use fixed axes.** Never autoscale a chart to its data; give it a fixed range for its purpose so designs compare
  by eye as settings change.
- **Charts on the same view share the same scales**, x and y. Frequency charts use the PA stack's x axis (15 Hz–20 kHz);
  every Hi-fi dB chart uses `HIFI_TOP` / `HIFI_BOT`; the PA response chart and the PA optimizer cards use 80–135 dB.
- Colours: CMYK brand (cyan actions and horn/tweeter, magenta mid-bass/woofer, yellow accents) plus black, white and two
  grays; status colours stay green / orange / red. The palette lives in `src/styles/palette.ts`; Tailwind's colour names are remapped from it in `tailwind.config.js`.
- Font: Inconsolata. Corners 4 px (6 px on large boxes).

## Project conventions

- Driver prices come from US vendors only; don't drop a driver because some specs are missing (mark the gap).
- Don't push straight to `main` (it deploys via GitHub Actions). Before pushing a change, ask the user whether they want a PR or a direct push to `main`.

## Commits and PRs

- Never attach session links (e.g. `Claude-Session:` trailers or claude.ai/code URLs) to commit messages, PR descriptions or comments.
