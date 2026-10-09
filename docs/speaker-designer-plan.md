# Speaker designer: plan (branch `speaker-designer-plan`)

One page designs any single box and saves it to a library. A system page composes saved boxes. This plan
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
- **System page.** It composes saved speakers freely: placement and pose, amps and channels, DSP, crossovers
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
- Known tower bug, tracked in a comment on issue #92: `cutParts` skips the mid chamber and horn section
  (it lists only the sub box), and `midWeightLb` leaves out the horn section.

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
- **P4 Use-case selector (Hi-fi / Monitor).**
  - Use-case presets in a new `src/constants/useCases.ts` set defaults, ranges, targets, chips and goals.
  - Rename the project to "Speakers" (owner to confirm). Keep `#hifi`.
  - Split `HifiPage.tsx` (about 970 lines) into section components.
  - New chips: target level, coverage, kick, HF headroom, near-field lobing.
  - An optional `use` in saves. Old saves restore as Hi-fi.
  - Monitors (DJ booth), two options:
    - (a) a 10–12″ coax in a small box or wedge;
    - (b) an 8″ and a 1″ compression driver on a small 4–6″ horn, crossed at about 2.5–3 kHz, mounted tight
      above the woofer. Physics caveat: an 8″ narrows to about 65° at 2.7 kHz, and a 5″ mouth only
      controls coverage above about 2.7 kHz, so it falls short of 90–100°.
  - Monitor preset: 0.5–1.5 m away, a 105–115 dB target, a high-pass at 70 Hz LR24 (60–80 Hz), 90–100°
    horizontal, a pair either side of the DJ.
- **P5 Fill use case.**
  - Map today's fill defaults (`DEFAULT_FILL` in `src/lib/defaults.ts`) onto the page and redirect
    `#fills`. Delete `FillsPage`, `useFillsPlanner` and `fillSystem` after the P3 parity test's reference
    numbers are captured.
  - Fill goldens (`fillConfigs` in `tests/golden-configs.ts`) are replaced on purpose. The box models
    differ: ½″ walls, displacement and stuffing. Show the old and new numbers side by side in the PR.
  - Fill delay and level against the mains are new work for the system page.
- **P6 Optimizer per use case.**
  - `kick` and `smaller` goals; SPL and coverage targets as filters.
  - Coax candidates in Fill and Monitor only; a crossover grid for monitor option (b).
  - The existing snapshot cards stay unchanged; new cases are added.
- **P7 Wedge box.**
  - First, tilt / kick-back on a rectangular box.
  - Then a true wedge: trapezoid volume, layout, cutlist bevels, 3D and front drawing.
- **P8 Optional printed DIY small horn.** Hornlab data and mesh, like `diy_os90x70`.
- **T1 Tower with the horn freestanding on top.** A field, not a fifth layout:
  `hornPlacement: "baffle" | "top"`, defaulting to `"baffle"`, with a toggle shown only for Tower.
  - **No mid volume change:** the horn already has its own section.
  - **Heights:** `stackHeights` and `towerSpec` put the horn axis above the tower lid, with no arched top.
  - **Mount:** the horn sits on the PR #114 aluminum plate or ply mount. `takesHornMount` (which today is
    false for every tower) applies when the placement is `"top"`.
  - **3D:** `buildTower` and `buildStackScene` follow.
  - **Unchanged:** alignment (the mouth stays on the front plane), the datasheet-based acoustics, the
    optimizer, saves, goldens and the snapshot.
  - **Cutlist:** fold in the #92 tower cutlist fix.
  - **Mapping:** `hornPlacement` becomes a property of any box with a horn and maps onto the speaker spec.
    The Hi-fi `WaveguideSpec.freestanding` boolean later switches to the shared type.

## Long-term phases

- **L1 Types and read adapters.** Pure and tested; no UI.
  - A general `SpeakerSpec`: id, name, template / use, cabinet
    `{chambers: [{dims or volume, vent, drivers: [{driverId, type, position, count}]}], shape: upright | wedge, tiltDeg, panel, material}`,
    bands / filters, look; `hornPlacement` and `hornMount` per horn.
  - A `SystemSpec`: sources `{speakerId, role, pose, mirror, filters, delayMs | "auto", levelDb, amp channel}`,
    amps, DSP, venue.
  - Migration is read-time adapters only (`speakerFromSavedHifi`, `systemFromSavedPa`). Stored docs are
    never rewritten.
  - New `speakers` and `systems` collections under `users/{uid}`, next to `configs` (PA) and `hifiConfigs`.
    `firestore.rules` already covers every collection there (`users/{uid}/{document=**}`); no rule change.
- **L2 Speaker library.** Designer saves go to `speakers`, with import from old saves.
- **L3 PA sub and mid/high boxes become designer templates.** The general chamber / driver / band model
  replaces the per-kind acoustic models step by step. This is the biggest step.
- **L4 System page.** Sources by speaker id, amps and channels, DSP, crossovers between boxes, delay and
  level, and the coverage map generalized from `CoverageStack` to a list of sources. The PA page becomes a
  system preset.

## Risks

- Fill numbers shift in P5.
- Near-field accuracy at 0.5 m for big coaxes.
- Optimizer runtime with coax candidates.
- Page complexity: split `HifiPage.tsx` first.
- Passive maker networks (3rd order) can't be expressed as `CrossoverOrder` (4 | 8).
- The tall tower with a loose horn on top: tipping, and securing the horn.

## Open questions for the owner

1. Monitor drive: passive or active?
2. Monitor SPL target: peak or continuous, one box or the pair? What is the fill target?
3. Save the use case with each design? Recommended: yes.
4. Is a tilted upright box enough before a true wedge?
5. One monitor or a pair by default?
6. Show coaxes in the Hi-fi use case?
7. Name: "Speakers"?
8. Coaxials with no published HF data: model the woofer only, with a chip, or hide them?
9. Fill delay against the mains: wait for the system page, or add a small calculator now?
10. Which small horns to research first?
11. Tower with the horn on top: keep the mid chamber fixed at 15.5″ or make it adjustable? Allow the
    full-width rectangular horn on top? Fix the tower weight too (it changes the "lil tower" golden)?
12. Wording: "Tower" with a "Horn" toggle, or a separate "Tower, horn on top" picker entry?
