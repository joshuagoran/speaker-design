# Space: placement loading and reference speakers

Make the Space page show how a box's place changes its own output and limits.
Add approximate models of common commercial speakers, for basic layout studies.
Keep it simple and web-based: no meshes, no GPU, no install.

## Credit

Boundary Lab Deploy (JWSound, GPLv3) showed the approach.
It describes each cabinet by how it responds to outside pressure, then solves all cabinets together.
This plan uses the same idea with lumped openings instead of meshes.
It uses no Boundary Lab code, text, or data files.
Its results serve only as a check (see Validation).

- Boundary Lab: <https://github.com/JWSound/boundary-lab>
- Boundary Lab Deploy: <https://github.com/JWSound/boundary_lab_deploy>

## Goal

- Moving a box in Space changes its output, cone travel, and limits where the physics says so.
- Horn mouths and vents near the floor, walls, or other boxes get the right extra load.
- The Speaker page stays as it is: one box, alone, in half space.
- The user can place approximate models of common commercial subs and tops.
- Each part is labeled for what it is: a model, not a measurement.

## What Space does now

| Part              | Now                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------- |
| What you place    | Stack presets, Speaker templates, the open Stack and Speaker, and saved designs        |
| Sound of each box | Its Speaker model through its crossover, with phase; each driver spot has its coverage |
| Room              | Floor, walls, and ceiling as image sources; materials; diffuse field; room modes       |
| Between boxes     | Their sound adds, with phase, below 500 Hz (`COHERENT_BELOW_HZ`)                       |
| Loading           | None. Each box plays as it does alone in half space                                    |
| Limits            | One figure per design. A box's place never changes it (`spaceCoverage.ts`, cache key)  |

The horn engine already has a load rule: `mouthImpedance(area, f, angle, count)` (`src/lib/acoustics/radiation.ts`).
It models a mouth in a half, quarter, or eighth space, beside identical touching mouths.
The Speaker model always calls it with `{ count: 1, angle: 2 }`:
`speakerResponse.ts:175`, `hornGoals.ts:219`, and `pages/speaker/chamberLoad.ts:259`.

## Where loading matters

Loading changes how much air an opening moves.
The sum of sound from many boxes is already in Space.
So the new part is the change in each opening's own flow.

| Opening                   | Size of the effect | Why                                                                                        |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Horn mouth                | Large              | The mouth load sets the horn's low-end response and ripple                                 |
| Vent or slot exit         | Small to medium    | The exit's air mass moves the tuning a few percent; it changes port speed                  |
| Cone of a direct radiator | Very small         | Air load is under 1 % of the cone's own impedance at 50 Hz (18 in cone); flow barely moves |

For direct radiators, the result must stay close to today's.
That is a check, not a goal (see Validation).

## Not in scope

These stay in Boundary Lab and Deploy:

- Meshes, BEM solves, and diffraction or scattering off other cabinets
- Interior standing waves and port pipe modes
- GPU solves and reduced-order models

## Part 1: placement loading

### Model

**Stage A: boundaries and touching mouths.** This reuses the existing rule.

1. Lay out every opening in Space: horn mouths, vents, slots, and passive radiators.
   Their positions exist in `speakerLayout.ts` (`slotOpeningsAt`, `roundPortsAt`, `radiatorsAt`).
   `layStack` in `spaceLayout.ts` does not place them yet.
2. For each opening, find the boundaries it touches: the floor and each wall.
   "Touches" means the opening's edge is within a set gap (decision 1).
3. Set `angle`: 2 for none, 1 for one boundary, 0.5 for two.
4. Set `count`: identical openings of identical boxes whose edges touch.
5. Pass `{ count, angle }` per placement into `hornDesignOf` and the vent exit, instead of the fixed values.

**Stage B: mutual load at any distance.** This replaces Stage A's steps 3–4.

1. Treat each opening i as a small source with flow Uᵢ (volume velocity, m³/s).
2. Add the floor and the two nearest walls as mirrors. Use the floor, each wall, and their combinations: seven images.
   Each image carries the surface's reflection factor at that frequency, as the room sum does.
3. The extra pressure at opening i from source j (or an image) at distance d is
   pᵢ = Zᵢⱼ·Uⱼ, with Zᵢⱼ = jωρ·e^(−jkd) / (4π·d) (full space).
   ρ is air density, ω = 2πf, and k = ω/c is the wave number.
