# Speaker designer: plan (parent branch `designer`)

One page, the Designer, designs any single box and saves it to a library. A later Stack page joins boxes in
a fixed relationship, and a Space page places stacks and boxes in a real space. This plan
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
- **Stack page.** It joins saved speakers in a fixed relationship: relative positions, crossovers between boxes,
  delays and levels.
- **Space page.** It places stacks and speakers freely: the room, left and right pairs, amps and channels, DSP,
  and the coverage and level model.
- **Today's PA page bundles all three.** It eventually becomes a stack preset.

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
  - **Horns.** A chamber's load is direct or a horn built into the box: the horn engine's throat chamber and
    segments (`HornDesign`, PR #128). The chamber's net air and vent are the horn's rear chamber.
    `hornDesignOf` maps a front-loaded chamber onto `HornDesign`. Alike drivers in one throat go to the engine
    as one driver and a count (`drivers`, Hornresp's Nd). The engine wires them in parallel, and each cone
    keeps its own air load. A folded path (a bass bin) has the same segments; its fold
    layout comes later. A back-loaded or tapped horn has its own drive; the engine does not take them yet. A
    catalog horn on a compression driver is a `HornAttachment` with its `placement` (baffle or top) and its
    `mount`.
  - New `speakers` and `stacks` collections under `users/{uid}`, next to `configs` (PA) and `hifiConfigs`.
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
    - A horn-loaded chamber shows its mouth on the baffle and a flare from its segments.
    - A folded path, or a path longer than the chamber, is a straight placeholder. A note says so.
    - A mouth larger than the clear face is drawn at the clear face. A note says so.
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
      catalog and the defaults (`src/pages/designer/designerTemplates.ts`). It sets only the first values. The spec
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
        throat (the engine's `drivers`), a straight conical flare, net rear air set (~324 L for two), a slot on each
        front side, folded, tuned to ~35 Hz, a 30 Hz BW24 subsonic.
      - PA v2 mid box (`PA_V2_MID_BOX`): two 10″ in one throat with a 1 L throat chamber and an exponential flare,
        ~34 L rear air, side slots, tuned to ~95 Hz, crossed at the R-OSSE's lowest crossover.
      - The PA v2 slots store their narrow size as the height and their long side as the width, in sizes of ⅛″. The
        model reads only the area and the rectangle. The slot settings show the count, the narrow side, the long side
        (where the slot sets one) and the length. "Auto" net air counts each slot and its shelf.
      - Later, with movable ports: the side slots draw on the sides (today the views draw a slot along the bottom), and
        "Auto" net air takes off the air of a horn's flare (today a horn chamber's net air is set).
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
  - **L3c Cutlist, weight and bracing (done).** `lib/speaker/speakerBuild` builds any spec, chamber by chamber. It
    reuses the PA and Hi-fi code.
    - **Bracing** (owner, Oct 2026). Each chamber is braced as its own box by the PA rule (`braceShell` in
      `lib/pa/calc`), to the cabinet's bracing target (`SpeakerCabinet.braceTargetHz`, default `PA_PANEL_TARGET_HZ`,
      280 Hz), with its style and back joint. The rule keeps clear of the drivers at their positions, the vent and the
      hardware. A chamber with a PA sub and a PA port in a frame runs the PA sub box's own rule (`subBoxBracing`). A
      horn-loaded chamber's walls are braced too; its flare is kept clear and holds itself. The "Weight and bracing"
      section lists each panel that still misses the target.
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
      The Designer's Cutlist tab lays the rows out on sheets as the PA and Hi-fi tabs do (the shared Cutlist page:
      `layoutCutlist`, which packs them with `packSheets`).
    - **Weight.** A frame takes the PA rule: the lowest chamber of a shell weighs as a box of its own, and each chamber
      over or beside it adds what it builds (the tower's cabinet over its sub box). A flush box takes the Hi-fi rule.
      Each chamber adds its drivers with their horns, its radiators and its hardware.
    - **UI.** The Designer's Cutlist tab (the shared Cutlist page), and a "Weight and bracing" section: the speaker's
      weight, each chamber's weight and braces, and each panel left under the target.
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
      speaker. The Designer models the speaker with it (the feed of `speakerResponse` and `speakerLimits`).
      - The PA top starts with a high-pass at the PA's sub crossover. The PA sub starts with a low-pass there (its
        own subsonic stays in its band). The tower, the Hi-fi speaker, the fill and the empty speaker start with both
        off.
      - The setting is the first row of the "Bands and filters" fold.
      - Later, a speaker in a stack (L4a) takes its input range from the stack's crossover.
    - **Bands are a free list** (owner, Oct 2026). A speaker has any number of bands, each with a name that the
      user sets ("Sub", "Low mid", "Horn"), so a 4-way box works. Drivers name their bands by id. The read adapters
      keep their ids (`SPEAKER_BAND`) and names (`SPEAKER_BAND_NAMES`); a band added in the Designer takes a
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
    - The flare sections: profile (conical or exponential), start area, end area and length, in in² and in. The areas
      show to 0.1 in² and the lengths to 0.01 in; two areas less than 0.05 in² apart are the same joint. The spec
      keeps the engine's cm² and cm; `src/pages/designer/hornSections.ts` converts in one place. Add and remove
      sections (at least one stays). The sections chain: a new section starts at the last end area, a new end area
      moves the next start with it, and a removed section's next one starts where the removed one did. A start area
      typed apart from the previous end is a step, and a note says so.
    - Steps (owner, Oct 2026): a horn is smooth by default. Each section's start area is the previous section's end
      area, and only the first section shows its start area. Templates and new sections have no steps. An "Advanced"
      fold (`AnimatedDetails`; its summary says "Steps: none" or "Steps: 2") holds a "Steps" setting. Only when it is
      on does each section after the first show its start area, so a step can be made. It is on while the horn has a
      step. A step shows a note: "Section 2 starts at a different area than section 1 ends. This makes a step in the
      horn." Turning it off sets each start area back to the previous end area (`withStepsSmoothed`).
    - The throat chamber, L (as the net air). The path: straight or folded.
    - The drive: front-loaded can be picked; tapped and back-loaded show, but cannot be picked, with a note that the
      horn engine takes only a front-loaded horn today.
    - A size that is not positive and finite (an area, a length or the throat chamber) is the `noModel` gap, and the
      views draw no flare: never NaN (`isSizedSegment`, the horn engine's and `hornFlare`'s check).
    - The load (done, owner Oct 2026): each chamber has a "Load" setting, "Direct" or "Horn"
      (`src/pages/designer/chamberLoad.ts`). Horn starts a horn from the chamber's cones: one conical section from
      the cones' total Sd to a mouth the size of the clear face, as long as the clear depth less the deepest cone. It
      has no throat chamber, a straight path and a front-loaded drive. The net air becomes the rear chamber's: the
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
    - Later in the same item: folded paths. They replace the straight placeholder of today.
  - **Positioning** (owner, Oct 2026; planned). All positions use one rule: x from the center line (0 = centered, +
    to the right in the front view), y up from the bottom. This applies to chambers (in the cabinet), driver groups,
    vents, horn mouths and later movable parts. Today chamber `at` is the lower-left corner, and that changes to this
    rule. Old saves can break. This step can go with the movable ports and driver openings work, or earlier.
  - **Later in L3.** The optimizer; a "Place" picker for
    each chamber (on top of, or beside, chamber N). Today the user types its position ("From left", "From bottom").
