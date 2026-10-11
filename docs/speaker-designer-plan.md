# Speaker designer: plan (parent branch `designer`)

One page, the Designer, designs any single box and saves it to a library. A later Space page places saved
boxes in a real space. This plan
gets there in small PRs: near-term phases on today's Hi-fi engine first, then the general model.

## Goal (owner's vision)

- **Speaker designer.** One page designs any single box and saves it to a library.
  - **Drivers combine freely in a cab.** A cabinet is one or more chambers, each with its own volume and
    vent (sealed, ported, slot, passive radiator). Each chamber holds any number of drivers of any type:
    woofer, mid, horn or waveguide on a compression driver, tweeter, coaxial. Each driver has a position on
    the baffle or lid.
  - **Each band has a filter** (high-pass, low-pass; passive or active). So 2-way, 3-way, dual woofer +
    horn, MTM and similar are one model.
  - **Today's kinds become starting templates, not hard-coded types:** PA sub, mid/high box, tower, hi-fi,
    fill, monitor.
- **Space page (the system page).** It composes saved speakers freely: placement and pose, amps and channels, DSP, crossovers
  between boxes, delay and level, and the coverage map.
- **Today's PA page bundles both.** It eventually becomes a system preset.

## Current state

### Fills page

`src/pages/fills/FillsPage.tsx`, `useFillsPlanner.ts`, `fillSystem` in `src/lib/pa/calc.ts`, `fillChips` in
`src/lib/pa/chips.ts`, drivers in `src/data/catalog/fills.ts`.

- A single-box coaxial designer only: vented or sealed, ½″ walls, a "Highpass to the subs" setting (LR24 or
  LR48), one amp channel per box.
- HF is a pad and a power limit only (`pad`, `hfLimW` in `fillSystem`).
- No delay, level, placement or coverage link to the PA. No saves: the state lives in `useFillsPlanner`
  only.

### Hi-fi model

`src/lib/hifi/hifi.ts`, `src/pages/hifi/hifiDesign.ts`.

- **Has:** compression drivers on waveguides (`HIFI_WAVEGUIDES`, the 1″-exit horns in `horns.ts`), pro 8″
  woofers, sealed / vented / slot / radiator boxes, an active LR24 / LR48 crossover with separate woofer and
  tweeter amps, and a path length per driver in `hifiResponseAt`, so near-field lobing comes free. Also the
  dispersion map and the 3D scene from PR #116 (`buildHifiScene`).
- **Lacks:**
  - coaxial drivers: `driverLayout` always stacks the tweeter above the woofer (or sets it on the lid for
    a freestanding waveguide);
  - small 4–6″ horns;
  - a high-pass to a sub: `hpf` is only an automatic subsonic (0.75 × Fb, vented and radiator boxes);
  - the near field: `hifiDesign.ts` floors `seatDistanceM` at 1 m;
  - SPL and coverage targets;
  - passive, single-channel drive;
  - wedges;
  - a configurable port speed: `hifiDesign.ts` fixes `portMax: 17` m/s.

### PA layouts

Stack / pole / tower / satellite (`PaLayout` in `src/types.ts`).

- The tower's mid chamber is `{ w: subBoxDims.w, h: 15.5, d: subBoxDims.d }` (`paDesign.ts`;
  `TOWER_MID_HEIGHT_IN` in `stackHeights.ts`, and `15.5` literals in `optimize.ts` and `optimizeExact.ts`).
  The horn has its own section above it, behind one continuous baffle with internal partitions
  (`towerSpec`).
- The tower's cutlist and weight include the mid chamber and horn section (PR #122: `towerCutParts`,
  `towerMidWeightLb`).

## Near-term phases

Each PR stands alone. Lowest risk first.

