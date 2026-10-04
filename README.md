# sound-system

Design tools for a DIY sound-system-style rig: two full-range stacks for rooms of
500–1000 sq ft, sometimes outdoors, plus loud home listening.

Everything here is modelled, not measured. The numbers are good enough to choose
between cabinets and catch a bad alignment before you cut plywood; they are not a
substitute for an impedance sweep on the prototype.

---

## Layout

```
src/main.tsx                    entry: mounts <App/>; imports the stylesheet
src/App.tsx                     hash routing, header, and the planner state shared by the PA pages
src/pages/pa-stack/             PA stack page: PaStackPage, sections/, hooks/ (state: sub, mid, horn, crossovers, ...)
src/pages/coverage/             Coverage page: the stacks on a floor plan (useCoverageLayout, useCoverageMap)
src/pages/{hifi,fills,cutlist,notes}/   the other pages
src/components/                 ui/ charts/ drawings/ lock/ optimizer/ stats/ chips/ saved-configs/ stack-view/
src/components/saved-configs/firebaseStore.ts   saving on GitHub Pages (bundled only into that build)
src/hooks/  src/constants/      shared hooks, chart scales, lock keys, units
src/styles/palette.ts           the colours (CSS variables and Tailwind names come from here)
src/styles/app.css              page styles + Tailwind layers; font
src/data/catalog/               the parts catalogue as typed data, one file per kind (drivers, horns, amps, cabinets, plywood, …)
src/lib/data.ts                 the catalogue as the app reads it: comparable Xmax, tweeter faceplates, picker order
src/lib/tables.ts               byId / byIdOrThrow for those tables
src/lib/defaults.ts             DEFAULT_PA / DEFAULT_HIFI / DEFAULT_FILL: the first-load designs, as whole objects
src/types.ts                    types shared across modules (drivers, horns, cabinets, design config, Setter)
src/lib/pa/                     calc, chips, optimize (+ worker, runner), dispersion, coverage (+ worker, runner) (pure TypeScript, tested)
src/lib/hifi/                   hifi model and its optimizer
index.html                      Vite entry
tailwind.config.js              Tailwind, compiled at build time
tsconfig.json                   strict TypeScript (type-checked by `vp check`; Vite does the emit)
tests/                          Vitest suites, golden snapshot, mobile layout check
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
pnpm run golden         # rewrite tests/golden.json after an intentional change (golden.test.ts only reads it)
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

Saving is unavailable in local preview (see below). The planner detects that and
says so rather than breaking.

## Publishing the planner

The planner is published as a claude.ai Artifact. It must declare the `db`
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

## Saved configurations

The planner keeps whole-system snapshots in the artifact's document store,
collection `configs`, one document per configuration:

```jsonc
{
  "name": "NSW 266 L reference",
  "savedAt": 1758738000000, // epoch ms, the list sorts on this
  "format": "full", // fixed: 18" sub + CD; mid size (12" or 15") follows the "mid" driver
  "sub": "emnsw4018", // SUB_OPTIONS id
  "mid": "em3012", // MID_OPTIONS id
  "midBox": "b15", // MID_BOXES id
  "cd": "n314t", // CD_OPTIONS id
  "horn": "a460g2_14", // HORN_OPTIONS id
  "cabinet": "column", // last "Start from" choice, label only
  "portStyle": "slots", // slots (bottom) | folded | vslots (both sides) | vslot1 (one side) | round2
  "cDim": { "w": 28, "h": 32, "d": 24 }, // external inches
  "cVent": { "slotH": 3, "nt": 2, "dia": 6, "throat": 3, "len": 14 },
  "hpf": 33,
  "hpType": "BW24", // sub highpass: BW24 | LR24 | BW48 | LR48
  "ampW": 800, // amp power per sub channel into 8 Ω; caps max SPL
  "portMax": 20, // peak port air speed limit, m/s
  "mDim": { "w": 15, "h": 15, "d": 15 }, // mid-bass box, external inches (sealed)
  "wall": 0.75, // side/top/bottom/back ply, 0.75 or 0.5 (braced); baffles stay 3/4"
  "inset": 0.75, // baffle set back from the frame front, 0–1.5"
  "cabFinish": "birch", // "birch", "walnut" or a paint hex
  "spacerH": 20, // "tops on spacers" spacer height, in
  "joint": "butt", // cutlist corner joints: butt | rabbet | miter
  "xoLo": 120,
  "xoHi": 950, // crossovers, sub->mid and mid->horn, Hz
  "xoLoOrder": 4, // their Linkwitz-Riley slopes: 4 = LR24, 8 = LR48; a missing one loads as 4
  "xoHiOrder": 4,
  "mAmpW": 400, // amp power per mid channel into 8 Ω
  "tilt": 6, // dB less the mid band needs than the sub band (music balance)
  "hfAmpW": 100, // amp power per HF channel, rated into 8 Ω
  "hfTilt": 6, // dB less the HF band needs than the mid band
  "layout": "stack",
  "cutaway": false,
  "baffleColor": "#e8b4a8",
  "summary": "Eminence NSW4018-8 · 28×32×24″ · 80 in² · 32.6 Hz",
}
```

Unknown ids fall back to whatever is currently selected, so a config saved
before a driver was added still loads.

Read or seed the collection from a Claude session with the `ArtifactData` tool
(`action: "list" | "get" | "set" | "batch"`, `collection: "configs"`). The eight
published cabinets are seeded as `preset-<id>` documents; they are ordinary
configurations and can be edited or deleted like any other.

## How the planner is put together

- `src/data/catalog/<kind>.ts` — the parts catalogue, pure typed data: subs, mids, fills, compression drivers, horns and waveguides, Hi-fi woofers, tweeters and passive radiators, amps, makers, cabinets, mid boxes, formats, finishes, racks, DSP units, plywood and driver cutouts. Adding a part is an edit there; each file's header lists its fields and units.
- `src/lib/data.ts` — the tables the app reads (`SUB_OPTIONS`, `MID_OPTIONS`, `CD_OPTIONS`, `HORN_OPTIONS`, `CABINETS`, `FILL_OPTIONS`, …), derived from the catalogue (comparable Xmax, tweeter faceplates, picker order). Drivers with a `ts` block get modelled; ones without show a note instead.
- `src/lib/pa/optimize.ts` — the optimizer (Planner → "Optimizer: on"): screens sub driver × volume × tuning × highpass, builds real boxes and vents (duct length solved for the tuning), picks mid and HF that keep up, then scores the finalists with the planner's own functions. Runs in a Web Worker (`src/lib/pa/optimize.worker.ts`, inlined by the build), with a main-thread fallback. See `docs/optimizer-plan.md`.
- `src/lib/pa/coverage.ts` — the Coverage page's floor map: both stacks (the dispersion model's sub, mid and horn, driven at the planner's curves and balanced with its music tilts) placed and aimed on a floor plan, summed with the floor and first-order wall reflections. Coherent below 500 Hz (the stacks interfere), power-summed above it in a band average. Runs in a Web Worker (`coverage.worker.ts`), coarse while dragging, then fine.
- `src/lib/pa/chips.ts` — the warning chips for each section (sub, mid, horn, fills), pure functions tested at each threshold.
- `src/lib/pa/calc.ts` — every calculation, pure TypeScript, imported by the page and the tests (`vp test`):
  - `boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, hpType, { nPorts, QL, Qp })` — vented box. Leakage QL 7, port losses Qp 50; each of `nPorts` openings gets its own end correction (1.46·r); letterbox and side ducts pass `ecIn` from `slotEndCorr` / `sideDuctEndCorr` (rectangular mouth; floor mirrored at both ends of a letterbox, the side wall at the inner end of a side duct). Radiated output is the flow into the box air (cone − port − leak). `ref` is the mass-controlled asymptote; `f3` includes the highpass, `f3Box` doesn't. Limits are searched over the whole 12–300 Hz curve.
  - `closedBox(ts, VbL, hp, lp, volts, { hpOrder, lpOrder })` — sealed mid-bass, LR24 or LR48 crossovers. `ref` is the mass-controlled asymptote, so `f3` is right for low-Qtc boxes. Coil inductance is not modelled.
  - `midSystem` (sealed mid volume, model, per-frequency max), `subThroughLp` (sub through the crossover), `fillSystem` (the Fills page).
  - `subSystem` (vent geometry, gross/net volume incl. internal wood from the cutlist parts, model, limits), `subLimits`, `maxCurve`, `hornResponse`, `pistonBeam`, `keeleF`, weights, cutlist (`boxParts`, `cutParts`, `packSheets`).
- Horn — datasheet model, not T/S: `cd.hf` (sensitivity and its reference, AES power and the crossover it was rated at, minimum crossover, impedance) and `horn.hf` (coverage, minimum crossover, loading limit `lowHz`). Output is sensitivity + 10 log P through the crossover's highpass (LR24 or LR48) and a 12 dB/oct rolloff below `lowHz`; power is capped at 2 × AES, derated 6 dB per octave below the AES rating's crossover.
- Tests (`tests/`) check each function against an independent reference; `tests/golden.json` snapshots the key outputs of the saved and synthetic configs (regenerate with `vp run golden` after an intentional change; `golden.test.ts` only reads it, and the writer, `tests/update-golden.ts`, is a separate run because rewriting `golden.json` inside the full suite would race `tests/optimize.test.ts`, which reads it in a parallel worker). CI runs them before every deploy, plus `tests/mobile-check.mjs` (Playwright: no sideways scroll, 40 px touch targets, chip text not squeezed, at phone and tablet widths). See `docs/testing-plan.md` and `docs/calc-audit.md`.
- `StackView` — the three.js scene. Takes `sub` (whose `.box` carries the
  dimensions) and `portGeom` (explicit vent geometry), so the drawn box always
  matches the modelled one. Its `useEffect` rebuilds the whole scene; the
  dependency array must include anything that changes the geometry.
- `ResponseChart` — max-SPL curves (sub through its lowpass, mid-bass through
  its crossovers), fixed 80–135 dB so configurations compare directly.
- `StackPlanner` — state and layout. Every cabinet is custom: `cDim` and `cVent`
  hold the geometry and `CABINETS` only supplies starting points.

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

`sh build/build.sh pages` builds `dist/site/` — the same planner, with saved
configs in Firebase Firestore instead of the claude.ai artifact store. Pushes
to `main` deploy it via `.github/workflows/pages.yml`.

One-time setup:

1. [Firebase console](https://console.firebase.google.com): create a project (free Spark plan).
2. Add a **Web app**; copy its config object into `build/firebase-config.js`
   (`window.PLANNER_FIREBASE = { ... }`). These values are public by design.
3. **Firestore Database → Create** (production mode).
4. **Authentication → Sign-in method → Google → Enable**; under
   **Settings → Authorized domains** add `<user>.github.io`.
5. **Firestore → Rules**: paste `firestore.rules` (each user reads and writes
   only `users/{uid}/…`) and publish.
6. GitHub repo **Settings → Pages → Source: GitHub Actions**.

On the site, **Sign in with Google to save**, then **Import saved configs**
once to copy `data/configs-seed.json` (exported from the artifact) into your
account. Without a config the page works but can't save.