4. The Speaker model already includes a half-space self load.
   The correction for opening i is the full-space self load, less the half-space one, plus its own images.
5. For openings closer than the sum of their radii, use Stage A's touching rule.
6. Each box gives a linear reply at each frequency: U = U₀ − Y·p.
   U₀ is today's flow. Y is the box's admittance matrix, one row and column per opening.
   Get Y from the box's network with one extra solve per opening (unit pressure at that opening).
   Sealed and vented boxes use the `sealedBox` and `ventedBox` network presets, which tests already match to the closed-form models.
7. Solve the whole space at each frequency: (I + Y·Z)·U = U₀. This is a small dense complex system.
8. Apply it below 500 Hz. Fade the correction to zero over the octave above.

Stage B is Deploy's coupled method in lumped form.
Deploy's matrix T maps outside pressure to each cabinet's surface flow. Here Y does that per opening.

**Later, Stage C: room modes.** In a small room below its lowest modes, the room itself loads the subs.
`roomModes.ts` could give that load. Decide after Stage B.

### What changes in the results

- Each opening's sound is scaled by its new flow, U / U₀, before the room sum.
- Cone travel, port air speed, and the limits use the new flows. `speakerLimits` reads `chambers[k].drive`, so it follows.
- The cache key becomes the item plus a rounded description of its surroundings. A mirrored pair in a symmetric room still shares one run.
- Move the per-placement model into the Space worker (`space.worker.ts`) if the page slows.

### UI

- No new settings. The page applies loading by itself.
- The selected placement shows one line: how much louder or quieter it plays at 40 Hz, and its cone travel change, against the same box alone.
- Its tooltip explains: "Walls, the floor, and other boxes near a horn mouth or port change how much air it moves."
- Optional: a chart of maximum output, in place and alone, on the shared axes (80–140 dB, 15 Hz–20 kHz).
- UI text names no model or code.

### Owner tasks (acceptance)

Run each in the browser before every hand-over.

1. Place one horn sub in the middle of the room. Move it against the front wall, then into a corner. The low end gets louder at each step. The limit figure changes.
2. Place two identical horn subs side by side, mouths touching. Then move them 10 ft apart. The touching pair has more low end per box.
3. Lift a vented sub 3 ft off the floor. The tuning and port speed change a little. The line shows a small change.
4. Place two direct-radiator subs together, then 10 ft apart. The map changes as it does now. The line shows a change under 0.5 dB.
5. Go outdoors. Only the ground loads the boxes.

### Validation

| Check                                   | How                                                                            | Pass                     |
| --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| Stage B matches Stage A where both hold | Touching mouths and flush boundaries at low frequency                          | Within 0.5 dB            |
| Reciprocity                             | Zᵢⱼ = Zⱼᵢ for every pair                                                       | Exact                    |
| No energy from nothing                  | Total radiated power is never negative                                         | Every frequency          |
| Direct radiators barely move            | Cone flow change for a sealed and a vented 18 in sub, near a wall              | Under 0.5 dB             |
| Hornresp                                | One horn, flush on the floor and in a corner; Hornresp's Ang = 1.0 π and 0.5 π | Same as the horn engine  |
| Boundary Lab Deploy                     | Two Level 3 packages, ground only (Deploy has no walls); mic SPL and excursion | Within 1 dB below 100 Hz |
| Prototype                               | Near-field sweep of the built sub in open floor, then in a corner              | Trend agrees             |

The Deploy check needs a CUDA machine. The owner runs it and saves the numbers as test data with their source.

### Steps

| Step | PR                                                                                           |
| ---- | -------------------------------------------------------------------------------------------- |
| 1    | Mock: `docs/space-loading-mock.html` with shaped numbers, to agree on the line and the chart |
| 2    | Lay out every opening in Space. No result changes yet. Tests for positions                   |
| 3    | Stage A, with the line in the placement settings. Owner tasks 1, 2, and 5                    |
| 4    | Stage B. Owner tasks 1–5. Snapshots that move are rewritten in the same PR, with the reason  |
| 5    | Validation data from Hornresp and Deploy, as tests                                           |

## Part 2: reference speakers

Approximate models of common commercial boxes, such as QSC and EV subs and tops.
They help with layout studies: coverage, delays, levels, and interference.
They do not predict exact output.