- **P1 Small 1″ waveguides (data).**
  - 4–6″ round or OS waveguides in `horns.ts`, with coverage, `lowHz` and US prices. Hi-fi offers them
    through `HIFI_WAVEGUIDES` with no code change.
  - A `scope` flag so the PA optimizer (`HORN_OPTIONS` in `src/lib/pa/optimize.ts`) doesn't pick them.
  - A `hifiGuidePattern` chip: the crossover is below the waveguide's `lowHz`.
  - Golden and snapshots: unchanged.
- **P2 Engine knobs.** No UI; Hi-fi defaults unchanged.
  - `hp {hz, order}`: the high-pass to a sub.
  - `drive: active | passive`: passive ties the tweeter amp to the woofer amp through the pad, reproducing
    Fills' `hfLimW`.
  - `tiltDeg`.
  - The seat floor as a parameter, down to 0.3 m.
- **P3 Coaxials in the Hi-fi engine and 3D.**
  - `coaxParts` in `src/lib/data.ts` (derived from the fill catalog), a coincident layout in
    `driverLayout`, and a coax part in `buildHifiScene`.
  - A parity test against `fillSystem`, with documented tolerances.
- **P4 Starting templates (Hi-fi / Monitor).** No fixed roles (owner, Oct 2026). A template sets only the first
  values of a new design. A save keeps no role. Every chip shows for every design.
  - Templates in a new `src/constants/useCases.ts` set defaults and ranges.
  - Rename the project to "Speakers" (owner to confirm). Keep `#hifi`.
  - Split `HifiPage.tsx` (about 970 lines) into section components.
  - New chips: the maximum level at a distance that you set, coverage, kick, HF headroom, near-field lobing.
    No chip compares the level with a target for each use.
  - Drive: the user can select passive or active.
  - Monitors (DJ booth), two options:
    - (a) a 10–12″ coax in a small box;
    - (b) an 8″ and a 1″ compression driver on a small 4–6″ horn, crossed at about 2.5–3 kHz, mounted tight
      above the woofer. Physics caveat: an 8″ narrows to about 65° at 2.7 kHz, and a 5″ mouth only
      controls coverage above about 2.7 kHz, so it falls short of 90–100°.
  - Monitor template: a pair, one on each side of the DJ. Each monitor hangs or sits on a pedestal. They are
    not floor wedges. Distance 0.5–1.5 m, a high-pass at 70 Hz LR24 (60–80 Hz), 90–100° horizontal. No tilt
    and no wedge for now. The Space page will add aiming.
- **P5 Fill use case.**
  - Map today's fill defaults (`DEFAULT_FILL` in `src/lib/defaults.ts`) onto the page and redirect
    `#fills`. Delete `FillsPage`, `useFillsPlanner` and `fillSystem` after the P3 parity test's reference
    numbers are captured.
  - Fill goldens (`fillConfigs` in `tests/golden-configs.ts`) are replaced on purpose. The box models
    differ: ½″ walls, displacement and stuffing. Show the old and new numbers side by side in the PR.
  - Fill delay and level against the mains are new work for the Space page.
- **P6 Optimizer per use case.**
  - `kick` and `smaller` goals; SPL and coverage targets as filters.
  - Coax candidates in Fill and Monitor only; a crossover grid for monitor option (b).
  - The existing snapshot cards stay unchanged; new cases are added.
- **P7 Wedge box.** Booth monitors do not need it. Stop work on it for now.
  - First, tilt / kick-back on a rectangular box.
  - Then a true wedge: trapezoid volume, layout, cutlist bevels, 3D and front drawing.
