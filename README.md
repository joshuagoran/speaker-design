# sound-system

Design tools for a DIY sound-system-style rig: two full-range stacks for rooms of
500–1000 sq ft, sometimes outdoors, plus loud home listening.

Everything here is modelled, not measured. The numbers are good enough to choose
between cabinets and catch a bad alignment before you cut plywood; they are not a
substitute for an impedance sweep on the prototype.

---

## Layout

```
model/vented-box.js          the physics — lumped-element vented box + limit taxonomy
tools/stack-planner.app.jsx  the planner (JSX, built with esbuild)
tools/stack-planner.head.html  its <head>: styles and the four CDN script tags
tools/vented-sub-bench.html  the standalone bench, no build step
tools/build.sh               planner -> dist/stack-planner.html
tools/serve.sh               build + vendor libs + serve on :8901
docs/design-notes.md         findings behind the current configuration
docs/*.svg                   crossover null cone, horn coverage
dist/                        build output (gitignored)
```

## Prerequisites

Node (for `npx esbuild`) and Python 3 (for the preview server). Nothing to
install — esbuild is fetched by `npx` on first run.

## Build

```sh
tools/build.sh          # -> dist/stack-planner.html
```

It runs esbuild over the JSX, then concatenates `stack-planner.head.html` + the
bundle + a closing `</script>` into one self-contained page. That page loads
React, ReactDOM, three.js and Tailwind from cdnjs at runtime; nothing else is
external.

The bench needs no build. Open `tools/vented-sub-bench.html` directly.

## Local preview

```sh
tools/serve.sh          # http://127.0.0.1:8901/index.html  and  /bench.html
```

