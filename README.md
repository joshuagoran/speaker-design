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
  "format": "full",                   // FORMATS id
  "sub": "emnsw4018",                 // SUB_OPTIONS id
  "mid": "em3012",                    // MID_OPTIONS id
  "midBox": "b15",                    // MID_BOXES id
  "cd": "n314t",                      // CD_OPTIONS id
  "horn": "a460g2_14",                // HORN_OPTIONS id
  "cabinet": "column",                // last "Start from" choice, label only
  "portStyle": "slots",               // slots (bottom) | folded | vslots (both sides) | vslot1 (one side) | round2
  "cDim":  { "w": 28, "h": 32, "d": 24 },        // external inches
  "cVent": { "slotH": 3, "nt": 2, "dia": 6, "throat": 3, "len": 14 },
  "hpf": 33,
  "ampW": 800,                        // amp power per sub channel into 8 Ω; caps max SPL
  "portMax": 20,                      // peak port air speed limit, m/s
  "mDim":  { "w": 15, "h": 15, "d": 15 },         // mid-bass box, external inches (sealed)
  "mStuff": true,                     // light stuffing, ~15% more effective volume
  "xoLo": 120, "xoHi": 950,           // crossovers, sub->mid and mid->horn, LR24
  "mAmpW": 400,                       // amp power per mid channel into 8 Ω
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

- `SUB_OPTIONS`, `MID_OPTIONS`, `CD_OPTIONS`, `HORN_OPTIONS`, `CABINETS`,
  `FORMATS` — the component data at the top of the file. Drivers with a `ts`
  block get modelled; ones without show a note instead.
- `closedBox(ts, VbL, hp, lp, volts)` — the sealed mid-bass model, LR24 crossovers at `hp`/`lp`. Returns the curve plus `Fc`, `Qtc`, box `f3`, midband `ref` and peak excursion. Coil inductance is not modelled.
- `boxModel(ts, VbL, SpIn2, LpIn, hpf, volts)` — the vented-box model. Returns
  the response `curve` plus `Fb`, `f3`, `ref`, SPL at 30/35/45, peak port
  velocity and peak excursion.
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
correction is the standard both-end approximation and is the largest source of
error in Fb — a divided or flared duct measures a little differently. Cabinet
weight assumes 3/4" birch at 2.3 lb/ft² with two braces, plus driver and 6 lb of
hardware.

See `docs/design-notes.md` for the findings behind the current configuration.