- **P8 Optional printed DIY small horn.** Hornlab data and mesh, like `diy_os90x70`.
- **T1 Tower with the horn freestanding on top.** Do this in L3, not before (owner, Oct 2026). Do not build
  parts that the modular box model will replace. The notes below are the spec for the tower template in L3.
  It is a field, not a fifth layout:
  `hornPlacement: "baffle" | "top"`, defaulting to `"baffle"`, with a toggle shown only for Tower.
  - **Adjustable mid chamber height** (owner, Oct 2026). Today the height is 15.5″ (`TOWER_MID_HEIGHT_IN`).
    With the horn on top, the height becomes a setting. It changes the mid's volume and the tower's height.
  - **Any horn can sit on top.** This includes the full-width rectangular horns.
  - **Heights:** `stackHeights` and `towerSpec` put the horn axis above the tower lid, with no arched top.
  - **Mount:** the horn sits on the PR #114 aluminum plate or ply mount. `takesHornMount` (which today is
    false for every tower) applies when the placement is `"top"`.
  - **3D:** `buildTower` and `buildStackScene` follow.
  - **No change at the default height of 15.5″:** alignment (the mouth stays on the front plane), the
    datasheet-based acoustics, saves, goldens and the snapshot. The mid volume follows the height.
  - **Cutlist:** `towerCutParts` follows the adjustable height.
  - **Mapping:** `hornPlacement` becomes a property of any box with a horn and maps onto the speaker spec.
    The Hi-fi `WaveguideSpec.freestanding` boolean later switches to the shared type.

## Long-term phases

