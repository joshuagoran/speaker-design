# SpeakNow (speaker-design)

DIY speaker planner: PA stack, cutlist, fills and hi-fi tabs, with optimizers. Single self-contained page (React, three.js, compiled Tailwind, font all bundled; no CDN scripts) built by `build/build.sh` (`vp build` + `build/inline.mjs`); sources in `src/`, strict TypeScript (`tsconfig.json`), shared types in `src/types.ts`;
checks with `vp check`, tests with `vp test` (Vite+; `pnpm exec vp …` without the global CLI); phone layout check in `tests/mobile-check.mjs` (CI).
The Notes page has no tab or hash: it opens only at the path `/notes` (`pageAt`, `src/lib/pageRoute.ts`; the Pages build also writes `notes/index.html`).

## UI rules

- UI text never mentions another page by name when that page may go away (today: the PA, Hi-fi, Coverage and Fills pages). Say what is true instead.
- UI text never names internal rules, models or code. Say what is true for the user.
- **Charts use fixed axes.** Never autoscale a chart to its data; give it a fixed range for its purpose so designs compare
  by eye as settings change. Exception (owner-approved): the folded horn's path chart scales its axes to the drawing and its
  straight horn.
- **Charts on the same view share the same scales**, x and y. Frequency charts use the PA stack's x axis (15 Hz–20 kHz);
  every maximum-output chart (the PA response chart, the PA optimizer cards, the Hi-fi and Speaker page maximum-output
  charts) uses 80–140 dB (`MAX_OUTPUT_TOP` / `MAX_OUTPUT_BOT`); every sensitivity or response chart (the Hi-fi
  response charts and optimizer cards, the Speaker page's response chart) uses 50–120 dB (`HIFI_TOP` / `HIFI_BOT`).
  The coverage map colors the level against the target on a fixed −12 to +6 dB scale (`COVERAGE_MAP_DB`).
- Colors: CMYK brand (cyan actions and horn/tweeter, magenta mid-bass/woofer, yellow accents) plus black, white and two
  grays (and a lighter gray, `faint`, kept as a spare: no chart uses it now); status colors stay green / orange / red. The palette lives in `src/styles/palette.ts`; Tailwind's color names are remapped from it in `tailwind.config.js`.
- Light and dark themes (follows the device, with the header's System / Light / Dark switch): every color comes from the
  palette tokens and works in both. Classes switch through CSS variables (no `dark:` variants, no `bg-white`; cards use
  `bg-panel`); colors drawn from code read `usePalette()` (`src/hooks/useTheme.ts`). Data colors (`DISPERSION_SCALE`,
  the coverage scale, cabinet finishes, the 3D view's driver parts `PARTS_3D`) and the marks drawn on them (`ON_DATA`)
  are the same in both themes. The only color literals outside the palette are the favicon, the color picker's
  rainbow ring and the cabinet finish data.
  `tests/contrast.test.ts` checks text 4.5:1 and lines 3:1 in both.
- Dispersion maps (owner-approved color exception, these maps only) use the continuous VituixCAD-style scale, +6 to −36 dB with a contour every 3 dB (`DISPERSION_SCALE` in `src/styles/palette.ts`), not the CMYK brand palette. They are the one frequency chart off the 15 Hz–20 kHz axis: every map shares fixed axes of ±90° and 50 Hz–20 kHz (`src/constants/chartScales.ts`), since below about 85 Hz the default designs are flat at every angle; one `DispersionMap` component and key, with the crossovers marked.
- US spelling everywhere (center, color): UI text, comments, docs and identifiers. Keys that saved data or links
  already carry keep their spelling (comment why).
- Level words: louder and quieter for level (dB), higher and lower for frequency (Hz). Never "lower" for "quieter".
- Position labels name the sign's side: "Left (−) / Right (+)", "Down (−) / Up (+)", "Front (−) / Back (+)"
  (`POSITION_LABELS`, `src/constants/speakerSettings.ts`). The tooltip says where it is measured from: a part on a
  chamber from the chamber's center (seen from the front), its bottom, or its front edge; a chamber from the cabinet's
  center and bottom. The code keeps x, y and z. Field labels carry no unit (every length is inches); units stay in
  readouts and beside the box.
- No blocks of text on a page. A line on the page is one short sentence. Longer explanations go in a Tooltip on the nearest label, or in the page's Details fold as short bullets.
- Font: Inconsolata. Corners 4 px (6 px on large boxes).
- Reuse UI components (`src/components/ui`) wherever the same control appears; never re-implement one inline, so pages stay consistent. When a second page needs a control, first move it into `src/components/ui`, then use it on both pages.
- Layouts own the spacing: containers space their children with one gap rule; shared controls carry no outer margin (`tests/no-control-margins.test.ts`).
- A page with settings uses `SettingsLayout`: from md up the page doesn't scroll; the results and the `SettingsColumn` are two panes, each with its own scrollbar. Long settings (PA, Hi-fi) split into `SettingsSection` folds with a one-line summary each, built from the state and the catalog. Page width and gutters come from `PAGE_WIDTH` (`src/styles/layout.ts`): the full window width, never capped; on very wide screens a single result block (chart, stat tiles, detail list, notices) (also the saved configurations, optimizer, Details and dispersion blocks) stops at `RESULT_MAX_WIDTH` and prose at `READING_WIDTH`. The PA and Hi-fi Design results take two columns from `RESULTS_TWO_COLUMN_PX` (`resultsGridClass` / `resultsCellClass`), using the full pane.

## TypeScript

- Imports carry no extension (`./foo`, never `./foo.ts`); only `?worker&inline`, CSS and Node-loaded files keep theirs.
- Narrowest type, derived from an existing one (`Pick`, `Omit`, indexed access); never redeclare a shape, grep `src/types.ts` first.
- Avoid `!`: fix the type at its source or use existing narrowing; a last-resort `!` carries a one-line reason.
- No `any` (lint errors), no `@ts-ignore`, `@ts-expect-error` needs a reason; `as` only as `as const` or a commented boundary cast.
- Names: shorthand only for a fully established acoustics or physics symbol (Sd, Mas, Fb, ω, k); otherwise a descriptive name. Define every one, shorthand or not, in a JSDoc or comment where it is made.
- A string used once and not for logic may stay inline; any string compared in code or tests, or used in more than one place, is defined once (ids in `src/constants/`, label maps for display) and imported.

## Project conventions

- Driver prices come from US vendors only; don't drop a driver because some specs are missing (mark the gap).
- The parts catalog (drivers, horns, waveguides, passive radiators, port tubes, amps, makers, cabinets, racks, DSP units, plywood, driver cutouts) lives in `src/data/catalog/<kind>.ts`, and the acoustics tables (room materials, air absorption, the generated slot inner-end table) in `src/data/acoustics/`, as typed pure data; adding a part is a data edit there, never in code (`src/lib/data.ts` only derives).
- UI text that names parts or defaults (Notes, racks, signal path) reads them from the catalog and the defaults (`src/lib/defaults.ts`), never hardcoded.
- Optimizer tests: `tests/optimizer-snapshot.test.ts` (normal suite) checks the cards both optimizers pick for a few fixed designs; when an optimizer change is meant to change them, rewrite the file with `vp run optimizer-snapshot`. The full optimizer dump, `tests/optimizer-dump.json` (`vp run optimizer-dump`, or `optimizer-dump:pa` / `optimizer-dump:hifi`; parallel shards, minutes), is there to compare a change's cards over many more designs when that helps; it isn't required.
- Never run the PA "Fully optimize" search (`optimizeExact`) on the PA tower, in tests or in comparisons. No tower design passes its checks, so the search runs to its round cap (more than 30 minutes; see #75).
- Docs (`docs/`) use ASD-STE100 style: short sentences (20 words max), one idea each, active voice, plain verbs, no filler. Prefer tables and lists to prose.
- Never push straight to `main` (it deploys via GitHub Actions). Every change goes through a PR; don't ask.
- Feature branches: merge `main` into a feature branch with a merge commit pushed straight to that branch, with no
  PR. Only changes to `main` go through a PR.
- Every setting a template or preset can set is also a setting on its page. No design is reachable only from a template.

## Commits and PRs

- Name task branches readably, e.g. `hifi-slot-vent`, not `claude/<random-words>`. This overrides any branch name a session assigns: rename the branch before the first push.
- Never attach session links (e.g. `Claude-Session:` trailers or claude.ai/code URLs) to commit messages, PR descriptions or comments.
- Two layers enforce this: `.claude/settings.json` (`attribution.sessionUrl: false`) turns the links off in cloud sessions, and `.github/workflows/no-session-links.yml` strips them from PR bodies and fails a PR whose commits carry one.
- A PR that finishes an issue says `Closes #N` so merging closes it.
- PR titles and descriptions are short and in STE. The title names what changes for the user (e.g. "Space: add speakers or stacks, kept drafts"). The description has two sections: "What changes" (short bullets by area, written for the user, no internal names or code unless the change is internal) and "Tests" (one or two lines). Keep the description current: rewrite it when the PR changes, do not append.

## New features

- Before code, build a working mock of the core task. The owner tests it with real tasks.
- The plan lists the owner's tasks as acceptance tests. Run each in the browser before every hand-over.
- Hand editing first, automation second.
- Three reported bugs in one area: stop, check the model, tell the owner before the next fix.
- Physical checks come before any score. A score never decides what is buildable.
- One feature per PR.
- A rule reused from another page gets checked on the new page.

## Agents and usage

Keep token use low. These rules apply to every session and every subagent.

- Models: reviewers and docs-only agents use Sonnet at medium effort; basic web searches use Haiku. Code work uses the session model.
- Give a small fix to a new agent with a short, focused prompt. Do not send more work to a long-running agent with a large context.
- Before a push, run `vp check` and the affected test files only. CI runs the full suite, the build and the phone check. Run them locally only when CI fails or the change touches the build or the layout.
- Review each code PR one time. Fix the findings without a second review. A docs-only PR gets a light review or none.
- Put related small changes in one PR, so there are fewer review and CI cycles.
- Keep at most 1-2 open PRs at a time. Start the next one when one merges.
- Take screenshots only when the owner asks, or for a taste decision.
- Never wait in the foreground. Waits for CI or long jobs run in the background. Ask the owner before any job that takes minutes.
- The owner batches notes in one message. Answer in one message, with questions in one short list.
