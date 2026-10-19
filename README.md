# sound-system

Design tools for a DIY sound-system-style rig: two full-range stacks for rooms of
500–1000 sq ft, sometimes outdoors, plus loud home listening.

Everything here is modeled, not measured. The numbers are good enough to choose
between cabinets and catch a bad alignment before you cut plywood; they are not a
substitute for an impedance sweep on the prototype.

---

## Layout

```
src/main.tsx                    entry: mounts <App/>; imports the stylesheet
src/App.tsx                     hash routing (the Speaker page by default), header
src/pages/speaker/              Speaker page: one box, its settings, results, templates, and optimizer
src/pages/stack/                Stack page: speakers stacked or side by side, with presets and an optimizer
src/pages/space/                Space page: stacks placed in a room or outdoors, and the coverage map
src/pages/{cutlist,notes}/      the cutlists (Speaker and Stack) and Notes (at /notes)
src/components/                 ui/ charts/ drawings/ lock/ optimizer/ stats/ chips/ saved-configs/ stack-view/
src/components/saved-configs/firebaseStore.ts   saving on GitHub Pages (bundled only into that build)
src/hooks/  src/constants/      shared hooks, chart scales, lock keys, units
src/styles/palette.ts           the colors (CSS variables and Tailwind names come from here)
src/styles/app.css              page styles + Tailwind layers; font
src/data/catalog/               the parts catalog as typed data, one file per kind (drivers, horns, amps, cabinets, plywood, ...)
src/lib/data.ts                 the catalog as the app reads it: comparable Xmax, tweeter faceplates, picker order
src/lib/tables.ts               byId / byIdOrThrow for those tables
src/lib/defaults.ts             DEFAULT_PA / DEFAULT_HIFI / DEFAULT_FILL: the designs the templates start from
src/types.ts                    types shared across modules (drivers, horns, cabinets, specs, Setter)
src/lib/acoustics/              the models: box models, woofer box, horn engine, directivity, dispersion, room, coverage
src/lib/build/                  cutlists (+ worker, runner), bracing, hardware, horn mounts, tubes, vent plan, box layout
src/lib/speaker/                the speaker, stack, and space model: specs, response, limits, chips, optimizers (+ workers)
src/lib/optimizer/              what the optimizers share: amp steps, goal keeps, progress, card selection
index.html                      Vite entry
tailwind.config.js              Tailwind, compiled at build time
tsconfig.json                   strict TypeScript (type-checked by `vp check`; Vite does the emit)
tests/                          Vitest suites, optimizer snapshots, mobile layout and 3D memory checks
tools/dead-exports.mjs          lists the code in src/ that nothing live uses (`vp run dead-exports`)
build/build.sh                  vp build + build/inline.mjs -> one self-contained page
build/serve.sh                  build + serve on :8901
build/compare-main.sh           build this tree and a ref (default origin/main), cmp both pages
docs/design-notes.md            findings behind the current configuration
docs/*.svg                      crossover null cone, horn coverage
```

## Prerequisites