### What makers publish

| Data                               | Spec sheet           | Accuracy                                        |
| ---------------------------------- | -------------------- | ----------------------------------------------- |
| Response, −3, −6, or −10 dB points | Yes                  | Shape between the points is a guess             |
| Maximum SPL, peak and continuous   | Yes                  | Often calculated; not per frequency             |
| Coverage, H × V                    | Yes (tops)           | Nominal; one value for all frequencies          |
| Drivers, size and count            | Yes                  | Good                                            |
| Size and weight                    | Yes                  | Good                                            |
| Enclosure type, port, Thiele-Small | Rarely               | Missing: so no loading for these boxes          |
| DSP and limiter settings           | No                   | Missing: the limit is the published maximum SPL |
| Directivity balloons               | In EASE or CLF files | See Part 3                                      |

Example: the QSC K12.2 page lists a 12 in cone, a 1.4 in compression driver, 50 Hz–20 kHz (−6 dB),
75° axisymmetric coverage, 132 dB peak and 126 dB continuous, and 602 × 356 × 350 mm.

### Model

- **Response:** a band-pass curve fit to the published −3, −6, and −10 dB points.
- **Maximum output:** the continuous maximum SPL, shaped by that response. The box's own DSP sets it, so no amp or excursion limit is added.
- **Coverage:** low end as a piston of the woofer's size; high end as a waveguide with the published H × V.
- **Loading:** none. The internals are unknown. The box still adds to the room sum, with phase.

### Data

- A new catalog kind: `src/data/catalog/reference-speakers.ts`, typed pure data.
- Each entry: maker, model, kind (sub, top, or full range), drivers, response points, maximum SPL, coverage, size, weight, US price and vendor, source URL, and the date read.
- A gap stays a gap: a missing value is marked, not invented.
- A new place group, "Reference speakers", in `placeOptions.ts`, and a new `SPACE_ITEM` kind.
- First list (decision 4): QSC K10.2, K12.2, KS118, and KS112; EV ELX200-12P, ELX200-18SP, EKX-12P, and EKX-18SP.

### Legal

- Published figures are facts. They are free to use. Link the source.
- Maker and model names only describe the product. No logos, photos, or claims of endorsement.

### Gap: polarity

Cardioid sub setups need one box with inverted polarity. Space has level and delay, but no polarity.
Add a polarity switch per placement as a separate, small PR. It helps every design, not only reference speakers.

### Owner tasks (acceptance)

1. Place two QSC K12.2 tops and two KS118 subs in a room. Auto delays and levels work.
2. Compare that layout with one of your own stacks in the same room.
3. Set up three subs as a cardioid group (after the polarity PR). The map shows less sound behind them.

## Part 3: importing loudspeaker data files

| Format                 | Who uses it                             | Open?                                                                           | Plan                     |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| EASE GLL (`.gll`)      | AFMG EASE and its tools                 | No. AFMG licenses its SDK to makers and their providers, as a subscription      | No import                |
| CLF (`.cf1`, `.cf2`)   | CLF group (BYU); QSC posts `.cf2` files | Described as an open format for makers to share data. Spec access not confirmed | Spike first (decision 5) |
| Boundary Lab `.blabsp` | Boundary Lab and Deploy                 | Documented in Boundary Lab's docs (GPLv3 project)                               | Later, optional          |

The CLF spike:

1. Find the CLF file spec and its terms of use.
2. If both allow it, write a reader from the spec, in a worker.
3. Read the balloon and the response. Use them for a reference speaker's coverage instead of the nominal H × V.
4. If the spec is not public, stop. Keep the spec-sheet models.

## Decisions

| #   | Question                                               | Proposal                                  |
| --- | ------------------------------------------------------ | ----------------------------------------- |
| 1   | Stage A: how close is "touching"?                      | Edge within 2 in of the boundary or mouth |
| 2   | Show the "in place and alone" chart, or only the line? | Line first; chart if the mock asks for it |
| 3   | Stage C (room modes as load): now or later?            | Later                                     |
| 4   | First reference speakers                               | The eight boxes above                     |
| 5   | CLF import: go or no-go                                | After the spike                           |
| 6   | Show prices for reference speakers?                    | Yes, US vendors only, as for drivers      |
