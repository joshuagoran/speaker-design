# Speaker page: plan (parent branch `designer`)

One page, the Speaker page, designs any single box and saves it to a library. A later Stack page joins boxes in
a fixed relationship, and a Space page places stacks and boxes in a real space. This plan
gets there in small PRs: near-term phases on today's Hi-fi engine first, then the general model.

## Goal (owner's vision)

- **Speaker page.** One page designs any single box and saves it to a library.
  - **Drivers combine freely in a cab.** A cabinet is one or more chambers, each with its own volume and
    vent (sealed, ported, slot, passive radiator). Each chamber holds any number of drivers of any type:
    woofer, mid, horn or waveguide on a compression driver, tweeter, coaxial. Each driver has a position on
    the baffle or lid.
  - **Each band has a filter** (high-pass, low-pass; passive or active). So 2-way, 3-way, dual woofer +
    horn, MTM and similar are one model.
  - **Today's kinds become starting templates, not hard-coded types:** PA sub, mid/high box, tower, hi-fi,
    fill, monitor.
- **Stack page.** It joins saved speakers in a fixed relationship: relative positions, crossovers between boxes,
  delays and levels.
- **Space page.** It places stacks and speakers freely: the room, left and right pairs, the amp power of each
  band, the alignment to set, and the coverage and level model.
- **Today's PA page bundles all three.** It eventually becomes a stack preset.

## Current state

### Fills page

`src/pages/fills/FillsPage.tsx`, `useFillsPlanner.ts`, `fillSystem` in `src/lib/pa/calc.ts`, `fillChips` in
`src/lib/pa/chips.ts`, drivers in `src/data/catalog/fills.ts`.

- A single-box coaxial design only: vented or sealed, ½″ walls, a "Highpass to the subs" setting (LR24 or
  LR48), one amp channel per box.
- HF is a pad and a power limit only (`pad`, `hfLimW` in `fillSystem`).
- No delay, level, placement or coverage link to the PA. No saves: the state lives in `useFillsPlanner`
  only.

### Hi-fi model