It builds, downloads the four libraries into `dist/preview/` if they aren't
already there, rewrites the CDN URLs to local paths, and serves. The download
step needs network access to cdnjs; if it fails it tells you which file to place
by hand. Tailwind's play CDN generates CSS at runtime, so for preview drop any
Tailwind 3 stylesheet at `dist/preview/tw.css` — without it the page works but
renders unstyled.

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
  "savedAt": 1758738000000,          // epoch ms, the list sorts on this
  "format": "full",                   // fixed: 18" sub + CD; mid size (12" or 15") follows the "mid" driver
  "sub": "emnsw4018",                 // SUB_OPTIONS id
  "mid": "em3012",                    // MID_OPTIONS id
  "midBox": "b15",                    // MID_BOXES id
  "cd": "n314t",                      // CD_OPTIONS id
  "horn": "a460g2_14",                // HORN_OPTIONS id
  "cabinet": "column",                // last "Start from" choice, label only
  "portStyle": "slots",               // slots (bottom) | folded | vslots (both sides) | vslot1 (one side) | round2
  "cDim":  { "w": 28, "h": 32, "d": 24 },        // external inches
  "cVent": { "slotH": 3, "nt": 2, "dia": 6, "throat": 3, "len": 14 },
  "hpf": 33, "hpType": "BW24",       // sub highpass: BW24 | LR24 | BW48 | LR48
  "ampW": 800,                        // amp power per sub channel into 8 Ω; caps max SPL
  "portMax": 20,                      // peak port air speed limit, m/s
  "mDim":  { "w": 15, "h": 15, "d": 15 },         // mid-bass box, external inches (sealed)
  "wall": 0.75,                        // side/top/bottom/back ply, 0.75 or 0.5 (braced); baffles stay 3/4"
  "inset": 0.75,                       // baffle set back from the frame front, 0–1.5"
  "cabFinish": "birch",                // "birch", "walnut" or a paint hex
  "spacerH": 20,                       // "tops on spacers" spacer height, in
  "joint": "butt",                     // cutlist corner joints: butt | rabbet | miter
  "xoLo": 120, "xoHi": 950,           // crossovers, sub->mid and mid->horn, LR24
  "mAmpW": 400,                       // amp power per mid channel into 8 Ω
  "tilt": 6,                          // dB less the mid band needs than the sub band (music balance)
  "hfAmpW": 100,                      // amp power per HF channel, rated into 8 Ω
  "hfTilt": 6,                        // dB less the HF band needs than the mid band
  "layout": "stack", "cutaway": false, "baffleColor": "#e8b4a8",
  "summary": "Eminence NSW4018-8 · 28×32×24″ · 80 in² · 32.6 Hz"
}
```

Unknown ids fall back to whatever is currently selected, so a config saved
before a driver was added still loads.

Read or seed the collection from a Claude session with the `ArtifactData` tool
(`action: "list" | "get" | "set" | "batch"`, `collection: "configs"`). The eight
published cabinets are seeded as `preset-<id>` documents; they are ordinary
configurations and can be edited or deleted like any other.

## How the planner is put together

- `tools/data.js` — component tables (`SUB_OPTIONS`, `MID_OPTIONS`, `CD_OPTIONS`, `HORN_OPTIONS`, `CABINETS`, `FILL_OPTIONS`, …). Drivers with a `ts` block get modelled; ones without show a note instead.
- `tools/calc.js` — every calculation, pure JS, imported by the page and the tests (`npm test`):
  - `boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, hpType, { nPorts, QL, Qp })` — vented box. Leakage QL 7, port losses Qp 50; each of `nPorts` openings gets its own end correction (1.46·r); a letterbox passes `ecIn` from `slotEndCorr` (rectangular mouth, floor mirrored at both ends). Radiated output is the flow into the box air (cone − port − leak). `ref` is the mass-controlled asymptote; `f3` includes the highpass, `f3Box` doesn't. Limits are searched over the whole 12–300 Hz curve.
  - `closedBox(ts, VbL, hp, lp, volts)` — sealed mid-bass, LR24 crossovers. `ref` is the mass-controlled asymptote, so `f3` is right for low-Qtc boxes. Coil inductance is not modelled.
  - `midSystem` (sealed mid volume, model, per-frequency max), `subThroughLp` (sub through the crossover), `fillSystem` (the Fills page).
  - `subSystem` (vent geometry, gross/net volume incl. internal wood from the cutlist parts, model, limits), `subLimits`, `maxCurve`, `hornResponse`, `pistonBeam`, `keeleF`, weights, cutlist (`boxParts`, `cutParts`, `packSheets`).
- Horn — datasheet model, not T/S: `cd.hf` (sensitivity and its reference, AES power and the crossover it was rated at, minimum crossover, impedance) and `horn.hf` (coverage, minimum crossover, loading limit `lowHz`). Output is sensitivity + 10 log P through the LR24 highpass and a 12 dB/oct rolloff below `lowHz`; power is capped at 2 × AES, derated 6 dB per octave below the AES rating's crossover.
- Tests (`tests/`) check each function against an independent reference; `tests/golden.json` snapshots the key outputs of the saved and synthetic configs (regenerate with `node tests/make-golden.js` after an intentional change). CI runs them before every deploy. See `docs/testing-plan.md` and `docs/calc-audit.md`.
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
correction is the standard both-end approximation (1.46 r) for tubes and side ducts;
the floor letterbox uses the rectangular-mouth value with the floor as a mirror.
It is the largest source of error in Fb — a divided or flared duct measures a little differently. Cabinet
weight assumes 3/4" birch at 2.3 lb/ft² with two braces, plus driver and 6 lb of
hardware.

See `docs/design-notes.md` for the findings behind the current configuration.

## Web app (GitHub Pages + Firestore)

`sh tools/build.sh pages` builds `dist/site/` — the same planner, with saved
configs in Firebase Firestore instead of the claude.ai artifact store. Pushes
to `main` deploy it via `.github/workflows/pages.yml`.

One-time setup:

1. [Firebase console](https://console.firebase.google.com): create a project (free Spark plan).
2. Add a **Web app**; copy its config object into `tools/firebase-config.js`
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