- **L1 Types and read adapters.** Pure and tested; no UI.
  - A general `SpeakerSpec`: id, name, cabinet
    `{chambers: [{at, dims, netLiters, vent, load, drivers: [{kind, driverId, count, position, bands, horn}]}], panel, tiltDeg}`,
    bands with their filters and drive, look. Each horn has its `placement` and `mount`. No template: a save
    keeps no role (owner, Oct 2026).
  - A `SystemSpec`: sources `{speakerId, role, pose, mirror, filters, delayMs | "auto", levelDb, channels}`,
    amps, front end (analog or digital), venue.
  - **Crossovers.** A band's filters are the box's own: the crossover inside the box and its protection. A
    crossover to another box (the sub) is on the system's source.
  - **Chambers.** Each chamber has a position in its cabinet, so chambers can sit side by side. Two chambers
    that touch share one wall: the lower (or left) chamber's.
  - **Old saves (owner policy).** Clean code comes first. Old saves can break. Read adapters map today's
    in-memory designs (`systemFromPa`, `speakerFromHifi`, `systemFromHifi`, `speakerFromFill`,
    `systemFromFill` in `src/lib/speaker/`). Do not add code only to keep old saves working: no shims for old
    fields, no migration branches for old save formats, no compatibility layers.
  - **Horns.** A chamber's load is direct or a horn built into the box: the horn engine's throat chamber and
    segments (`HornDesign`, PR #128). The chamber's net air and vent are the horn's rear chamber.
    `hornDesignOf` maps a front-loaded chamber onto `HornDesign`. Alike drivers in one throat go to the engine
    as one driver and a count (`drivers`, Hornresp's Nd). The engine wires them in parallel, and each cone
    keeps its own air load. A folded path (a bass bin) has the same segments; its fold
    layout comes later. A back-loaded or tapped horn has its own drive; the engine does not take them yet. A
    catalog horn on a compression driver is a `HornAttachment` with its `placement` (baffle or top) and its
    `mount`.
  - New `speakers` and `systems` collections under `users/{uid}`, next to `configs` (PA) and `hifiConfigs`.
    `firestore.rules` already covers every collection there (`users/{uid}/{document=**}`); no rule change.
- **L2 Speaker library.** Designer saves go to `speakers`. No import from old saves (owner policy above).
- **L3 Designer page.** One page, "Designer" for now (`#designer`), designs any single speaker. The PA sub and
  mid/high boxes, the tower and the Hi-fi speaker become starting points, not layout pickers. The general
  chamber / driver / band model replaces the per-kind acoustic models step by step. This is the biggest step.
  - **L3a (this phase).** The page with `SettingsLayout`: the name; chambers (size or net liters, stuffing,
    vent and port size, position); drivers per chamber (a catalog driver by kind, count, horn); bands with
    their filters, level and drive. A design starts empty, from a saved speaker, or from the current PA or
    Hi-fi design through the L1 adapters. The library: the `speakers` collection under `users/{uid}` (save,
    open, rename, duplicate, save over, delete). The model: `speakerResponse` in
    `src/lib/speaker/speakerResponse.ts`. The results: one response chart at 2.83 V and 1 m on fixed axes (the
    Hi-fi dB scale), the net air and Fb (or Qtc) of each chamber, and the passband level of each band.
  - **The model (L3a).** Each chamber goes through the box model of its kind: sealed and vented from
    `lib/pa/calc`, passive radiators from `lib/hifi`, and a horn in the box through `hornDesignOf` and
    `hornModel`. Each driver kind keeps the rules of the engine that its catalog table comes from (the PA
    subs and mids, the Hi-fi woofers, tweeters and coaxials). Each port keeps the rules of its engine: a PA
    letterbox slot has its fins and fold, PA tubes are flared, and a Hi-fi slot or port has neither. The
    stuffing is a setting on each chamber (`stuffingPct`); the adapters set it from each page's own rule
    (Hi-fi sealed 10%, PA mids 15%). The model applies it to every chamber in the same way, including a
    horn's rear chamber. Then each band's filters and level, and the bands summed with their phase. The
    response is on axis at 1 m in half space. It does not include the baffle step, diffraction, the room,
    directivity or the driver positions.
  - **Parity (L3a).** `tests/speaker-response.test.ts` compares the model with today's engines.
    - Hi-fi (8 designs): each band within 0.05 dB, the sum within 0.1 dB (the Hi-fi sum leaves out the box
      phase), and the net air and Fb or Qtc exact.
    - PA (every golden design), with the net air set to today's: every band within 0.05 dB, Fb and the mid's
      Qtc exact (slots, tubes and side ducts).
    - PA, with the net air from the size: the model takes a 3% bracing allowance, where the PA counts its
      braces, vent walls and hardware. The difference is up to 0.5 dB on the sub and 0.35 dB on the mid.
    - The PA top box and the tower sum their bands with phase round each crossover, the same as a sum built
      from the engines.
    - Gaps: a Hi-fi design with a sub highpass keeps the box's subsonic in the spec (the Hi-fi engine drops
      it; see L4). Drivers of different models in one chamber are a named gap.
  - **L3c Cutlist.** L3c works out the real bracing, vent walls and hardware displacement for each chamber and
    replaces the 3% allowance.
  - **L3d Inductance, limits and chips.**
    - **Voice-coil inductance.** Every T/S model reads the catalog's `Le`: the sealed, vented and passive-radiator
      box models, the exact PA search and the horn engine. They share one rule, `coilFactor` in
      `src/lib/acoustics/driverCircuit.ts`: the coil is Re + jωLe, as in Hornresp. A driver with `Le` rolls off at the
      top. A driver without `Le` gives the same numbers as before.
    - **Limits.** `speakerLimits` in `src/lib/speaker/speakerLimits.ts` works out each band's limits from the
      response's chamber runs (no box model runs again). It uses the pages' own limit code:
      - Cones: the PA's `sineLimitAt` (`maxOutputCurve` for each point): Xmax and the port air speed at each
        frequency, and the program rating (2 × AES) and the amp across the whole drive. Radiators add their travel,
        as the Hi-fi engine checks it.
      - Datasheet drivers keep their engine's power rule: a compression driver the PA's `hornPower`, a tweeter and a
        coaxial's HF section the Hi-fi's `tweeterMaxLevel`.
      - Each band has its amp power (`SpeakerBand.ampW`). A passive band gets the channel it shares, through its pad.
      - A band's maximum for music is one drive for the whole band, set where the band first meets a limit. The sum
        takes one input for every band: at each frequency, the band with the least headroom sets it.
      - A vent takes the Hi-fi engine's 17 m/s; flared PA tubes take the PA's 30/23.5 more.
    - **Results.** A maximum-output chart on its own fixed scale (70–140 dB, `MAX_OUTPUT_TOP` / `MAX_OUTPUT_BOT`),
      the maximum of each band and of the speaker, and chips: one list for each band (what sets its level, a
      datasheet driver's power) and one for each chamber (Xmax, port speed and radiator travel at full power, and the
      program rating).
    - **Parity** (`tests/speaker-limits.test.ts`). With the net air set to the PA's, every golden PA design meets the
      PA page's limits. The sub through its lowpass is within 0.06 dB, and the mid and horn within 0.01 dB. The horn's
      power is exact. The sub's music limit is within 0.02 dB, with the same limit. On the Hi-fi designs with no
      baffle-step EQ, the woofer's drive at its limit is within 0.2 dB from 30 Hz to a third of the crossover. The
      tweeter's power is exact. Above that range the engines differ: the Hi-fi divides the coil's rating by the
      lowpass, and the PA and the model do not.
  - **Later in L3.** The 3D view and the optimizer; the horn settings; the tower with the horn on top (T1).
- **L4 Space page.** A separate page, later. Any saved speaker can be placed in a "Space": sources by speaker
  id, amps and channels, DSP, crossovers between boxes, delay and level, and the coverage map generalized
  from `CoverageStack` to a list of sources. The baffle step, the room and the positions of the drivers come
  in here. The PA page becomes a system preset.
  - **Sub highpass and subsonic.** When a sub highpass covers the box's subsonic, the box's subsonic is
    dropped; below 0.75 × Fb both stay. This rule comes with the Space page.
  - Amps and DSP start from the owner's v1 rig: [amp-dsp-v1.md](amp-dsp-v1.md).
  - **Weight limit per box.** In the modular planner the weight limit becomes a manual setting on each box (it
    replaces today's fixed 125 lb sub check in `src/lib/pa/chips.ts`). The user sets the limit for the box
    they're working on; no automatic tower or layout rule sets it.

## Branches

- The revamp lives on the parent branch `designer`. Each phase is a sub-branch from `origin/designer` (for
  example `designer-l3a`), and its PR has the base `designer`.
- `main` must not break. `designer` merges into `main` only when the owner approves it.

## Risks

- Fill numbers shift in P5.
- Near-field accuracy at 0.5 m for big coaxes.
- Optimizer runtime with coax candidates.
- Page complexity: split `HifiPage.tsx` first.
- Passive maker networks (3rd order) can't be expressed as `CrossoverOrder` (4 | 8).
- The tall tower with a loose horn on top: tipping, and securing the horn.

## Owner decisions (Oct 2026)

- Monitor drive: the user can select passive or active.
- No target level for each use. Show the maximum level at a distance that you set.
- No fixed roles. A template sets only the first values. A save keeps no `use`.
- Booth monitors are a pair. They hang or sit on pedestals. No tilt and no wedge for now.
- Tower with the horn on top: the mid chamber height is adjustable, and any horn can sit on top. Do this in
  L3, not before.
- The page is called "Designer" for now, not "Speakers".
- One Designer page designs all speakers. Templates (starting points) replace the layout pickers, so the
  tower needs no "Horn" toggle or separate picker entry.
- Simulation in a real space is a separate page later (the Space page). Any speaker can be placed there.
- The fill delay against the mains belongs to the Space page.
- The Designer's response chart is a 2.83 V, 1 m sensitivity chart on the Hi-fi dB scale (50–130 dB). Its
  maximum-output chart has its own fixed scale (70–140 dB, L3d).
- The spec's ports carry the PA port details (the letterbox's fins and fold, the flared tubes), so the PA subs
  match the PA page exactly.
- Stuffing is a visible setting on each chamber. The model has no hidden stuffing rule. The 3% bracing
  allowance stays until L3c.
- The sub highpass and subsonic rule waits for the Space page.

## Open questions for the owner

1. Show coaxials in the Hi-fi starting point (template)?
2. Coaxials with no published HF data: model the woofer only, with a chip, or hide them?
3. Which small horns to research first?