- **L4 Stack and Space.** The UI has three layers: Speaker, Stack and Space (see the owner decisions). L4 adds
  the last two, in two phases. The name is "Stack", not "System".
  - **Data.** L1's `SystemSpec` splits in two:
    - `StackSpec`: its members with their relative poses, the filters between boxes, the delays and the levels.
    - `SpaceSpec`: the placed stacks and speakers, the venue and the hardware.
  - **L4a Stack.** Speakers in a fixed relationship, for example a sub, a mid-bass box and a horn.
    - It sets their relative positions, the crossovers between boxes, the delays and the levels.
    - It says what each box needs (filters, delays, levels). It assigns no hardware.
    - A speaker in a stack takes its input range from the stack's crossover. Alone in the Designer, the user sets it.
    - **Sub highpass and subsonic.** When a sub highpass covers the box's subsonic, the box's subsonic is
      dropped; below 0.75 × Fb both stay. This rule comes with the crossovers between boxes.
    - The PA page becomes a stack preset.
    - **Done (L4a).**
      - **Types.** `StackSpec` (members, notes) and `StackMember` (speaker id, pose, mirror, crossover, level, delay or
        `AUTO_DELAY`). A pose is across, up and back from the stack's origin, or from the member it stands on (`on`).
        `SpaceSpec` holds the placements (a stack, or a speaker alone on its own input range), the amps, the front end
        and the venue. `SystemSpec` and the source role are gone (no fixed roles).
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
    - It assigns the hardware that does what each stack needs: the front end and the amp channels. One rack
      can drive several stacks.
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
- Passive maker networks (3rd order) cannot be expressed as `CrossoverOrder` (4 | 8).
- The tall tower with a loose horn on top: tipping, and securing the horn.

