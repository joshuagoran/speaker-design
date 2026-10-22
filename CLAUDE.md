# SpeakNow (speaker-design)

DIY speaker planner: the Speaker, Stack, and Space pages, and their cutlists.
One self-contained page (React, three.js, Tailwind, and the font bundled; no CDN), built by `build/build.sh`. Strict
TypeScript in `src/`; shared types in `src/types.ts`; models in `src/lib/acoustics`, `build`, and `speaker`.

Vite+ (`pnpm exec vp` without the global CLI): `pnpm start` installs and runs the dev server; `vp check`; `vp test`;
`vp run <name>` runs a `package.json` script (`vp <name>` is a built-in). Phone layout check: `tests/mobile-check.mjs`.
Vite+ docs: `node_modules/vite-plus/docs`.

## UI

- UI text never names a page that may go away, or internal rules, models, or code. Say what is true for the user.
- Don't change existing UI wording without asking the owner. Keep UI churn low: change only what the task needs.
- Charts use fixed axes, never autoscaled (exception: the folded horn's path chart). Charts in one view share x and y
  scales: frequency 15 Hz–20 kHz; maximum output 80–140 dB (`MAX_OUTPUT_TOP` / `MAX_OUTPUT_BOT`); sensitivity and
  response 50–120 dB (`HIFI_TOP` / `HIFI_BOT`); coverage map −12 to +6 dB (`COVERAGE_MAP_DB`).
- Dispersion maps (exception): the VituixCAD-style scale `DISPERSION_SCALE` (+6 to −36 dB, a contour every 3 dB), axes
  ±90° and 50 Hz–20 kHz, one `DispersionMap` with the crossovers marked.
- Colors come only from the palette tokens (`src/styles/palette.ts`): CMYK brand (cyan actions and horn/tweeter,
  magenta mid-bass/woofer, yellow accents), black, white, and grays; status green, orange, and red. Both themes switch
  through CSS variables: no `dark:` variants, no `bg-white`, cards use `bg-panel`, and code reads `usePalette()`. Data
  colors and the `ON_DATA` marks are the same in both themes. Color literals only in the favicon, the color picker's
  ring, and the cabinet finishes. `tests/contrast.test.ts` checks contrast.
- UI text uses STE, as the docs do. A string that names a control builds the name from that label's constant and marks
  it `**…**`; the app shows it in semibold. Replies and docs show app names in **bold**.
- While you build, show the owner each new or changed UI string, where it appears, and get an OK before the commit.
  Propose one short wording, not a list of options.
- Writing: US spelling (a key that saved data or links carry keeps its spelling, with a comment). Oxford comma.
  Louder/quieter for dB, higher/lower for Hz. One short sentence per line on a page; more goes in a Tooltip or the
  Details fold. Speaker, Stack, Space, and Source start with a capital when they mean the design item or the page (a
  Source is a Speaker or Stack placed in a Space); the plain words (a speaker on a stand, the space of a room) stay lower
  case. The audio to a Source is its signal, not its feed.
- Position labels name the sign's side (`POSITION_LABELS`); the tooltip says where it is measured from. Field labels
  carry no unit (inches); readouts do.
- Font Inconsolata. Corners 4 px (6 px on large boxes).
- Reuse `src/components/ui`; a control a second page needs moves there first. Layouts own the spacing; shared controls
  carry no outer margin.
- A page with settings uses `SettingsLayout` with `SettingsSection` folds, each with a one-line summary. Widths come
  from `src/styles/layout.ts`: the full window, with result blocks capped at `RESULT_MAX_WIDTH` and prose at
  `READING_WIDTH`.

## TypeScript

- No import extensions, except `?worker&inline`, CSS, and Node-loaded files.
- Narrowest type, derived from an existing one; check `src/types.ts` before declaring a shape.
- No `any` or `@ts-ignore`. `@ts-expect-error` and a last-resort `!` carry a reason. `as` only as `as const` or a
  commented boundary cast.
- Descriptive names; shorthand only for established symbols (Sd, Fb, ω). Define each name where it is made.
- A string compared in code or tests, or used twice, is defined once in `src/constants/`.

## Project

- The catalog and acoustics tables are typed data in `src/data/`; adding a part is a data edit. Mark missing specs;
  don't drop the part. UI text that names parts or defaults reads them from the data.
- Every setting a template or preset can set is also a setting on its page.
- When an optimizer change is meant to change its snapshot test, rewrite it with `vp run speaker-optimizer-snapshot` or
  `vp run stack-optimizer-snapshot`.
- Delete code a change makes obsolete. `vp run dead-exports` must list nothing before each push.
- The README stays short and current: what the app does, how to run, build, and deploy it, saving, and tests. It names
  no code that may change. A PR that changes these updates it.
- Docs use ASD-STE100: sentences of 20 words or fewer, one idea each, active voice. Prefer tables and lists to prose.

## Git and PRs

- Never push to `main`; every change goes through a PR (don't ask). Merge `main` into a feature branch with a pushed merge commit,
  no PR.
- Readable branch names (`hifi-slot-vent`), even when the session assigns another.
- No session links in commits, PRs, or comments.
- PR title: short STE, naming the change for the user. Description: "What changes" (bullets for the user) and "Tests"
  (one or two lines); rewrite it when the PR changes. `Closes #N` when it finishes an issue.
- One feature per PR; put related small changes together. At most 1–2 open PRs.

## New features

- Build a working mock of the core task first; the owner tests it with real tasks. The plan lists those tasks; run each
  in the browser before every hand-over.
- In every phase, mock each new interaction and get the owner's OK before building it. One new interaction per step.
- Hand editing before automation. Physical checks before scores; a score never decides what is buildable.
- A rule reused from another page gets checked on the new page.
- Three bugs reported in one area: stop, check the model, and tell the owner before the next fix.

## Agents and usage

Keep token use low, in every session and subagent.

- Code uses the session model. Reviews and docs use Sonnet at medium effort. Basic web searches use Haiku.
- Give a small fix to a new agent with a short prompt, not to a long-running one.
- Before a push, run `vp check` and the affected tests. Run the full suite, the build, or the phone check locally only
  when CI fails or the change touches the build or the layout.
- Review each code PR once; fix the findings without a second review. A docs PR gets a light review or none.
- Take screenshots only when the owner asks, or for a taste decision.
- Never wait in the foreground. Ask the owner before a job that takes minutes.
- Answer the owner's batched notes in one message, with questions in one short list.