Node `^22.18.0 || ^24.11.0 || >=26` and Python 3 (for the preview server). The toolchain is
[Vite+](https://viteplus.dev) (`vp`); it uses pnpm, which `vp install` fetches if needed.

```sh
pnpm install            # or `vp install` with the global vp CLI
pnpm exec vp check      # format, lint, type check
pnpm exec vp test       # tests (Vitest)
pnpm run speaker-optimizer-snapshot   # rewrite the optimizer snapshots after an intentional change
pnpm run stack-optimizer-snapshot
pnpm run dead-exports   # list the code in src/ that nothing live uses
```

## Build

```sh
build/build.sh          # -> dist/stack-planner.html
pnpm run build          # (or `vp run build`) -> dist/site/ for GitHub Pages
```

`vp build` bundles the app with React, three.js, the optimizer worker, the compiled
Tailwind stylesheet and the Inconsolata font (all from npm), and `build/inline.mjs`
puts the result into one HTML file. Nothing loads from a CDN: the page works offline.
The Pages build (`--mode pages`) also bundles Firebase for saving; the artifact build
doesn't include it.

## Local preview

```sh
build/serve.sh          # http://127.0.0.1:8901/stack-planner.html
```

It builds both pages and serves `dist/`. The pages are self-contained, so opening
`dist/stack-planner.html` straight from disk works too.

Saving is unavailable in local preview (see below). The app detects that and
says so rather than breaking.

## Publishing the app

The app is published as a claude.ai Artifact. It must declare the `db`
capability or saved configurations silently do nothing:

```
Artifact publish
  file_path:    dist/stack-planner.html
  url:          <the artifact's URL, to update in place>
  capabilities: {"db": {}}
```

Two consequences of declaring `db`:

- The artifact becomes organization-internal. It can no longer be shared by
  public link, only with people in the owner's organization.
- Omitting `capabilities` on a later publish carries the declaration forward.
  Passing `{}` clears it, which would break saving.

## Saved designs

The app saves speakers, stacks, and spaces, each in its own collection
(`speakers`, `stacks`, and `spaces`; on GitHub Pages under `users/{uid}`).
A stack names its speakers, and a space names its stacks.

The old PA and Hi-fi designs (collections `configs` and `hifiConfigs`, and the
`planner.*`, `hifi.*`, and `coverage.layout` localStorage keys) are no longer
read. They stay in place. `data/configs-seed.json` keeps the old PA seeds as
test designs.

## How the app is put together

- `src/data/catalog/<kind>.ts` — the parts catalog, pure typed data. Adding a part is an edit there; each file's header
  lists its fields and units.
- `src/lib/data.ts` — the tables the app reads (`SUB_OPTIONS`, `MID_OPTIONS`, `CD_OPTIONS`, `HORN_OPTIONS`,
  `FILL_OPTIONS`, ...), derived from the catalog. Drivers with a `ts` block get modeled; ones without show a note.
- `src/lib/acoustics/` — the models, pure TypeScript:
  - `boxModels.ts` — `boxModel` (vented box: leakage QL 7, port losses Qp 50, each opening's end correction),
    `closedBox` (sealed, LR24 or LR48 crossovers), the horn's power (`hornPower`), the maximum-output layer
    (`sineLimitAt`), and the weights.
  - `wooferBox.ts` — a woofer in a sealed, vented, or passive radiator box; `directivity.ts` — pistons, waveguides,
    and the baffle step.
  - `hornModel.ts` and `network/` — the 1-D horn engine (Hornresp-style).
  - `coverage.ts`, `roomAcoustics.ts`, and `roomModes.ts` — the Space page's floor map: the floor and wall
    reflections, the diffuse field, and the room's modes.
- `src/lib/speaker/` — the speaker spec and its response, limits, chips, cabinet build, and the stack and space
  models. The two optimizers (`optimize/`) run in Web Workers, inlined by the build.
- `src/lib/build/` — the cutlist packer (in a worker), bracing by rule, hardware, horn mounts, tubes, and the vent plan.
- Horn — datasheet model, not T/S: `cd.hf` (sensitivity and its reference, AES power and the crossover it was rated at,
  minimum crossover, impedance) and `horn.hf` (coverage, minimum crossover, loading limit `lowHz`).
- Tests (`tests/`) check each function against an independent reference. The speaker and stack optimizer snapshots pin the cards each optimizer picks. CI runs them, the phone check
  (`tests/mobile-check.mjs`), and the 3D checks (`tests/three-memory-check.mjs` and the horn mount tests) as parallel
  jobs. See `docs/testing-plan.md` and `docs/calc-audit.md`.
- Render tool, for looking at the 3D view by eye (not in `vp test` or CI): `node tests/render-speaker.mjs [outDir]
[view ...]` (a template's speaker in the page's own 3D view card). The options are listed at the top of
  `tests/render/speaker-view.tsx`.
- `src/components/stack-view/` — the three.js scenes. `SceneView3D` is the viewer (renderer, camera, drag and pinch,
  themed stage, framing); `SpeakerView3D` shows one speaker (`buildSpeakerScene`) and `MembersView3D` a stack. Both
  sit in `Viewer3DCard`, whose cutaway and full-screen buttons are view state, never saved. A scene rebuilds when the
  JSON of its props changes.

## Design constraints

These drive every choice in the tools:

- Must clearly outperform a pair of 1000 W powered tops plus a single powered 18" sub.
- No box over **125 lb**.
- Driver budget: **$400 / 18", $300 / 12", $200 / compression driver**.
- **US vendors only.** Parts Express, US Speaker, Madisound, Loudspeakers Plus, B&H, Full Compass, WAAT.
- Six to eight amp channels total. Currently planned around a Powersoft Ottocanali 4K4.
- Prices verified from vendors, dimensions from plans and datasheets — never recalled.

## Model assumptions

Half space, 1 m, one cabinet, no room gain. Everything is a sine at the amp's
rated power into 8 Ω (the amp slider). Port limit at a peak air speed you set
(default 20 m/s) and excursion limit at Xmax,
both at that sine's peaks. Thermal limit at program
power, 2 × the driver's AES rating: AES pink noise has a 6 dB crest factor, so
music with at least that much crest keeps the coil's average at or under AES.
The chart and the max SPL rows are per frequency: a sine at each frequency
meets its own limit. The "first limit, music" row is the broadband limit,
since music has energy at every frequency at once. Music averages about 6 dB
below the sine figures. Port end
correction is the standard both-end approximation (1.46 r) for round tubes;
letterbox and side ducts use the rectangular-mouth value with adjacent walls as mirrors.
It is the largest source of error in Fb — a divided or flared duct measures a little differently. Cabinet
weight assumes 3/4" birch at 2.3 lb/ft² with two braces, plus driver and 6 lb of
hardware.

See `docs/design-notes.md` for the findings behind the current configuration.

## Web app (GitHub Pages + Firestore)

`sh build/build.sh pages` builds `dist/site/` — the same app, with saved
designs in Firebase Firestore instead of the claude.ai artifact store. Pushes
to `main` deploy it via `.github/workflows/pages.yml`.

One-time setup:

1. [Firebase console](https://console.firebase.google.com): create a project (free Spark plan).
2. Add a **Web app**; copy its config object into
   `src/components/saved-configs/firebaseConfig.ts`. These values are public by design.
3. **Firestore Database → Create** (production mode).
4. **Authentication → Sign-in method → Google → Enable**; under
   **Settings → Authorized domains** add `<user>.github.io`.
5. **Firestore → Rules**: paste `firestore.rules` (each user reads and writes
   only `users/{uid}/…`) and publish.
6. GitHub repo **Settings → Pages → Source: GitHub Actions**.

On the site, **Sign in with Google to save**. Without a config the page works
but can't save.