## Owner decisions (Oct 2026)

- The UI has three layers. The name of the middle one is "Stack", not "System".
  - **Speaker:** one box, with its chambers, drivers and bands. The Designer page.
  - **Stack:** speakers in a fixed relationship: relative positions, crossovers between boxes, delays, levels.
    For example a sub, a mid-bass box and a horn.
  - **Space:** stacks or speakers placed freely: the room, left and right pairs, the coverage and level model.
- The Stack says what each box needs (filters, delays, levels). The Space assigns the hardware that does it
  (front end, amp channels), because one rack can drive several stacks.
- A speaker's input range comes from its stack's crossover. Alone in the Designer, the user sets it.
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
- Chart scales (owner, Oct 2026): every maximum-output chart (PA, Hi-fi, Designer) uses 80–140 dB, and every
  sensitivity or response chart (Hi-fi, the Designer's 2.83 V, 1 m response) uses 50–120 dB.
- The spec's ports carry the PA port details (the letterbox's fins and fold, the flared tubes), so the PA subs
  match the PA page exactly.
- Stuffing is a visible setting on each chamber. The model has no hidden stuffing rule. The 3% bracing
  allowance is gone from the Designer (L3c): the net air counts the real braces.
- The sub highpass and subsonic rule waits for the Stack phase (L4a).
- The cabinet gets a top shape (`flat` or `arched`) with the templates step (L3e). The PA tower's arched top then
  draws and cuts correctly.
- Aim is not drawn now. One aim model comes later, for all speakers:
  - It covers a Hi-fi box's kick-back (tilt up) and PA tops angled down.
  - Today the Hi-fi spec has `tiltDeg`. PA tops angled down must fit the same model.
  - The 3D view and the Space page's coverage and levels both use it.
- Ports and driver openings become settings you can move, like the drivers' positions. The spec fields and the
  settings are in (L3e).
- Positioning: all positions use one rule: x from the center line (0 = centered, + to the right in the front view),
  y up from the bottom. This applies to chambers (in the cabinet), driver groups, vents, horn mouths and later movable
  parts. Today chamber `at` is the lower-left corner, and that changes to this rule. Old saves can break. Planned:
  see "Positioning" in L3.

## Open questions for the owner

1. Show coaxials in the Hi-fi starting point (template)?
2. Coaxials with no published HF data: model the woofer only, with a chip, or hide them?
3. Which small horns to research first?