`src/lib/hifi/hifi.ts`, `src/lib/hifi/hifiDesign.ts`.

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
  - A `scope` flag so the PA optimizer (`HORN_OPTIONS` in `src/lib/pa/optimize.ts`) does not pick them.
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
  - A `SystemSpec` (split into `StackSpec` and `SpaceSpec` in L4a): sources `{speakerId, role, pose, mirror, filters, delayMs | "auto", levelDb, channels}`,
    amps, front end (analog or digital), venue.
  - **Crossovers.** A band's filters are the box's own: the crossover inside the box and its protection. A
    crossover to another box (the sub) is on the stack member (`StackMember.crossover`, L4a).
  - **Chambers.** Each chamber has a position in its cabinet, so chambers can sit side by side. Two chambers
    that touch share one wall: the lower (or left) chamber's.
  - **Old saves (owner policy).** Clean code comes first. Old saves can break. Read adapters map today's
    in-memory designs (`layersFromPa`, `speakerFromHifi`, `layersFromHifi`, `speakerFromFill`,
    `layersFromFill` in `src/lib/speaker/`). Do not add code only to keep old saves working: no shims for old
    fields, no migration branches for old save formats, no compatibility layers.
    - **One exception** (owner, Oct 2026). The PA and Hi-fi pages go away at L3f, so their saves get one read
      adapter. It opens an old PA or Hi-fi save as speakers and a stack. The policy above still holds for all
      other saves.
  - **Horns.** A chamber's load is direct or a horn built into the box: the horn engine's segments (`HornDesign`,
    PR #128). The chamber's net air and vent are the horn's rear chamber. The front chamber is not a setting: the
    side walls start narrower than the cones, their back edges over the cones' outer parts and just clear of full
    cone travel, and the air under the edges is the front chamber (`lib/speaker/hornThroat`, below).
    `hornDesignOf` maps a front-loaded chamber onto `HornDesign`. Alike drivers in one throat go to the engine
    as one driver and a count (`drivers`, Hornresp's Nd). The engine wires them in parallel, and each cone
    keeps its own air load. A folded path (a bass bin) has the same segments; its fold
    layout comes later. A back-loaded or tapped horn has its own drive; the engine does not take them yet. A
    catalog horn on a compression driver is a `HornAttachment` with its `placement` (baffle or top) and its
    `mount`.
  - New `speakers` and `stacks` collections under `users/{uid}`, next to `configs` (PA) and `hifiConfigs`.
    `firestore.rules` already covers every collection there (`users/{uid}/{document=**}`); no rule change.
- **L2 Speaker library.** Speaker page saves go to `speakers`. No import from old saves (owner policy
  above), except the PA and Hi-fi pages' saves: one read adapter at L3f.
- **L3 Speaker page.** One page, "Speaker" (`#speaker`), designs any single speaker. The PA sub and
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
    - Hi-fi (8 designs), with the net air set to the Hi-fi engine's: each band within 0.05 dB, the sum within
      0.15 dB (the Hi-fi sum leaves out the box phase), and Fb or Qtc exact. From the size (L3c), the net air is
      the Hi-fi engine's plus its 3% allowance, exactly: these boxes need no braces.
    - PA (every golden design), with the net air set to today's: every band within 0.05 dB, Fb and the mid's
      Qtc exact (slots, tubes and side ducts).
    - PA, with the net air from the size (L3c): the sub's net air is the PA's exactly. The mid's is 1.0% to 2.7%
      less (it counts its baffle cleats, which the PA's mid leaves out; up to 0.13 dB), and 3.7% less in the
      tower (its mid chamber also takes the rule's braces, which the PA page leaves out).
    - The PA top box and the tower sum their bands with phase round each crossover, the same as a sum built
      from the engines.
    - Gaps: a Hi-fi design with a sub highpass keeps the box's subsonic in the spec (the Hi-fi engine drops
      it; see L4). Drivers of different models in one chamber are a named gap.
  - **L3b 3D view and front drawing.** One scene builder draws any spec: `buildSpeakerScene`
    (`src/components/stack-view/`). A front drawing, `SpeakerFront`, draws the same parts in 2D.
    - Both reuse the PA and Hi-fi parts. Both read one layout: `lib/speaker/speakerLayout`.
    - Chambers sit at their `at` positions. Drivers sit at their positions, with their horns.
    - A horn sits in the baffle (as in the tower) or on the top (as on the mid box).
    - Each port follows its engine's rule. PA: the letterbox, side ducts and flared tubes. Hi-fi: round ports, slots
      and radiators.
    - Chambers that fill one box of one depth share one shell and one baffle. Their shared walls are inside.
    - Other chambers that touch form a stepped shell. Each builds only its own walls: the lower (or left) chamber's
      wall is the one partition. An overhang keeps its own floor past the chamber under it.
    - A chamber that touches no other is its own box.
    - The cabinet's construction sets the style (L3e): the PA frame, or the Hi-fi box and its roundover.
    - A horn-loaded chamber shows its mouth on the baffle and the path behind it, from one geometry
      (`lib/speaker/hornGeometry`, by `hornFlare`) that the 3D view, the front view, the side and top sections and the
      bracing's keep-out all read. Each section's shape comes from its segment's flare law and how that law is
      built, from the mouth back: a parabolic segment keeps its height (a parallel top and bottom) and its flat side
      walls angle out in straight lines; an exponential one keeps its height and its side walls curve; a conical one
      grows on both sides together, as a pyramid. Each segment starts with the shape the one before it ends with, so
      the walls kink at a joint and never step. The areas at the throat, the mouth and every segment's end are the
      model's, and the path is the segments' length. The walls start at the throat, just in front of the cones; where
      the throat is narrower than the cones, their back edges cover the cones' outer parts (the front view draws the
      edges across the cones' outlines). The drivers' bay behind the throat is the front chamber, as deep as the
      walls' clearance; the drivers' bodies stand behind it.
    - A folded path runs in legs along the depth, stacked up the box, as few folds as fit. A path that does not fit
      (folded or not) is drawn as it is, past the walls, and a note gives what it needs and what the chamber has.
    - A mouth larger than the face its chamber leaves it (the clear face, less the columns of side slots) is drawn at that
      face. A note says so.
    - Not drawn yet: the aim (see the owner decisions) and the PA plinth. The arched top draws in 3D on a PA frame
      with one shell, over a top chamber that runs the full width and is at least half the width tall
      (`drawsArchedTop`, L3e). The front drawing and the Hi-fi box draw it flat.
    - Known issue: a horn-loaded chamber's vent draws in the wrong place. The vent rules place its ports and slots as
      for a direct box, for example a slot across the bottom that runs through the horn's mouth. The vent of a horn
      chamber goes where the rear chamber is (for example slots in the sides). "Horn bin construction" (below) fixes
      it.
  - **L3e Templates.** The templates step adds these cabinet settings:
    - A top shape: `flat` or `arched`. Then the PA tower's arched top draws and cuts correctly.
    - A "Construction" setting: "Frame and inset baffle" (the PA style) or "Flush box" (the Hi-fi style). Before,
      the inset alone set the style, so a PA box with no inset drew as a Hi-fi box. This setting replaces that
      rule.
    - Movable ports and driver openings (see the owner decisions).
    - **Templates (done).** The "Start from" picker lists the templates first, then the designs you have now (the
      current Hi-fi design, the PA design's sub and mid/high box, or its tower). A template builds a new spec from the
      catalog and the defaults (`src/pages/speaker/speakerTemplates.ts`). It sets only the first values. The spec
      keeps no template or role.
      - PA sub, PA mid/high box: the PA page's starting design (`DEFAULT_PA`) through `layersFromPa`.
      - PA tower, horn in the baffle: the PA page's tower, with its arched top.
      - PA tower, horn on top (T1): the PA tower's sub and mid chamber, the horn on the mid chamber's lid, its mouth on
        the front plane, a flat top. The mid chamber starts at `TOWER_MID_HEIGHT_IN`; its height is the chamber's
        height setting, so it sets the mid's air and the tower's height. Any horn can sit there. The horn mount
        applies where the driver bolts straight to the horn (`takesHornMountAt`).
      - Hi-fi 2-way and Fill: the Hi-fi and Fills pages' starting designs through their adapters.
      - DJ booth monitor (`DEFAULT_MONITOR`): a 10″ coaxial (100°) in the fill's box, or an 8″ with a 1″ compression
        driver on a small 90° horn in the baffle, crossed at 2.5 kHz. Both have the input range's 70 Hz LR24
        high-pass. A pair, hung or on pedestals, is the Space page's (no field for it).
      - PA v2 sub bin (`PA_V2_SUB_BIN`, one or two 18″): one front-loaded horn chamber, the drivers stacked in one
        throat (the engine's `drivers`), a straight-sided flare: the box's own top and bottom, two flat side walls
        that angle out from the throat (a 2:1 compression ratio, the walls over the cones' outer parts) to a mouth
        that fills the face between the slots. Its area grows linearly: one parabolic section, at the box's inside
        height. Net rear air set (~324 L for two), a slot
        on each front side, folded, tuned to ~35 Hz, a 30 Hz BW24 subsonic.
      - PA v2 mid box (`PA_V2_MID_BOX`): two 10″ in one throat at a 2:1 compression ratio and an exponential flare
        (flat top and bottom, curved side walls), its mouth the face between the slots at the box's inside height,
        ~34 L rear air, side slots, tuned to ~95 Hz, crossed at the R-OSSE's lowest crossover.
      - The PA v2 slots store their narrow size as the height and their long side as the width, in sizes of ⅛″. The
        model reads only the area and the rectangle. The slot settings show the count, the narrow side, the long side
        (where the slot sets one) and the length. "Auto" net air counts each slot and its shelf.
      - The side slots draw up the front sides (`place` on the slot, `SLOT_PLACE`), beside the mouth. A slot's place is
        not a setting yet. Later, with movable ports: "Auto" net air takes off the air of a horn's flare (today a horn
        chamber's net air is set).
      - A horn mouth that a square would make taller than the clear face draws wider than square, up to the clear
        width. The PA v2 bins' mouths then fit the face.
    - **Cabinet settings (done).** A "Construction" fold: the construction, the baffle inset (a frame only) and the
      top. A note says when an arched top cannot draw. In each chamber, a Hi-fi round port, passive radiators and a
      horn's mouth have a position: "Auto" (the vent rule places it, and the fields show where) or "Custom" (a panel
      for a vent, then "From left" and "From bottom", as the chamber's own position). Each driver entry shows its
      position too. The moved notices say when a set position moves inside the clear face.
    - **The spec fields (done).**
      - `SpeakerCabinet.construction` (`CABINET_CONSTRUCTION`): `frameInset` or `flushBox`. The 3D view reads it,
        not the inset. A flush box has no inset (`baffleInsetIn`), in the model and the views.
      - `SpeakerCabinet.top` (`CABINET_TOP`): `flat` or `arched`. The arch is a semicircle the full width, as
        `towerSpec` builds it.
      - A Hi-fi round port and a radiator vent can have a `position`: a panel (baffle or back) and the center of the
        group, as a driver's position. Absent: the vent rule places it. Flared PA tubes cannot have one (the type
        forbids it).
      - A horn in the box can have a `mouthPosition` on the baffle. Absent: the mouth is on the center of the clear
        face. A back-loaded horn needs it, because its drivers are on the baffle too.
      - A set position past the clear face moves inside it, to the nearest place that fits. The page shows a notice.
      - A port at a set position folds inside its chamber. In the upper half, its riser goes down. On the back, it
        runs from the back to the inside face of the baffle. The model's elbow count still uses the Hi-fi rule's row
        along the bottom.
      - The PA adapter gives `frameInset` (an inset of 0 too). The tower's top is `arched` where `towerSpec` arches
        it. The Hi-fi and fill adapters and the empty speaker give `flushBox` and a flat top. No adapter sets a
        position: every page places its vents by a rule.
      - Not movable: side ducts and the PA letterbox (their place is their shape), flared PA tubes (their place is
        part of the PA tube rule), and a Hi-fi slot (the model takes it along the bottom, with one shelf).
  - **L3f Switch-over** (owner decisions, Oct 2026, #150). The PA page becomes a stack preset and the Hi-fi page
    goes away. Then `designer` merges into `main`.
    - **Parity rule** (owner, Oct 2026). `designer` does not merge into `main` until the Speaker, Stack and Space
      pages do everything the PA page and the Hi-fi page do (the two parity tables below). The PA page goes last,
      after parity. Every feature with no home moves before the merge: each open row of both tables blocks it.
    - **Optimizer** (owner, Oct 2026): "maybe we need to rethink the optimizer overall". There is no "Optimize"
      button on the presets and no `origin` field for now. The PA and Hi-fi optimizers stay on their pages until the
      rethink (see "Optimizer rethink" below) gives them a new home.
    - The Space page replaces the Coverage page. `tests/space-coverage.test.ts` checks the Space page against the
      Coverage page (see "Parity" in L4b).
    - The PA project's Fills and Cutlist tabs go away, and the Hi-fi cutlist goes with the Hi-fi page. Fills become
      Speaker presets. The Speaker project keeps its Cutlist tab.
    - Old PA and Hi-fi saves open through one read adapter, as speakers and a stack (the exception in L1's "Old
      saves"). The Stack page lists them.
    - **Band levels in the preset** (owner decision). The PA page goes away, so it is not the source of the levels.
      Today `paSpec` sets each band's Level to 0 dB (the horn takes the tilt), from a 2.83 V input. This is not the
      PA page's music balance: on the Space page the horn plays 11.3 dB and the mid 1.8 dB away from it. When the PA
      design becomes a preset, calculate the music balance once and save it in each band's Level in the preset
      data. An "Auto balance" button on the Speaker and Stack pages sets the band Levels for any design: flat by
      default, or with the PA music tilt (done: see "Auto balance" in L4b).
    - **First page** (owner, Oct 2026). When the PA page goes, the app opens on the Stack page with the PA preset.
    - **Notes** (owner, Oct 2026). The Notes page becomes a static "Notes" tab in the Space project. Later, the Space
      gets a rich-text notes field.
    - **Weight check** (owner, Oct 2026). The fixed 125 lb sub check goes with the PA page. A weight limit stays only
      as an optimizer limit ("optimize up to a maximum weight").
    - **Sub-PRs.** (1) Move the pure PA and Hi-fi code into `lib` (#154). (2) The old-save read adapter and its list
      on the Stack page. (3) The music balance in the PA preset's band Levels, the Stack presets (PA stack, pole,
      satellite, tower; Hi-fi pair), and the Space page reads the preset. Then one PR for each parity row or group,
      in the table's order. Last: remove the Hi-fi, Fills, Coverage and PA pages, open on the Stack page, and merge
      into `main`.
    - Order: first the rename to the Speaker page (done), then L3f and the #150 UI fixes in parallel.
    - **Feature parity: the PA page.** "Home" is the page that takes the feature. Status: done, partial or to do.

      | Feature (today)                                                    | Home                                                                                           | Status                                               |
      | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
      | Layouts: stack, pole, satellite, tower                             | Stack presets (and Speaker templates for the boxes)                                            | Templates done; presets in sub-PR 3                  |
      | Sub, mid, horn settings (driver, box, vent, highpass, amp)         | Speaker: chambers, drivers, bands                                                              | Done                                                 |
      | Crossovers (sub to mid, mid to horn)                               | Speaker bands (in the box), Stack crossovers (between boxes)                                   | Done                                                 |
      | Music balance (mid below sub, horn below mid)                      | Band Levels in the preset; "Auto balance" on the Speaker and Stack pages                       | Done                                                 |
      | Build: bracing, back joint, inset, top                             | Speaker "Construction" fold                                                                    | Done                                                 |
      | Plywood size of the walls (the baffles stay 3/4 in)                | Speaker "Construction" fold (the spec has `cabinet.panel`)                                     | Done: the "Wall panels" setting                      |
      | Plywood size of the side ducts' dividers                           | Speaker chamber vent settings                                                                  | Done: the side ducts' "Dividers" setting             |
      | Warning: the horn's throat and the driver's exit differ            | Speaker driver chips                                                                           | Done: a notice under the horn in the driver settings |
      | Handles, input dish, horn posts                                    | Speaker "Construction" fold (the spec has `cabinet.hardware`)                                  | Done: the "Hardware" setting                         |
      | Look: finish, baffle color, horn color                             | Speaker "Look" fold                                                                            | Done                                                 |
      | Horn mount (aluminum plate or ply)                                 | Speaker horn settings                                                                          | Done: the "Horn mount" setting on the driver         |
      | Response and maximum output (sub, mid, horn)                       | Speaker charts                                                                                 | Done                                                 |
      | System chart (the bands summed)                                    | Stack response and maximum output                                                              | Done                                                 |
      | Chips: Xmax, port speed, power, keep-up at the crossovers          | Speaker band and chamber chips; Stack for the crossovers between boxes                         | Done: keep-up chips (`tests/keep-up`)                |
      | Chips: duct fit, hardware fit                                      | Speaker chamber chips                                                                          | Done: chamber fit chips (`tests/speaker-fit-chips`)  |
      | 125 lb sub check                                                   | Dropped (owner): a weight limit only as an optimizer limit                                     | Dropped                                              |
      | 3D stack view (cutaway, full screen)                               | Stack: a 3D view of the members                                                                | Done: the members in 3D (`tests/stack-scene`)        |
      | Dispersion map                                                     | Speaker (one box) and Stack (the members together)                                             | Done: one map (`tests/stack-dispersion`)             |
      | Totals: price, weight, stack height                                | Speaker: price and weight; Stack: the sum and the height                                       | Done (see "Totals" below)                            |
      | Details: bracing per box, panels under the target                  | Speaker "Price, weight and bracing"                                                            | Done                                                 |
      | Saved designs                                                      | Stack library (`stacks`); old saves through the adapter                                        | Library done; adapter in sub-PR 2                    |
      | Seed import (`data/configs-seed.json`)                             | Dropped with the PA page: a seed a user imported is in `configs` and opens through the adapter | Sub-PR 2                                             |
      | Optimizer: goals, limits, locks, cards, driver compare             | See "Optimizer rethink"                                                                        | Stays on the PA page until the rethink               |
      | Phone summary strip                                                | Stack page on phones                                                                           | Done: the stack strip (`tests/stack-summary`)        |
      | Coverage map: stacks, toe-in, listener, bands                      | Space                                                                                          | Done                                                 |
      | Target level                                                       | Space                                                                                          | Done                                                 |
      | "Measured at" (listener, 1 m from the stacks, audience)            | Space: the same three choices, the audience average as the PA page counts it                   | Done: "Measured at" (`tests/space-balance`)          |
      | Subs in the stacks, center pair, one center sub                    | Space: place the sub (and any speaker) from the Place list                                     | Done: the sub is placed like any speaker             |
      | Mirror pair, ear height, room, materials, crowd                    | Space                                                                                          | Done                                                 |
      | Sub delay to the mids                                              | Stack auto delay                                                                               | Done                                                 |
      | Listener response with the music-balance target curve              | Space listener response, with the target curve                                                 | Done: the target curve ("Music balance")             |
      | "Turned down to balance" (each band's pad)                         | Space levels (each band's level at the listener)                                               | Done: each band's level and target                   |
      | Amp power table (power each channel needs)                         | Space "Amp power and alignment" fold: one amp power per band, no table                         | Done: one amp power per band (`tests/space-saves`)   |
      | Assumptions list                                                   | Space, below the map                                                                           | Done: under the map                                  |
      | Cutlist of one box                                                 | Speaker Cutlist tab                                                                            | Done                                                 |
      | Cutlist of the whole stack (both boxes on the same sheets)         | Stack: a Cutlist tab that packs every member's parts                                           | Done: the Stack Cutlist tab (`tests/stack-cutlist`)  |
      | Bought parts                                                       | Speaker Cutlist parts table (#150)                                                             | With #150                                            |
      | Fills page (coaxial fill box)                                      | Speaker "Fill" template                                                                        | Done                                                 |
      | Fill chips (HF pad and power limit)                                | Speaker band chips                                                                             | Done: the HF pad chip (`tests/speaker-fill-chips`)   |
      | Fill delay and level to the mains                                  | Space: Auto Delay and Level. Mains meet at the alignment point. A fill plays 5 ms late.        | Done (`tests/space-solve-feeds`)                     |
      | Notes: racks, signal path, amps, DSP, passive crossover, materials | Space "Notes" tab (static); rich text later                                                    | Done: the Space "Notes" tab                          |

    - **Totals** (`lib/speaker/speakerTotals`, `tests/stack-totals.test.ts`). The Speaker page shows the price and
      the weight. The price is the total of the Cutlist tab's purchased parts: the drivers, the horns, the radiators,
      the port tubes and elbows, and the hardware. It does not include the plywood, as the PA page's totals do not. A
      part with no price adds the "+" mark and the Cutlist tab's note. The Stack page shows the members' price and
      weight, and the height from the stack's base to its highest point (`stackLayout` and the front drawing's span).
      For each PA preset, the price is the PA page's (`lib/pa/totals` `paTotals`). The weight and the height have these
      differences only: the PA page adds the plinth (6 lb, 3 in) and 1 lb for the horn's fixings, and it leaves out
      the braces in the tower's mid chamber.
      - Owner decisions (Oct 2026): the Stack page's height and weight do not include the plinth, for now. The plinth
        stands under the stack on the Space page, and the totals note says so. The Speaker page's weight does not add
        the PA page's 1 lb for the horn's fixings.

    - **Feature parity: the Hi-fi page.**

      | Feature (today)                                           | Home                                                    | Status                                            |
      | --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
      | Woofer, tweeter, waveguide, coaxial, box, vent, radiators | Speaker                                                 | Done                                              |
      | Crossover (frequency and order), amps                     | Speaker bands                                           | Done                                              |
      | Roundover, tweeter offset                                 | Speaker cabinet and driver positions                    | Done                                              |
      | Sensitivity and maximum output charts                     | Speaker                                                 | Done                                              |
      | Baffle-step compensation (`bsc`, a shelf)                 | Speaker: a shelf filter on a band                       | To do (`speakerFromHifi` drops it)                |
      | Baffle diffraction ripple                                 | Speaker response (the model has no baffle step yet)     | To do                                             |
      | Near-field results at the seat                            | Space listener response (baffle step, driver positions) | Partial                                           |
      | Placement, wall distance, spacing, toe-in, seat           | Space (from the Hi-fi preset)                           | Model done (`layersFromHifi`); preset in sub-PR 3 |
      | Dispersion map                                            | Speaker                                                 | To do                                             |
      | 3D view                                                   | Speaker                                                 | Done                                              |
      | Chips (waveguide pattern, coverage, HF headroom)          | Speaker band chips                                      | Partial                                           |
      | Cutlist                                                   | Speaker Cutlist tab                                     | Done                                              |
      | Saved designs                                             | Old saves through the adapter                           | Sub-PR 2                                          |
      | Optimizer                                                 | See "Optimizer rethink"                                 | Stays on the Hi-fi page until the rethink         |

    - **Optimizer rethink** (owner, Oct 2026; planned).
      - **Today: the PA optimizer** (`lib/pa/optimize`, `optimizeExact`; `docs/optimizer-plan.md`).
        - Inputs. It starts from the current PA design. The user taps goals in order: cheaper, lighter, lower,
          louder. A room size (500, 750 or 1000 sq ft, or outdoors) sets the output target. The limits are a maximum
          weight per box and a budget. Locks hold 11 parts and settings. Each box size has a lock per axis: free,
          exact or a maximum.
        - Search: a quick search (screen sub, volume, tuning and highpass; build real boxes and vents; add mids,
          crossovers and horn pairs; check the finalists with the page's own code) and a full search over a stated
          grid ("Fully optimize").
        - Outputs. It shows up to three cards: the best for the first goal, and alternatives. Each card is better
          than your design on its label. Near-miss notes say how close a design came. A driver comparison lists the
          options for one part. A card sets only the fields the search changes.
        - Limits: it knows only the PA shape (one sub box, one mid box or a tower, one horn). It cannot search a
          template, a horn-loaded chamber, more bands, or the Stack and the Space. Its output target is a rule of
          thumb (`ROOMS`), not the Space model.
      - **Today: the Hi-fi optimizer** (`lib/hifi/optimize`).
        - Inputs: the current Hi-fi design, goals (cheaper, lighter, lower, louder), a budget, locks (woofer,
          tweeter, box type, crossover, amps, each box size), the seat distance and the waveguide.
        - Search: woofer × box × tuning × plywood, then tweeter × crossover, scored as the page scores them.
        - Outputs: cards like the PA's. It knows only the Hi-fi 2-way shape.
      - **Options in the new model.**
        - (a) **Per speaker.** On the Speaker page. It varies the parts and sizes that the user leaves unlocked:
          drivers of the same kind and size range, chamber sizes, vents, crossovers, amps. Goals: cheaper, lighter,
          smaller, lower, louder. Limits: budget, maximum weight, maximum size, the target level at 1 m. One
          search engine for every spec (through `speakerResponse`, `speakerLimits`, `speakerBuild`). The kind of
          each chamber (direct, horn) and the band count stay fixed.
        - (b) **Per stack.** See issue #167.
        - (c) **Per space.** See issue #168.
      - **Recommendation.** Build (a) first, with the PA and Hi-fi searches as its first rules. Show the result as
        cards, as today. The weight limit is a limit of the search, not a page check.
      - **Owner decisions (Oct 2026).**
        1. The Speaker page gets the optimizer first.
        2. The optimizer changes only the parts and sizes that the user leaves unlocked. It never changes the chamber
           kind or the band count (for now).
        3. The level goal is one "Target level" that the user can edit, at a fixed 1 m. The optimizer compares it with
           the speaker's maximum output (at 1 m). There is no distance field and there are no
           room sizes. The user allows for the distance. The Space page shows the real level in the room. The PA
           optimizer's room rule of thumb (`ROOMS`) goes with the PA optimizer.
        4. The limits are the budget, the maximum weight per box and the maximum size per box, as today.
        5. The PA and Hi-fi pages keep their optimizers until the new optimizers cover their presets.
        6. The goals are cheaper, lighter, smaller, lower and louder, in tap order. The results are cards.
      - **Design: the Speaker optimizer** (option (a); branch `speaker-optimizer`). The engine comes first, with no UI.
        The UI is the Optimizer fold of the Speaker page (below).
        - **Code.** `lib/speaker/optimize/`: pure functions and a worker entry. The page calls
          `runSpeakerOptimizer` (`makeOptimizerRunner`, as the PA and Hi-fi pages do). The engine is
          `optimizeSpeaker(spec, goals, limits, locks, catalog)`; it returns `{ cards, nearMiss }` and the current
          design's numbers.
        - **Inputs.**

          | Input        | What it is                                                                                                         |
          | ------------ | ------------------------------------------------------------------------------------------------------------------ |
          | Spec         | The speaker as the page has it: any template, any chamber count, any band count                                    |
          | Goals        | Cheaper, lighter, smaller, lower, louder, in tap order; the first ranks the designs                                |
          | Target level | dB at 1 m. The UI starts it at your design's level. It is compared with `limits.musicDb`                           |
          | Budget       | The most the purchased parts may cost (`speakerPrice`: drivers, horns, radiators, tubes, hardware); none: no limit |
          | Weight       | The most the box may weigh, lb (`cabinetBuild`); none: no limit                                                    |
          | Size         | A lock per axis of the box (width, height, depth): free, exact, or no larger than now, as today                    |
          | Locks        | Each driver entry, each horn, each vent, each band filter, each band amp                                           |
          | Catalog      | The candidate parts (default: the app catalog). The model reads each part by id from the app tables                |

        - **Numbers the search scores.** All come from the page's own code on the final design.

          | Goal    | Number                                                                        | Beats another design by |
          | ------- | ----------------------------------------------------------------------------- | ----------------------- |
          | Cheaper | `speakerPrice` dollars                                                        | any saving              |
          | Lighter | `cabinetBuild` lb                                                             | 5%, 1 to 3 lb           |
          | Smaller | the box's outer volume, L (`speakerBounds`: the box and the horns on its top) | 5%                      |
          | Lower   | F3: where the lowest band's response first reaches its passband −3 dB         | 2 Hz                    |
          | Louder  | `speakerLimits` `musicDb`: the speaker's level for music at 1 m               | 1 dB                    |
          - Each goal keeps the level and the F3 as the PA and Hi-fi goals do (`GOAL_KEEPS`). Smaller keeps what
            lighter keeps: at most 0.5 dB under the target and 2 Hz over your F3.
          - "Beats your design on its label" uses the same margins.
          - The F3 is the lowest band's, not the sum's: with the PA music tilt the summed passband is in the horn band.
          - Two prices compare only when the cheaper design adds no part without a price (a port's pipe counts as one
            part at any size).

        - **Search space per part.** A locked part stays as it is.

          | Part                                   | Candidates                                                                                                                                                                                           |
          | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
          | Cone driver (sub, mid, woofer)         | Same kind and same nominal size, with a US price (or your part). All the cones of a chamber change together                                                                                          |
          | Coaxial                                | Same kind and same nominal size, with a US price                                                                                                                                                     |
          | Compression driver and its horn        | Compression drivers with a price; horns with a price whose throat matches the exit (the PA rule). The placement stays                                                                                |
          | Tweeter                                | Same type (dome, ribbon, AMT ...). On a waveguide: the same exit. The waveguide stays                                                                                                                |
          | Driver count, chamber kind, band count | Never                                                                                                                                                                                                |
          | Direct chamber size                    | Width and depth scale for the whole box (×0.7 to ×1.5 when free); each row of chambers with cones takes its own height. The chambers keep touching, and each driver and horn keeps the room it needs |
          | Horn-loaded chamber                    | Its size, flare and air stay (its drivers, filters and amps can change)                                                                                                                              |
          | Chamber with set net air               | Its net air scales with its volume                                                                                                                                                                   |
          | Vented chamber                         | Same port shape and count. Tuning ×0.85 to ×1.18 of yours. Size from a ladder (PA tubes and duct sizes, else ×0.75 to ×2); length solved for the tuning                                              |
          | Radiators                              | Same radiator and count; the added mass sets the tuning                                                                                                                                              |
          | Sealed chamber                         | Its stuffing stays                                                                                                                                                                                   |
          | Crossover in the box                   | ×0.71 to ×1.41 of yours, on 10 Hz steps; the type and order stay                                                                                                                                     |
          | Band highpass that is not a crossover  | 0.85× and 1× the chamber's tuning, on whole Hz (the PA rule), on a vented chamber                                                                                                                    |
          | Input range                            | Never (it is the crossover to another box)                                                                                                                                                           |
          | Amps                                   | Searched at the top (your power, or the drivers' program rating if more), then trimmed                                                                                                               |
          | Band levels                            | Each band keeps its passband level, so the balance stays (a passive band never above 0 dB)                                                                                                           |
          | Plywood, construction, bracing, look   | Never                                                                                                                                                                                                |

        - **Owner decisions** (Oct 2026, #166).
          - A changed driver moves its band's Level. The band keeps its passband level. The card lists "band levels".
          - The search does not change the plywood or the box type (sealed, vented, radiators). Later option: search plywood and box type.
          - In "cheaper", weight breaks a price tie, as on the PA page.
          - A free box side ranges from 0.7 to 1.5 times the current size.
        - **Search method.** It screens with cheap runs of the same model, then checks the finalists in full.
          1. Read your design in full: `speakerResponse`, `speakerLimits`, `cabinetBuild`, `speakerPrice`,
             `speakerBounds`, the fit checks. Calibrate the weight estimate (wood per area) on it.
          2. Units. Each chamber's cones are one unit (a coaxial feeds two bands). Each datasheet driver entry
             (compression driver, tweeter) is one unit. A band fed by two units stays as it is.
          3. Screen each unit alone: a spec with its chamber and its bands only, the net air estimated (no cabinet
             build), on a coarse grid (60 points), at the top amp power.
             - First pass, when a unit has more than 8 candidates: each at your volume on 3 tunings. The ones the
               search keeps (below) go on, at most 8, yours always.
             - Full pass: volume (7 steps, the ones the drivers fit) × tuning (5 steps) × the crossovers its band
               takes (7 steps) × the protection highpasses. The vent is the smallest size that does not set the
               limit and fits. Past about 1200 runs a unit tries fewer crossovers, then volumes, then tunings.
             - Each option gives each band's music headroom, the F3, the price and the weight.
             - Keep: for each goal, the 4 best options that keep what the goal keeps (by the estimate of the speaker
               with this unit changed alone), the 2 closest, and yours.
          4. Combine: the units' options. Estimate, calibrated on your design at the top amps: the level (each band's
             headroom moves by what its option changes), the F3, the price, the weight (the wood by the surface)
             and the size. For each set of volumes, two box shapes: the one nearest yours and the lightest, inside
             the size locks.
          5. Finalists: for each goal, the best combinations inside the limits, a few just outside, a few inside the
             near miss's loosened limits, and the closest. At most 48.
          6. Build each finalist on the UI's steps (sizes 1/4 in, port lengths 1/2 in, slot heights 1/8 in,
             crossovers 10 Hz, amps 10 W). Solve the port length on the real net air. Run the full model. Trim the
             amps two ways: to the least power that keeps the full level, and to the least that keeps the target.
             Both go in the pool. The trim works out each band's power from its drive at its first limit, then
             checks it with one limits run.
          7. When no first card is found, 12 more designs by the estimate are built, twice at most.
          8. Choose the cards from the pool (`selectCards`, shared with the PA and Hi-fi optimizers).
        - **Checks** (a design that fails one is no card): the model runs every chamber and band your design runs;
          every driver and horn that fits now still fits; the vent fits (the duct, tube and slot fit rules of
          `speakerBuild` and the fit chips); the limits hold. A band that limits first (keep-up) is a warning. A
          warning counts against a design in each goal's ranking, as on the PA page.
        - **Cards.** Up to three, as today: the first goal's best that beats your design on every goal (or a fix,
          or the closest), the smallest change, then one alternative per goal. Each card has the whole spec, the
          numbers, the change from your design, the parts that changed, its warnings and its maximum-output curve.
        - **Near miss.** When there is no card for the goals and your design doesn't keep them (a limit or the target
          is out of reach), or only the closest: the closest design, why it fails, and which change finds a card
          (weight +10%, budget +10%, target −1 dB).
        - **Rounding and the #75 bug.** The pool holds only designs on the UI's steps. The search builds and rounds a
          design before it scores it. Nothing changes a design after the selection. So a card's label, slot and
          notes come from the final design. A last check re-reads each card against its slot; the tests require that
          it drops nothing.
        - **Runtime.** It runs in a Web Worker. Target: a few seconds on a laptop. Measured in Node: 0.2 to 0.6 s for
          the Hi-fi, monitor and fill templates, 1 to 1.7 s for a PA box or tower, about 1 s for a horn-loaded bin
          (the horn engine is slow), about 1 s for the coaxial monitor. The search reports progress. It is
          deterministic: no random numbers, stable sorts, the catalog's order on ties.
        - **Reuse.** `selectCards`, `goalKeeps` (now `keepsFrom` any keep table), `keepGap`, `outOfReachNotice` and
          `throttledProgress` as they are. The lock ranges (`rangeOf`), the subsonic options (`highpassOptions`) and
          the PA vent sizes move to `lib/optimizer/searchSpace`. The fit chips move from the Speaker page to
          `lib/speaker/fitChips`; the Hi-fi slot and tube fit is `hifiVentFits` in `speakerBuild`. `speakerResponse`
          takes a point count (the screen's coarse grid). The Speaker page's field steps are `SPEAKER_STEPS`.
        - **UI** (Speaker page, "Optimizer" fold).
          - The fold holds the goals (tap order), the target level at 1 m, the budget and weight limits, the Keep list
            and Find designs with its progress and Cancel. The cards are at the top of the results pane.
          - The target starts at your design's level (rounded). "Use yours" sets it back.
          - A limit is "No limit" or a number. Turned on, it starts at your design's price or weight.
          - Keep: one lock per driver entry, horn, vent, band filter and band amp, and a free / up to (≤) / exact (=)
            lock per box axis. The locks start over when the chamber list is replaced.
          - Each card shows the front view, its maximum output against yours (fixed axes), its numbers with the change
            from your design, its warnings and what changed. Load replaces the spec as one edit. Undo load goes back to
            the design from before the first load in a row.
          - The near miss shows its option buttons. A button sets the limit and runs the search again.
          - Shared with the PA and Hi-fi pages (`components/optimizer`): `GoalPicker`, `KeepDetails`, `RunRow`,
            `ResultCards`, `Delta`, `LockBarButtons`, `CardFrame`, `CardTile`, `LooseLimits`, `NoFitNotice`. New:
            `KeepList`, and `LimitField` in `components/ui`.
        - **Tests** (`tests/speaker-optimize.test.ts`): each card beats your design on its label; locks hold; the
          limits hold on the final design; a near miss when nothing passes; the same input gives the same cards;
          a runtime bound. Parity: on the PA tower and Hi-fi 2-way templates, the cards are at least as good as the
          PA and Hi-fi optimizers' cards, or the test names the difference (`tests/speaker-optimizer-parity.ts`:
          each side's best card that keeps the goal and is inside this search's space, scored by the speaker model).
          - PA tower: the PA optimizer finds no card. Its tower mid chamber is fixed and fails its Qtc check (0.48).
          - Hi-fi 2-way: the Hi-fi optimizer also changes the plywood, the box type and the woofer size. Its cards
            that do are outside the space. Its other cards keep the seat level, not the level at 1 m.
            A snapshot
            (`tests/speaker-optimizer-snapshot.test.ts`, `vp run speaker-optimizer-snapshot`) holds the cards for a
            few fixed specs.
      - **Design: the Stack optimizer** (option (b), #167; branch `stack-optimizer`). The issue holds the owner
        decisions. The engine comes first; the UI is the Stack page's Optimizer fold, as on the Speaker page.
        - **Code.** `lib/speaker/optimize/optimizeStack.ts` (the search), `stackEvaluate.ts` (the full stack run),
          `optimizeStack.worker.ts` and `runStackOptimizer.ts`. The engine is
          `optimizeStack(design, goals, limits, locks, catalog)`. It returns `{ cards, nearMiss }` and your stack's
          numbers, as the Speaker optimizer does.
        - **Inputs.**

          | Input        | What it is                                                                                   |
          | ------------ | -------------------------------------------------------------------------------------------- |
          | Design       | The stack and its speakers, as the Stack page holds them                                     |
          | Goals        | Cheaper, lighter, smaller, lower, louder, in tap order                                       |
          | Target level | dB at 1 m, compared with `stackLimits` `musicDb`                                             |
          | Budget       | The most all members' purchased parts may cost (`stackTotals` dollars); none: no limit       |
          | Weight       | The most each box may weigh, lb; none: no limit                                              |
          | Size         | Each speaker's lock per axis (free, exact, no larger), as on the Speaker page                |
          | Height       | The most the stack may stand, in (`stackTotals` height); none: no limit                      |
          | Locks        | Each speaker's Speaker locks, or the whole speaker; each member's crossover, level and delay |

        - **Search space.** Each speaker: the Speaker optimizer's space, under its own locks. Between the boxes:

          | Item                                    | Candidates                                                                                 |
          | --------------------------------------- | ------------------------------------------------------------------------------------------ |
          | Crossover between boxes                 | Both sides move together: ×0.71 to ×1.41 of yours, on 10 Hz steps; the type and order stay |
          | Member level                            | It keeps the member's passband level (the balance), on 0.5 dB steps                        |
          | Member delay                            | Auto stays auto. A set delay goes to the aligned value (`stackResponse`), on 0.1 ms steps  |
          | Boxes, chamber kinds, band count, poses | Never                                                                                      |

          A crossover between boxes moves only when each side has that one crossover. A sub that feeds two tops keeps
          its crossover.

        - **Numbers.** As the Speaker optimizer's goals and margins (`OBJECTIVE`, `BEATS`, `GOAL_KEEPS`), on the
          whole stack: the price is the members' total, the weight is the members' total, the size is the sum of the
          boxes' outer volumes, the F3 is the lowest band's of any member, the level is `stackLimits` `musicDb`.
        - **Search method.**
          1. Read your stack in full (`evaluateStack`): `stackResponse`, `stackLimits`, `stackTotals`, each member's
             speaker on its crossover (`evaluateSpeaker`), the keep-ups in each box and between the boxes.
          2. Each speaker's own target: the target less the sum's passband, plus the speaker's passband and its
             member's level. Each speaker that reaches its target keeps the stack at the target (the balance stays).
          3. Each speaker: the Speaker search on its crossover now (`searchSpeaker`), with the stack's goals, its
             target, its locks, the weight per box and its size locks. Its pool is every built design it checks, on
             the field steps. A speaker that two members share is searched on its first member's crossover.
          4. Each other crossover setting: each pool's best designs (per goal, the closest, and yours; at most 8) run
             again on the moved crossover. Their amps go to the top, then are trimmed two ways.
          5. Combine: for each setting, the speakers' designs. The price, weight, size and F3 are exact; the level is
             estimated (each band's headroom, the passband calibrated on your stack). The height is exact.
          6. Finalists: for each goal the best inside the limits, a few just outside, a few inside the near miss's
             limits, the closest, and the single-box changes. At most 64. Each is built (levels and delays on their
             steps) and run in full. Up to two more batches of 12 when no first card is found.
          7. The cards come from `selectCards`; `checkCards` re-reads them on their final designs.
        - **Checks.** Each member fails nothing new against yours (`problemsOf`: the model, the fits, the vents, the
          fit chips, the weight per box, the size locks). The stack keeps every member modeled, the budget and the
          height. A keep-up in a box or between boxes is a warning.
        - **Cards and near miss.** As the Speaker optimizer's. A card holds the whole stack design, its numbers, the
          change from yours, what changed (in total and per speaker), its warnings and its maximum-output curve. The
          near miss offers weight +10%, budget +10%, height +10% and target −1 dB.
        - **Rounding.** Every value is on its field's step before the full run. Nothing changes a design after it is
          chosen (#75).
        - **Runtime.** A Web Worker; a few seconds. The Speaker search is about 0.3 to 1.4 s per speaker; each full
          stack run is about 6 ms. Measured in Node: 1 to 1.6 s for the PA stack, pole and satellites, about 1 s for
          the PA tower, about 0.4 s for the Hi-fi pair. Deterministic.
        - **UI** (Stack page, "Optimizer" fold, as on the Speaker page).
          - The fold holds the goals (tap order), the target level at 1 m with "Use yours", the budget, the weight
            per box and the stack height (each "No limit" or a number), the Keep list, and Find designs with its
            progress and Cancel. The cards are at the top of the results pane.
          - Keep: for each speaker, a lock on the whole speaker, one on each of its parts, and one per box axis. For
            each member, a lock on its crossover, level and delay.
          - Each card shows the stack's front view, its maximum output against yours (fixed axes), its price, weight,
            height, level, F3 and volume with the change from your stack, its box sizes, its warnings, and what changed
            (in total and in each speaker). Load replaces the stack as one edit and keeps its id, name and notes.
            Undo load goes back to the stack from before the first load in a row.
          - The cards go stale when the members or the speakers change after the search. Load is off then, and the
            notice says so. A search that comes back for an older stack is dropped. Undo ends at the next edit.
            Opening another stack or a start drops the cards, Undo and the locks.
          - A lock never moves. A member lock stays only while the members are the ones it was set on, those with
            more after them, or the first of them (the last box removed). When the removed box has the same speaker as
            another box and the app cannot tell which one went, the member locks go. A speaker's driver and horn locks
            go when its driver entries change. A lock that went stays gone.
          - Shared with the Speaker page: `useDesignOptimizer` (hook), and `DesignOptimizerSettings` and
            `DesignOptimizerResults` (`components/optimizer`).
          - UI tests: `tests/stack-optimizer-ui.test.ts`. The phone check (`tests/mobile-check.mjs`) runs the Stack
            page with the cards showing.
        - **Tests** (`tests/stack-optimize.test.ts`): locks, limits on the final design, labels against your stack,
          near miss, determinism, a runtime bound, and parity with the PA optimizer on the PA presets at the room
          rule's target (1000 sq ft: about 113 dB at 1 m). The snapshot (`tests/stack-optimizer-snapshot.test.ts`,
          `vp run stack-optimizer-snapshot`) holds the cards for a few presets.
          - Parity at 112.9 dB (`tests/stack-optimizer-parity.ts`: each side's best card inside this search's space
            that keeps the goal, scored by the stack model). Stack, pole and satellites have the same speakers, so the
            same numbers:

            | Preset                  | Goal    | Your stack | Stack optimizer | PA optimizer (in the space) |
            | ----------------------- | ------- | ---------- | --------------- | --------------------------- |
            | Stack, pole, satellites | Cheaper | $1120      | $662            | $1025                       |
            | Stack, pole, satellites | Lighter | 123.0 lb   | 91.9 lb         | 107.9 lb                    |
            | Stack, pole, satellites | Lower   | 38.0 Hz    | 29.8 Hz         | none                        |
            | Stack, pole, satellites | Louder  | 123.2 dB   | 125.7 dB        | 123.7 dB                    |
            | Tower                   | Cheaper | $1085      | $721            | no card                     |
            | Tower                   | Lighter | 155.6 lb   | 135.9 lb        | no card                     |
            | Tower                   | Lower   | 38.0 Hz    | 33.2 Hz         | no card                     |
            | Tower                   | Louder  | 123.2 dB   | 125.8 dB        | no card                     |

          - Outside the space, the PA optimizer's cards change the vent style or size a box past ×1.5 (owner
            decisions in #166). Its cheaper card ($781) is still dearer. Its lower card (F3 25.3 Hz, a vent style
            change and a sub box past ×1.5) and its louder card (128.2 dB, a sub box past ×1.5) go further than this
            search can.
          - The PA tower: the PA optimizer finds no card (its mid chamber is fixed and fails its Qtc check).
  - **L3c Cutlist, weight and bracing (done).** `lib/speaker/speakerBuild` builds any spec, chamber by chamber. It
    reuses the PA and Hi-fi code.
    - **Bracing** (owner, Oct 2026). Each chamber is braced as its own box by the PA rule (`braceShell` in
      `lib/pa/calc`), to the cabinet's bracing target (`SpeakerCabinet.braceTargetHz`, default `PA_PANEL_TARGET_HZ`,
      280 Hz), with its style and back joint. The rule keeps clear of the drivers at their positions, the vent and the
      hardware. A chamber with a PA sub and a PA port in a frame runs the PA sub box's own rule (`subBoxBracing`). A
      horn-loaded chamber's walls are braced too; its flare is kept clear and holds itself. The "Price, weight and
      bracing" section lists each panel that still misses the target.
    - **Construction fold** (owner, Oct 2026): the back joint ("Glued" / "Screwed"; a flush box starts glued, a PA
      design keeps the PA page's), the bracing style and the bracing target. The bracing and the cutlist notes follow
      them.
    - **Horn mounting** (owner, Oct 2026). A horn on a driver sits "In the baffle" or "Freestanding on top", in each
      driver's settings, for any horn the geometry allows (`hornFits`), small round horns too. The catalog's `rect`
      flag only sets the first choice (`defaultHornPlacement`). A horn on a top takes its mount where it applies
      (`takesHornMountAt`); the model, the layout, the 3D view and the cutlist read the placement.
    - **Hardware.** `SpeakerCabinet.hardware` holds the PA handles. With it, each shell's lowest chamber takes the
      handles, the input dish and, under a horn on its top, the binding posts. The PA adapter sets the PA page's
      handles. Null: no hardware (the Hi-fi box, the fill, the empty speaker).
    - **Net air (Auto).** The clear volume less the drivers, the vent's air, the wood inside (braces, ribs, vent
      walls, a frame's baffle cleats) and the hardware's recesses. The 3% allowance is gone.
    - **Cutlist.** Chambers that fill one box of one depth share one shell (the `Shell` group) with partitions inside,
      and the arched top (`archedShellParts`, the tower's) where the views draw one on a frame. Any other chamber is a
      box of its own, less the walls another chamber gives it. A frame cuts as the PA boxes (`boxParts`), a flush box
      as the Hi-fi box (`flushBoxPanels`). Every driver, horn mouth, port and radiator is noted at its position.
      The Speaker page's Cutlist tab lays the rows out on sheets as the PA and Hi-fi tabs do (the shared Cutlist page:
      `layoutCutlist`, which packs them with `packSheets`).
    - **Weight.** A frame takes the PA rule: the lowest chamber of a shell weighs as a box of its own, and each chamber
      over or beside it adds what it builds (the tower's cabinet over its sub box). A flush box takes the Hi-fi rule.
      Each chamber adds its drivers with their horns, its radiators and its hardware.
    - **UI.** The Speaker page's Cutlist tab (the shared Cutlist page), and a "Price, weight and bracing" section: the
      speaker's price and weight, each chamber's weight and braces, and each panel left under the target.
    - **Parity** (`tests/speaker-build.test.ts`). On every golden PA design: the sub's bracing, net air and weight
      exact, the mid box's bracing and weight exact, and the same cut pieces for every joint. The tower's mid
      chamber adds the rule's braces (one window brace, 3.6 lb on "lil tower"), which the PA page leaves out. On the
      Hi-fi designs: the same cut pieces and bought parts for every joint, and the Hi-fi weight plus the waveguide's
      (the Hi-fi page leaves it out).
    - **Next.**
      - Double baffle: the next bracing item. A laminate count on the baffle, which the bracing (a stiffer baffle) and
        the cutlist read.
      - Handles: a setting in the Construction fold, when it makes sense (owner, Oct 2026). The spec field is in
        (`SpeakerCabinet.hardware`); the PA adapter sets it.
      - A PA sub with a PA port keeps the PA rule's place for its bracing and hardware, even where its position is
        moved.
      - The Hi-fi page keeps its own 3% allowance.
      - Bracing in horn-loaded chambers (owner, Oct 2026). Today the PA v2 sub bins get no braces: no frame fits past
        the mouth, the flare and the throat cones. The fix:
        - Count the flare walls as full braces. They tie the side walls together and split the panels into small
          areas, as in many real horn bins.
        - Allow ribs on the outer panels around the flare.
        - Allow lightening cutouts in braces: holes in a flare wall or a frame where it carries no load.
        - The bracing check and the cutlist follow these rules.
      - Exoskeletal bracing (owner, Oct 2026; #150), a later option beside "None" (no bracing, done): braces on the
        outside of the box (ribs or a frame on the panels). They take no net air, and the panel stiffness uses the same
        model as inside braces.
  - **L3d Inductance, limits and chips.**
    - **Voice-coil inductance.** Every T/S model reads the catalog's `Le`: the sealed, vented and passive-radiator
      box models, the exact PA search and the horn engine. They share one rule, `coilFactor` in
      `src/lib/acoustics/driverCircuit.ts`: the coil is Re + jωLe, as in Hornresp. A driver with `Le` rolls off at the
      top. A driver without `Le` gives the same numbers as before.
    - **Every driver uses its datasheet `Le`** (owner decision, since Oct 2026). The models read the catalog's
      `Le` for every driver: the PA subs, mids and fills and the Hi-fi drivers. It is a plain inductance, so the
      drivers compare with the same rule. The lossy coil model refines it later. See "Lossy voice-coil model" below.
    - **Limits.** `speakerLimits` in `src/lib/speaker/speakerLimits.ts` works out each band's limits from the
      response's chamber runs (no box model runs again). It uses the pages' own limit code:
      - Cones: the PA's `sineLimitAt` (`maxOutputCurve` for each point): Xmax and the port air speed at each
        frequency, and the program rating (2 × AES) and the amp across the whole drive. Radiators add their travel,
        as the Hi-fi engine checks it.
      - Datasheet drivers keep their engine's power rule: a compression driver the PA's `hornPower`, a tweeter and a
        coaxial's HF section the Hi-fi's `tweeterMaxLevel`.
      - Each band has its amp power (`SpeakerBand.ampW`). A passive band gets the channel it shares, through its pad.
      - A band's maximum for music is one drive for the whole band, set where the band first meets a limit. Each
        band's own curve takes the program rating and the amp on the whole drive, as the PA does.
      - The sum takes one input for every band: at each frequency, the band with the least headroom sets it. A band
        limits the sum only where it carries signal. The program rating takes the drive that the band's own filters
        leave it. The amp of an active band also takes that drive, because the filters are ahead of the amp. The amp
        of a passive band is the channel it shares, ahead of the network, so the network's filters do not change it.
        The input range shapes the signal itself: the sum follows it.
      - Each vent carries its own air-speed limit (`maxSpeedMs`). The PA adapter sets the design's setting, with more
        for flared tubes, as the PA page does. The Hi-fi adapter sets the Hi-fi's 17 m/s, and the fill adapter sets
        the fill's setting. The chamber settings show it.
    - **Input range** (owner, Oct 2026). `SpeakerSpec.input` is the high-pass and low-pass that the system puts
      ahead of the box, for example the crossover to a sub. It is not part of the box, and it is saved with the
      speaker. The Speaker page models the speaker with it (the feed of `speakerResponse` and `speakerLimits`).
      - The PA top starts with a high-pass at the PA's sub crossover. The PA sub starts with a low-pass there (its
        own subsonic stays in its band). The tower, the Hi-fi speaker, the fill and the empty speaker start with both
        off.
      - The setting is the first row of the "Bands and filters" fold.
      - Later, a speaker in a stack (L4a) takes its input range from the stack's crossover.
    - **Bands are a free list** (owner, Oct 2026). A speaker has any number of bands, each with a name that the
      user sets ("Sub", "Low mid", "Horn"), so a 4-way box works. Drivers name their bands by id. The read adapters
      keep their ids (`SPEAKER_BAND`) and names (`SPEAKER_BAND_NAMES`); a band added on the Speaker page takes a
      generated id. On the charts a band's color follows its place: the lowest in the lighter gray, the highest in
      cyan, the ones between in magenta (`bandLine`).
    - **Results.** A maximum-output chart on the shared maximum-output scale (80–140 dB, `MAX_OUTPUT_TOP` /
      `MAX_OUTPUT_BOT`, as the PA and Hi-fi maximum-output charts), the maximum of each band and of the speaker, and chips: one list for each band (what sets its level, a datasheet
      driver's power) and one for each chamber (Xmax, port speed and radiator travel at full power, and the program
      rating).
    - **Parity** (`tests/speaker-limits.test.ts`). With the net air set to the PA's, every golden PA design meets the
      PA page's limits. The sub through its lowpass is within 0.06 dB, and the mid and horn within 0.01 dB. The horn's
      power is exact. The sub's music limit is within 0.02 dB, with the same limit. On the Hi-fi designs with no
      baffle-step EQ, the woofer's drive at its limit is within 0.2 dB from 30 Hz to a third of the crossover. The
      tweeter's power is exact. Above that range the engines differ: the Hi-fi divides the coil's rating by the
      lowpass, and the PA and the model do not.
  - **Horn settings (done).** A horn-loaded chamber shows a "Horn" section in its chamber settings, with a one-line
    summary (drive, sections, path length, path):
    - The flare sections: profile (conical, exponential or parabolic), start area, end area and length, in in² and
      in. The areas show to 0.1 in² and the lengths to 0.01 in; two areas at most 0.05 in² apart are the same joint. The spec
      keeps the engine's cm² and cm; `src/pages/speaker/hornSections.ts` converts in one place. Add and remove
      sections (at least one stays). The sections chain: a new section starts at the last end area, a new end area
      moves the next start with it, and a removed section's next one starts where the removed one did. A start area
      typed apart from the previous end is a step, and a note says so.
    - Steps (owner, Oct 2026): a horn is smooth by default. Each section's start area is the previous section's end
      area, and only the first section shows its start area. Templates and new sections have no steps. An "Advanced"
      fold (`AnimatedDetails`; its summary says "Steps: none" or "Steps: 2") holds a "Steps" setting. Only when it is
      on does each section after the first show its start area, so a step can be made. A step turns it on, and it stays
      on until the user turns it off (`stepsLatched`). A step shows a note: "Section 2 starts at a different area than section 1 ends. This makes a step in the
      horn." Turning it off sets each start area back to the previous end area (`withStepsSmoothed`).
    - The compression ratio (owner, Oct 2026): the cones' area over the throat's (1:1 leaves the cones unloaded). It
      sets the first section's start area, the one figure both fields edit (`withCompressionRatio`). The tip: "How
      much of the cone the horn walls cover. A higher ratio loads the cone more. It gives more output low in the band
      but less at the top, and faster air at the throat."
    - The front chamber, L, shown only (`lib/speaker/hornThroat` `frontChamber`). The walls' back edges stand in
      front of the cones by their clearance: 1.5 × Xmax (`CONE_TRAVEL_MARGIN`) and the surround (6% of the cone's
      radius). Each cone holds its area times the clearance, and the air in its dish (a cone 40% of the driver's
      catalog depth deep, `CONE_DISH_PER_DEPTH`). Older saves' throat chamber is not read.
    - The throat's air speed at full power is a limit against the box's air speed limit (its vent's, or the PA's
      port limit when sealed), as a vent's: a check under the chamber and a limit in the maximum SPL.
    - The path: straight or folded.
    - The drive: front-loaded can be picked; tapped and back-loaded show, but cannot be picked, with a note that the
      horn engine takes only a front-loaded horn today.
    - A size that is not positive and finite (an area or a length) is the `noModel` gap, and the
      views draw no flare: never NaN (`isSizedSegment`, the horn engine's and `hornFlare`'s check).
    - The load (done, owner Oct 2026): each chamber has a "Load" setting, "Direct" or "Horn"
      (`src/pages/speaker/chamberLoad.ts`). Horn starts a horn from the chamber's cones: one conical section from
      the cones' total Sd to a mouth the size of the clear face, as long as the clear depth less the deepest cone. It
      has a 1:1 compression ratio, a straight path and a front-loaded drive. The net air becomes the rear chamber's: the
      chamber's net air less the flare's air. Direct removes the horn and sets the net air back to Auto. A chamber
      with no cone driver cannot take a horn. The vent stays as it was: a vent the horn engine does not take (a slot
      the box sets the width of, side ducts, radiators) stays a named gap.
    - Not yet: the taps of a tapped horn.
  - **Horn bin construction** (owner, Oct 2026; planned, no fixed start). Build the flare of a horn-loaded chamber
    from flat plywood panels: the flare boards at their angles, the wedges beside the flare and the slot boards. Then
    use these panels for:
    1. The 3D view and the cutaway: flat boards, not a smooth flare.
    2. The cutlist: each flare board, wedge and slot board is a cut part, with its angle.
    3. The bracing: the flare boards count as braces (see "Bracing in horn-loaded chambers" in L3c).
    4. The net air: from the real wedges and the rear chamber, not an estimate.
    5. The vents: today the vent rules place a horn chamber's ports and slots as for a direct box (for example a slot
       across the bottom, through the mouth). Draw and cut them where the rear chamber is, for example side slots,
       and keep them clear of the flare.
    - Folded paths draw (`hornGeometry`). Still later: the folded path's own cutlist.
  - **Positioning** (owner, Oct 2026; planned). All positions use one rule: x from the center line (0 = centered, +
    to the right in the front view), y up from the bottom. This applies to chambers (in the cabinet), driver groups,
    vents, horn mouths and later movable parts. Today chamber `at` is the lower-left corner, and that changes to this
    rule. Old saves can break. This step can go with the movable ports and driver openings work, or earlier.
  - **Later in L3.** The optimizer; a "Place" picker for
    each chamber (on top of, or beside, chamber N). Today the user types its position ("From left", "From bottom").
  - **Lossy voice-coil model** (planned). Today the coil is Re + jωLe, a plain inductance. A datasheet gives `Le` at
    about 1 kHz. Near 200 Hz a plain `Le` of that value removes too much level, because the real coil has eddy-current
    losses and its inductance falls as the frequency increases.
    - Use the Thorborg-Futtrup semi-inductance model (Re', Leb, Le, Ke, Rss) in `coilFactor`
      (`src/lib/acoustics/driverCircuit.ts`). Hornresp and Boundary Lab use this model, so our results can be compared
      with both tools.
    - A datasheet gives only `Le`. The model needs default values for Leb, Ke and Rss, or a fit from a measured
      impedance curve.
    - The model applies to every driver at the same time. Then write the golden values again (`vp run golden`), the
      optimizer snapshot (`vp run optimizer-snapshot`) and the preset Levels (`vp run preset-levels`).
  - **One driver catalog** (owner, Oct 2026; planned). Today the drivers are in separate tables by group: PA subs, PA
    mids, fills, Hi-fi woofers and Hi-fi tweeters. Each table has its own fields, so the groups do not
    always get the same model inputs.
    - Merge the tables into one table for each kind: woofers (by size), compression drivers and tweeters. Every
      driver has the same fields and the same model rules.
    - The Speaker page's woofer picker already shows one list (#156). This item does the same in the catalog data.
    - Do this item with the lossy coil model, or immediately after it.
- **L4 Stack and Space.** The UI has three layers: Speaker, Stack and Space (see the owner decisions). L4 adds
  the last two, in two phases. The name is "Stack", not "System".
  - **Data.** L1's `SystemSpec` splits in two:
    - `StackSpec`: its members with their relative poses, the filters between boxes, the delays and the levels.
    - `SpaceSpec`: the placed stacks and speakers, the venue and the hardware.
  - **L4a Stack.** Speakers in a fixed relationship, for example a sub, a mid-bass box and a horn.
    - It sets their relative positions, the crossovers between boxes, the delays and the levels.
    - It says what each box needs (filters, delays, levels). It assigns no hardware.
    - A speaker in a stack takes its input range from the stack's crossover. Alone on the Speaker page, the user sets it.
    - **Sub highpass and subsonic.** When a sub highpass covers the box's subsonic, the box's subsonic is
      dropped; below 0.75 × Fb both stay. This rule comes with the crossovers between boxes.
    - The PA page becomes a stack preset at L3f (see "L3f Switch-over" in L3).
    - **Done (L4a).**
      - **Types.** `StackSpec` (members, notes) and `StackMember` (speaker id, pose, mirror, crossover, level, delay or
        `AUTO_DELAY`). A pose is across, up and back from the stack's origin, or from the member it stands on (`on`).
        `SpaceSpec` holds the placements (a stack, or a speaker alone on its own input range), the venue. (Amps, amp channels and the front end
        are gone: a band's amp power is `SpeakerBand.ampW` in the space's copy of its speaker, and the alignment is read from
        the model, `lib/speaker/spaceAlignment`.) `SystemSpec` and the source role are gone (no fixed roles).
      - **Adapters.** `layersFromPa`, `layersFromHifi` and `layersFromFill` return the speakers, one stack and a space.
        PA: the sub with the top on it (gap or spacer), the top on its stand beside the sub (satellite), or the tower;
        the sub is `AUTO_DELAY`, the top sits `tilt` below it. Satellite's space places the speakers alone (one sub
        midway). Hi-fi and fill: a stack of one, the sub highpass as its crossover.
      - **Model** (`lib/speaker/stackResponse`, `stackLayout`). Each member runs through `speakerResponse` with its
        crossover as its input range, then its level, delay and each band's path to a point
        `STACK_LISTEN_DISTANCE_M` (4 m) out, level with the highest band; the levels are moved back to 1 m.
      - **Auto delay.** It puts a member in phase with the member it crosses (one's lowpass and the other's highpass
        within an octave), at their crossover and at the listening point. The rule is the coverage page's
        (`autoSubDelayMs`): the crossovers' share wrapped to a turn, the crossing bands' own phases (the mid at the sub
        crossover), and their paths. It solves for the relative delay. Where the auto member would have to play early,
        the others wait instead, so no delay is below 0. On the PA goldens the sub waits 0.3–1.1 ms and is within 3°
        of the mid at the crossover; the sum there holds or improves on no delay.
      - **Limits.** `stackLimits` takes each member's `speakerLimits` with `stackCrossover` (the crossover is ahead of
        the amps, so it lifts the amp and program ceilings in the sum) on one input.
      - **Parity** (`tests/stack-response.test.ts`). A golden PA design's stack meets the PA page's system chart: the
        sub within 0.06 dB, the mid and horn within 0.01 dB. Its sum is within 0.4 dB of the members summed with their
        delays on one axis (the paths: the sub stands about 1 m below the horn's axis).
      - **Page** (`#stack`). Members from the speaker library or the current PA design; pose, mirror, level, delay;
        crossovers; the response (50–120 dB) and maximum output (80–140 dB) with each member's curve; a stacked front
        drawing from `SpeakerFront`. Saves go to `stacks` with a copy of each member's speaker, so a stack opens as
        saved.
      - **Not yet.** The sub highpass and subsonic rule, a 3D view of the stack, and refreshing a member's speaker
        from the library.
  - **L4b Space.** Stacks or speakers placed freely: the room, left and right pairs, and the coverage and level
    model.
    - The coverage map grows from `CoverageStack` to a list of placed stacks and speakers.
    - The baffle step, the room and the positions of the drivers come in here.
    - It sets the amp power of each band and lists what each box and band needs ahead of its amp: its filters, level and
      delay (a delay as a time and as the distance it equals).
    - Amps and DSP start from the owner's v1 rig: [amp-dsp-v1.md](amp-dsp-v1.md).
    - **Done (L4b).**
      - **Types.** A `SpacePlacement` has a spot (its base's front center), a lift, an aim (`SpaceAim`: yaw and pitch), a
        mirror image, `mirrored` (a left and right pair as one placement: the model stands it twice, as set and as its mirror
        image across the center line, `expandPlacements`; the two share item, lift, level and delay), and its level and
        delay on its feed. `StackPose.pitchDeg` tilts a member in
        its stack. The venue is the room (`CoverageRoom`), the listener, the ear height and the target.
      - **One aim model** (`lib/speaker/spaceLayout`). A member tilts about its bottom front edge by its cabinet's kick-back
        and its tilt in the stack; the placement tilts the whole stack about its base's front center, lifts it, turns it
        and sets it on its spot. Each driver spot points along its member's front. The model and both views use it. What
        stands on a tilted member doesn't follow its tilt. The 3D view doesn't draw the aim yet.
      - **Model** (`lib/speaker/spaceCoverage`). The coverage engine (`lib/pa/coverage`) now sums voices (a pattern each:
        a piston or a horn's coverage) and drivers with yaw and pitch; the PA page builds its scene from them, unchanged.
        A space plays each placement's stack response at each band's amp power, each driver spot with its
        band's share, its own coverage and, for a cone band, its baffle step. The whole space plays from one input at its
        music limit; the page turns it down until the reference (the audience average, the listener or 1 m out) gets the target.
      - **Parity** (`tests/space-coverage.test.ts`). The PA design's space on the coverage page's floor: the sub plays
        within 0.5 dB of the page; the map's shape (each cell less the map's mean) within 0.4 dB mean and 0.8 dB at the
        90th percentile in every band. With the page's band levels moved to the space's, the same engine: within 0.15 dB
        mean and 0.3 dB at the 90th percentile, indoors and outdoors. Tilting a lifted stack down moves its hot spot closer;
        lifting it above the ears makes it quieter close in.
      - **Page** (`#space`). One Place list: every stack preset and speaker template, the stack and speaker open now,
        and the saved ones; the room, the target and where it is measured; the amp power of each band and the alignment; the coverage map on its fixed scale, the levels, a side view of the heights and tilts, and the response at the
        listener. Saves go to `spaces` with copies of the stacks and speakers.
      - **Not yet.** The 3D view of a space.
      - **Music balance (L3f).** The Stack and Space pages start from presets (`src/pages/stack/stackPresets`): the PA
        page's starting design in each layout, the Hi-fi pair, and the current PA design. A PA start keeps the PA page's
        music balance in its band Levels (`lib/speaker/paBalance`): each band's Level is the page's balanced level less
        its own 2.83 V response, read inside its passband, the highest 0 dB; every member and placement is at 0 dB.
        - The PA presets' Levels are saved data: `src/data/presets/pa-band-levels.ts`, one row per layout, calculated
          once from the PA page's starting design. `vp run preset-levels` writes the file again after a change to the
          starting design or the models. `tests/stack-presets.test.ts` fails when a new run would change it. The
          presets read the file; they calculate nothing.
        - The current PA design and an old PA save have no saved Levels. Their balance is calculated once, when they
          are read in, and saved in their band Levels. Nothing calculates it again after an edit.
        - When the page cannot balance every band (for example a horn it cannot model), no band takes a balanced Level.
          The adapter's Levels stay, so the Levels never mix two scales.
        - On the starting design the space then plays every band 0.37 dB over the page (before: the mid −1.8 dB and
          the horn +11.3 dB). Old PA saves opened on the Stack page take the same balance.
      - **Auto balance (L3f, done).** One pure function, `lib/speaker/autoBalance`, sets the band Levels for any
        speaker (`autoBalanceSpeaker`) or stack (`autoBalanceStack`), with any number and order of bands.
        - The rule: put the bands in order of their passband. At each crossover between two bands next to each other
          (the lower band's lowpass and the upper band's highpass), set the upper band against the lower band. Then
          move all the Levels together, so that the highest Level is 0 dB.
        - The crossover corners: a band's own filters count. A feed filter (the input range; in a stack, the member's
          crossover) counts only when it cuts into the band next to it. Thus a protective highpass on the input (for
          example 30 Hz) is not a crossover. Each band is read at its own corner (at the other band's corner when it
          has none), so a gapped crossover (400 Hz and 3 kHz) reads each band where it still plays.
        - Flat (owner, Oct 2026: the default): every band is at the same level at each crossover. No tilt.
        - PA music tilt (an option): the upper band goes below the lower band by 6 dB at a crossover of 250 Hz or less
          (the mid below the sub), and by 3 dB above it (the horn below the mid). This is the PA page's music balance.
        - A small shared toggle next to the button picks the option: "Flat" or "PA music tilt" (`ToggleGroup`; the
          words in `src/constants/autoBalance`). Flat is pressed when the page opens.
        - Each band is read on its 2.83 V response with its Level taken out (`speakerResponse`; in a stack, each
          member's speaker through its crossover, from `stackResponse`). One input drives all the bands, so a limit sets
          only how loud the design can play. It does not change where the bands sit against each other. Thus, with the
          PA music tilt, the PA page's balance at the limits gives the same Levels.
        - Parity: with the PA music tilt, on the four PA presets it gives `paBandLevels` within 0.01 dB
          (`tests/auto-balance.test.ts`). The PA preset data file now comes from it, with the PA music tilt
          (`vp run preset-levels`). The file stays saved data.
        - A stack puts the balance in the band Levels of its speakers, and sets each member's level to 0 dB, as the PA
          presets do. A member level cannot set the bands of a two-band box against each other.
        - Edge cases: one band, or no band that plays, changes nothing. A band that a driver feeds but the model cannot
          calculate changes nothing, and a notice names it. A crossover outside the model's range (15 Hz to 20 kHz)
          changes nothing, and a notice says so. Two bands with no filter between them meet at the same level,
          with no tilt, at the middle of their passbands. A band with no driver keeps its Level.
        - UI: one shared button with its toggle (`src/components/ui/AutoBalanceButton`), in the Speaker page's "Bands"
          fold and the Stack page's "Members" fold. It is one edit, as any other, and one Undo step (see "Undo and
          Redo" below).
        - A shared speaker (owner, Oct 2026): when two or more stack members use the same speaker, auto balance uses
          the crossover of the first member. When the crossovers of these members are different, a notice on the Stack
          page says so (`sharedCrossovers`; the words in `src/constants/autoBalance`).
  - **Weight limit per box** (owner, Oct 2026). There is no weight check on a page. The fixed 125 lb sub check in
    `src/lib/pa/chips.ts` goes with the PA page. A maximum weight per box is only a limit of the optimizer (see
    "Optimizer rethink" in L3f): the user sets it, and no tower or layout rule sets it.
  - **Undo and Redo** (owner, Oct 2026; later, not a parity blocker). Add Undo and Redo for design edits on the
    Speaker, Stack and Space pages. Use one method for the full app.
    - Each edit to the design is one step. Auto balance is one step.
    - Undo goes back one step. Redo does the step again.

## Branches

- The revamp lives on the parent branch `designer`. Each phase is a sub-branch from `origin/designer` (for
  example `designer-l3a`), and its PR has the base `designer`.
- `main` must not break. `designer` merges into `main` only when the owner approves it.

## Risks

- Fill numbers shift in P5.
- Near-field accuracy at 0.5 m for big coaxes.
- Optimizer runtime with coax candidates.
- Page complexity: split `HifiPage.tsx` first.
- Passive maker networks (3rd order) cannot be expressed as `CrossoverOrder` (4 | 8).
- The tall tower with a loose horn on top: tipping, and securing the horn.

## Owner decisions (Oct 2026)

- The UI has three layers. The name of the middle one is "Stack", not "System".
  - **Speaker:** one box, with its chambers, drivers and bands. The Speaker page.
  - **Stack:** speakers in a fixed relationship: relative positions, crossovers between boxes, delays, levels.
    For example a sub, a mid-bass box and a horn.
  - **Space:** stacks or speakers placed freely: the room, left and right pairs, the coverage and level model.
- The Stack says what each box needs (filters, delays, levels). The Space sets each band's amp power and lists the
  alignment to set.
- A speaker's input range comes from its stack's crossover. Alone on the Speaker page, the user sets it.
- Monitor drive: the user can select passive or active.
- No target level for each use. Show the maximum level at a distance that you set.
- No fixed roles. A template sets only the first values. A save keeps no `use`.
- Booth monitors are a pair. They hang or sit on pedestals. No tilt and no wedge for now.
- Tower with the horn on top: the mid chamber height is adjustable, and any horn can sit on top. Do this in
  L3, not before.
- The page is called "Speaker" (owner, Oct 2026, #150), not "Speakers".
- One Speaker page designs all speakers. Templates (starting points) replace the layout pickers, so the
  tower needs no "Horn" toggle or separate picker entry.
- Simulation in a real space is a separate page later (the Space page). Any speaker can be placed there.
- The fill delay against the mains belongs to the Space page.
- Chart scales (owner, Oct 2026): every maximum-output chart (PA, Hi-fi, Speaker) uses 80–140 dB, and every
  sensitivity or response chart (Hi-fi, the Speaker page's 2.83 V, 1 m response) uses 50–120 dB.
- The spec's ports carry the PA port details (the letterbox's fins and fold, the flared tubes), so the PA subs
  match the PA page exactly.
- Stuffing is a visible setting on each chamber. The model has no hidden stuffing rule. The 3% bracing
  allowance is gone from the Speaker page (L3c): the net air counts the real braces.
- The sub highpass and subsonic rule waits for the Stack phase (L4a).
- The cabinet gets a top shape (`flat` or `arched`) with the templates step (L3e). The PA tower's arched top then
  draws and cuts correctly.
- One aim model for all speakers (in since L4b, `lib/speaker/spaceLayout`):
  - It covers a Hi-fi box's kick-back (tilt up, the cabinet's `tiltDeg`) and PA tops angled down (a stack member's
    `pitchDeg`), with a placement's yaw and pitch.
  - The Space page's coverage, levels and side view use it. The 3D view doesn't draw it yet.
- Ports and driver openings become settings you can move, like the drivers' positions. The spec fields and the
  settings are in (L3e).
- Positioning: all positions use one rule: x from the center line (0 = centered, + to the right in the front view),
  y up from the bottom. This applies to chambers (in the cabinet), driver groups, vents, horn mouths and later movable
  parts. Today chamber `at` is the lower-left corner, and that changes to this rule. Old saves can break. Planned:
  see "Positioning" in L3.
- L3f (Oct 2026): no merge into `main` until the Speaker, Stack and Space pages reach parity with the PA page; the
  PA page goes last. The optimizer gets a rethink; no "Optimize" button on the presets for now. Notes become a static
  tab in the Space project, with rich text later. A weight limit stays only as an optimizer limit. See "L3f
  Switch-over".

## Open questions for the owner

1. Show coaxials in the Hi-fi starting point (template)?
2. Coaxials with no published HF data: model the woofer only, with a chip, or hide them?
3. Which small horns to research first?
