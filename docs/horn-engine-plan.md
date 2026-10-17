# Horn engine: Hornresp-style horn modeling in the planner

A plan, Oct 2026. It adds a 1-D horn model to the PA planner for the boxes in [pa-v2-plan.md](pa-v2-plan.md):
front-loaded sub bins and mid horns with vented rear chambers, later folded and tapped horns. Phase 1 (the engine and
its tests) is done. It matches Hornresp (see [Validation](#validation)). The horn boxes now go to the modular
Designer, not the PA page (see [Phases](#phases)). A general acoustic network now holds the same parts (see
[The acoustic network](#the-acoustic-network)). Tapped and offset-driver horns are presets on it.

## What the planner has today

- **A lumped-element acoustic circuit:** `boxModel` and `closedBox` in `src/lib/pa/calc.ts`, and the fast form in
  `src/lib/pa/exactSub.ts`.
- **The driver** from its Thiele/Small parameters: Mas, Cas, Ras, Rae, Pg.
- **Sealed and vented boxes:** box compliance, port mass, leakage and port losses.
- **Outputs:** SPL at 1 m in half space, cone excursion, port air speed, and the thermal, excursion and port limits.
- **Grids:** 12–300 Hz for the vented sub (`boxModel`), 20 Hz–2 kHz for the sealed mid (`closedBox`).

Hornresp uses the same driver model. It adds a chain of acoustic two-ports between the cone and the air.

## The model

### Elements

Each element is a 2 × 2 complex matrix. It maps the pressure and volume velocity at its output to those at its input.
The chain multiplies them per frequency.

| Element                    | Model                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Straight duct              | Plane-wave tube: cos(kL), j·Z0·sin(kL), Z0 = ρc/S                                                              |
| Conical segment            | Wave solution of the horn (Webster) equation, spherical waves                                                  |
| Exponential segment        | Wave solution of the horn equation; exact at and near its cutoff                                               |
| Parabolic segment (PAR)    | Exact wave solution for an area that grows linearly: Bessel J₀ and Y₀ of k·ξ, ξ from where the area is zero    |
| Hyperbolic-exponential (T) | Later, if a design needs it                                                                                    |
| Curved walls, tractrix     | Several short conical segments                                                                                 |
| Throat (front) chamber     | Shunt compliance V/(ρc²), between the cone and the throat                                                      |
| Rear chamber               | Shunt compliance, as the vented box today                                                                      |
| Port                       | Straight duct ended in its exit's radiation impedance (round or slot); lumped mass with the radiation load off |
| Mouth                      | Radiation impedance of a baffled piston (half space); other angles by images                                   |

- **Below its cutoff,** an endless exponential horn takes no real power. A finite one still passes some, because the
  mouth reflects. The model gives both.
- **Radiation impedance.** A baffled piston needs the Bessel J₁ and Struve H₁ functions. The engine computes both
  from their integral forms. They stay accurate up to 2ka ≈ 60.
- **Parabolic segment.** A horn with flat, straight side walls between a parallel top and bottom (the PA v2 sub bin)
  keeps its height, so its area grows linearly: S = S₁ + (S₂ − S₁)·x/L. With S ∝ ξ, the horn equation is Bessel's
  of order 0, so the segment is exact, not a run of short steps. `besselPair` gives J₀, J₁, Y₀ and Y₁ from their
  series below 15 and Hankel's expansion above, fast enough for every frequency. A run of short conical segments on
  the same law converges to it: 64 of them come within 0.05 dB on a sub bin.
- **Throat and front chamber (the Speaker page).** A horn built into a box has no throat plate. Its side walls start
  narrower than the cones, so their back edges cover the outer parts of each cone, and the throat (S₁) is the opening
  between the edges at the box's inside height. The compression ratio is the cones' area over S₁. The edges stand
  just in front of the cones, clear of 1.5 × Xmax and the surround. The air between the cones and the edges is the
  front chamber (Hornresp's Vtc): each cone's area times that clearance, plus the air in its dish (a cone 40% of the
  driver's catalog depth deep). `lib/speaker/hornThroat` works it out; it is not a setting. With S₁ it makes a
  low-pass, f ≈ c·S₁ / (2π·Vtc): a higher ratio loads the cones more but lowers it. The PA v2 sub bins take 2:1 and
  the mid box 2:1 (see [pa-v2-plan.md](pa-v2-plan.md#compression-ratio)).
- **Solid angle.** The piston formula is half space (2π). Quarter and eighth space (π, π/2) use mirror images: an
  approximation. Free air (4π) is not modeled.
- **Losses.** Leakage (QL) and vent loss (Qp), as options. The defaults are the box models' 7 and 50. Hornresp's
  horn rear chamber is lossless. Add absorption if a reference design needs it.
- **Vent.** A duct, not a lumped mass: its own air acts as a spring, so a long vent tunes lower. Its exit's radiation
  load adds the outer end correction. A slot's exit (`HornPort.slot`) takes its opening's rectangle correction, smaller
  than a round exit's.
- **Voice coil.** Re + jωLe when the driver lists Le (Hornresp's plain model). No semi-inductance or lossy model.
- **Shared code.** The engine and the box models use one driver circuit and one set of loss constants
  (`lib/acoustics/driverCircuit`, `constants/acoustics`).

### Topologies

| Topology                       | Chain                                                   | Phase       |
| ------------------------------ | ------------------------------------------------------- | ----------- |
| Front-loaded horn, sealed rear | rear chamber ‖ cone → throat chamber → segments → mouth | 1           |
| Front-loaded horn, vented rear | as above, with a port; port and mouth outputs summed    | 1           |
| Folded horn                    | the same chain; folds not modeled, only the path        | 3           |
| Offset-driver horn (OD)        | the cone taps the path between a closed end and mouth   | 1 (network) |
| Tapped horn (TH)               | both sides of the cone drive one path at two points     | 1 (network) |

### Outputs

- **SPL** at 1 m, two ways:
  - `spl`, on axis: mouth and port as point sources, summed with their path offset.
  - `powerSpl`, as Hornresp shows it: each source's radiated power spread over the solid angle (no directivity). It
    equals `spl` while the mouth is small. Above that it reads lower by the mouth's directivity index: 5–11 dB at
    500–950 Hz for the PA v2 mid box.
- **Cone excursion, port and throat air speed, electrical impedance.**
- **Group delay,** for the front end's alignment.
- **Limits:** the existing thermal, excursion and port-speed logic, on the new curves (phase 2). The throat's air
  speed is a check against the box's air speed limit. It does not limit the maximum SPL.

### Stacking

N identical boxes side by side load each other: each mouth carries N·Z(N·S), the impedance of one piston N times its
area. This is exact for mirror images and an approximation for real boxes. Stacking changes the mouth's match: it
moves the ripple and the low end. It does not add level beyond +6 dB per doubling at a fixed cone flow.

### Grid

The engine takes any frequency list. `hornGrid` gives 10 Hz–2 kHz, which reaches a mid horn's 950 Hz crossover. The
box models keep their own grids.

## Limits (as Hornresp's)

- **1-D only.** It holds while the cross-section is below about half a wavelength. A 500 mm mid mouth reaches that
  near 350 Hz. Above it, the mid horn's response is approximate.
- **No directivity.** Use BEM (hornlab.io, ABEC) or measurement for coverage.
- **Ideal folds.** No bend resonances.
- **No cone breakup.** No coupling between separate stacks.

## Validation

1. **Reduce to the box models.** No segments, no throat chamber, no radiation load: match `boxModel` and `closedBox`
   on their grids (SPL, excursion, port speed, unwrapped phase, tuning). Done: to 1e-9.
2. **Analytic cases.** Done.
   - A duct driven at one end and closed at the other: input-impedance zeros at c(2n − 1)/(4L).
   - An exponential horn ended in its own forward wave: the endless horn's throat impedance, at and near the cutoff.
   - A conical horn ended in its forward wave: the spherical wave's impedance.
   - A parabolic horn ended in its forward wave (Hankel functions); with equal areas, the straight duct; a run of
     short conical segments on its law converges to it as 1/n².
   - Power conservation through a lossless chain; mutual coupling against the piston formula.
3. **Published designs.** Skipped: the forums that post Hornresp inputs and plots block automated access. Step 4
   replaces it.
4. **Hornresp golden files.** Done, with Hornresp 60.60 under Wine (see [Running Hornresp](#running-hornresp)).
   `tests/hornresp.test.ts` compares nine designs (eleven readings), 10 Hz–2 kHz (`tests/hornresp/`: each record and its results).
5. **Measurement** of the built boxes with REW.

### Hornresp results

| Case                | Checks                                                         | SPL       | Ze, excursion |
| ------------------- | -------------------------------------------------------------- | --------- | ------------- |
| `sub-sealed-exp`    | Exponential horn, throat chamber, sealed rear                  | < 0.01 dB | < 0.1 %       |
| `sub-bin-vented`    | Four conical segments, vented rear (the sub bin's first model) | < 0.01 dB | < 0.1 %       |
| `sub-bin-eighth`    | The same in eighth space (images)                              | < 0.01 dB | < 0.1 %       |
| `sub-direct-vented` | Direct radiator, vented box, QL 7                              | < 0.6 dB  | < 0.1 %       |
| `mid-vented`        | Exponential mid horn, throat chamber, vented rear              | < 0.01 dB | < 0.1 %       |
| `mid-pair`          | Two boxes side by side (count 2) vs Hornresp's composite       | < 0.01 dB | < 0.1 %       |
| `mid-pair`          | Two drivers on one throat (`drivers: 2`), same record          | < 0.01 dB | < 0.1 %       |
| `sub-bin-le`        | The sub bin with Le 1.6 mH                                     | < 0.01 dB | < 0.1 %       |
| `mid-le`            | The mid horn with Le 0.6 mH                                    | < 0.01 dB | < 0.1 %       |
| `mid-pair-le`       | Two drivers with Le, on one throat and as two boxes            | < 0.01 dB | < 0.1 %       |

The first run found three differences. The engine now follows Hornresp in the first two:

- **The vent.** Hornresp models it as a duct with a radiating exit. The engine had a lumped mass. Given the same
  length, the tunings differed: 31 vs 35 Hz on the sub, 83 vs 95 Hz on the mid. The duct's own spring and the exit's
  radiation mass explain it.
- **SPL.** Hornresp shows the power response. The engine adds it as `powerSpl` and keeps the on-axis `spl`.
- **The leak.** Hornresp does not radiate the leak's flow (QL as a pure loss). The engine radiates it, as the box
  models and Small's model do. This moves a direct radiator's output by up to 0.6 dB below 20 Hz. A horn's rear
  chamber has no leak in Hornresp, so its results match exactly.

Not compared:

- **Path length.** Hornresp's acoustic path length is not the engine's `portOffset` (a setback on axis). The cases
  use 0.
- **Chamber resonances.** Hornresp masked them (lumped chambers, as the engine).
- **Slot exits.** Hornresp has round ports only. `tests/horn-engine.test.ts` checks round and slot exits against the
  duct's tuning equation, k·tan(k·(L + Δ)) = S/V.
- **Air.** Hornresp ran with the planner's air: c = 343 m/s, ρ = 1.18 kg/m³. With its defaults (344, 1.205) its SPL
  reads ~0.15 dB higher.

## Phases

1. **Engine and tests** (`src/lib/acoustics/`). No UI. Done (#128, #132, #133): the 1-D chain, the duct vent with
   round or slot exits, voice-coil inductance, several drivers on one throat (`drivers`), checked against Hornresp.
2. **Horn boxes in the Designer.** Not on the PA page: the owner's rule is not to build what the modular Designer
   replaces. The PA v2 sub bin becomes a Designer template, on a `designer-*` branch (parent `designer`). It waits on
   the Designer page, its chamber editor and its response chart. `hornDesignOf` (`src/lib/speaker/hornDesign.ts`)
   already maps a chamber onto the engine.
3. **Mid horns and stacking.** Horn mids, N-box stacking, the 2.5-way roll-off, the summed response. Folded horns as
   a chain without bends.
4. **Build outputs.** The 3D view and the cutlist for the flared walls: kerfed or bent panels, or stacked layers.
5. **Optimizers.** Size the rear chamber, the port and the flare.

## Using the engine

For code that calls `hornModel` (the Designer, a future page):

- **Two SPLs.** `spl` is on axis, each source a point source: the planner's convention, as its box models. `powerSpl`
  is Hornresp's power response, with no directivity. They part above ~300 Hz, by the mouth's directivity index (5–11
  dB at 500–950 Hz on the PA v2 mid box). Chart one on purpose and say which.
- **Drivers on one throat: `drivers`.** One box with N drivers is `drivers: N`. `count: N` is N boxes side by side;
  it also merges their vent exits by images, which overstates the exits' end correction when the vents sit apart.
  The two give the same horn load.
- **Voice-coil inductance comes from the catalog.** A driver's `Le` reaches the engine through `hornDesignOf`. No Le
  means no inductance. The box models ignore Le, so a check against them needs `Le: 0`.
- **Vents.** `HornPort.length` is the physical length plus the inner end correction; the exit's radiation load adds
  the outer end. `HornPort.slot` gives a slot's opening, for its rectangle end correction. With the radiation load off
  (the box models' mode) the vent is lumped and takes the full effective length.
- **Losses.** `QL` and `Qp` default to the box models' 7 and 50. Hornresp's horn rear chamber is lossless
  (`QL: Infinity, Qp: Infinity`).
- **`portOffset`** is the vent exit's setback behind the mouth, on axis. It is not Hornresp's acoustic path length.
- **Units** are Hornresp's: areas cm², lengths cm, volumes L, Le mH. `ze` and `xmm` are per driver; the amp sees
  about `ze / drivers`.

## Open gaps

- **Chamber standing waves.** The chambers are lumped, as Hornresp's masked mode. Hornresp can also model them as
  ducts (Lrc, Atc).
- **Inductance models.** Only Hornresp's plain Le; not its semi-inductance or lossy models.
- **The leak.** The engine radiates the leak's flow, as the box models and Small's model. Hornresp does not: up to
  0.6 dB below 20 Hz on a direct radiator.
- **Slot exits with images.** In quarter or eighth space, or with boxes side by side, the slot's shape scales the
  merged round exit: an approximation.
- **Folds and back-loaded horns.** Not modeled. The Speaker page models offset and tapped horns through the network
  (see [Offset and tapped horns on the Speaker page](#offset-and-tapped-horns-on-the-speaker-page)). The 3D view
  still draws their path straight.
- **Tapped and offset-driver horns against Hornresp.** Checked on the acoustic network. Five reference records meet
  Hornresp's results (see [Reference records for Hornresp](#reference-records-for-hornresp)).

## Offset and tapped horns on the Speaker page

Phase 2 of #169, part 1. The Horn settings' Drive picks Front-loaded, Offset or Tapped.

| Drive        | Engine                       | Cones                                               | Chamber's net air                   | Vent          |
| ------------ | ---------------------------- | --------------------------------------------------- | ----------------------------------- | ------------- |
| Front-loaded | Horn engine (`hornModel`)    | Fronts at the throat                                | Rear chamber                        | Any taken     |
| Offset       | Network (`offsetDriverHorn`) | Fronts after section `tap`; the path's start closed | Rear chamber                        | Any taken     |
| Tapped       | Network (`tappedHorn`)       | Fronts after `frontTap`, backs after `rearTap`      | Passage from the backs to their tap | None (sealed) |

- `hornDesignOf` gives a `HornLayoutDesign`. `hornLayoutModel` runs it on its engine.
- A tap is a boundary between two sections: 1 to n − 1. A bad tap is the `taps` gap. A vent on a tapped horn is
  the `tappedVent` gap.
- A tapped horn's two passages are as wide as the cones' area. The front passage is the front chamber
  (`frontChamber`). The back passage holds the chamber's net air with its stuffing.
- Picking a drive splits the longest section until there are enough sections for the taps. The horn does not change.

### Goals and the starting layout

`src/lib/speaker/hornGoals.ts`. The user sets the goals: the lowest frequency, the highest frequency and the target
level. The box size is the chamber's size.

- **The fit** (`hornGoalFit`): the response's spread over the band, the level at the low goal against the band's mean,
  and the lowest maximum output. The maximum output is the lower of the power limit (`aes` into the impedance) and the
  Xmax limit.
- **Design from goals** (`goalHorn`): one parabolic flare from the closed end to the mouth, split at the taps.
  - The search tries path lengths of 0.5 to 1.5 quarter wavelengths at the low goal, three flares, the tap places and
    (front-loaded and offset) the rear chamber's share of the air. Then it halves its steps five times around the
    best try.
  - The score is the spread, plus twice any low edge under −3 dB, plus twice any shortfall from the target.
  - The air is the chamber's clear air less the drivers' displacement, times 0.85 (`FOLD_AIR_SHARE`) for the fold's
    panels. A tapped horn's rear chamber is twice the drivers' displacement.
  - It takes 0.2 s (tapped) to 1.1 s (offset, vented) on the PA v2 bin box.
- **The check** under the goals: the spread, a low edge under −3 dB, the maximum output and any shortfall, and a horn
  that holds more air than the chamber.

### Hornresp import

`src/pages/speaker/hornrespImport.ts`. A pasted record sets the sections, the drive, the chamber's net air and the
vent. The chamber keeps its drivers.

| Record             | Net air            | Vent                                                     |
| ------------------ | ------------------ | -------------------------------------------------------- |
| Front-loaded or OD | Vrc                | One round tube of area Ap, length Lpt less its inner end |
| TH                 | Vrc (at least 1 L) | Sealed                                                   |

- The record's Vtc, Atc and Lrc are not read. The front chamber comes from the cones and the walls. The passages are
  as wide as the cones.

## The acoustic network

Phase 1 of #169. One engine for any wiring of drivers, chambers, ducts and openings. Code: `src/lib/acoustics/network/`.
No UI yet.

### Parts

| Part    | Model                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------- |
| Driver  | The box models' circuit with Le, a pressure source between a rear node and a front node         |
| Chamber | Lumped compliance V/(ρc²) to the outside air; an optional absorbing loss beside it              |
| Duct    | Horn sections in a row: the exact two-ports (conical, exponential, parabolic, straight duct)    |
| Mass    | Lumped acoustic mass and resistance: a vent with no radiation load, as the box models           |
| Opening | A mouth, a vent exit or a leak to the air: piston radiation impedance, a resistance, or no load |

- **Nodes.** Each node has one pressure. The outside air is the zero-pressure reference.
- **Solver.** Modified nodal analysis per frequency. The unknowns are the node pressures and the parts' flows. One
  row per node sums its flows to zero. One row per part flow gives the part's law.
- **Ducts keep their transfer matrix.** The solver never inverts it. So a duct where B = 0 (half a wavelength) or of
  zero length still solves.
- **Elimination.** Gaussian, with partial pivoting and row scaling. A horn box has 10 to 20 unknowns.
- **Singular systems.** A pivot below 1e-12 of its scaled row gives null. A node that nothing holds is singular.
- **Many frequencies.** `prepareNetwork` checks and prepares a network once. `solvePreparedAt` solves it at each
  frequency. `solveNetworkAt` does both for one frequency.
- **Outputs.** Node pressures, part flows, cone excursion, Ze, and SPL at 1 m. SPL is on axis (`spl`) and from radiated
  power (`powerSpl`). Openings sum by flow and setback, as the horn engine.
- **Pure.** No DOM and no globals: it can run in a web worker.

### Presets

`presets.ts` builds a network from a design. A horn path runs from boundary 0 to boundary n. Each tapped boundary,
the closed end and the mouth get a node. Ducts join them in order.

| Preset             | Wiring                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `frontLoadedHorn`  | Fronts at boundary 0, through the throat chamber; rears in a sealed or vented chamber            |
| `offsetDriverHorn` | As above, fronts at boundary `tap`; the stub before it is closed at its start (OD)               |
| `tappedHorn`       | Fronts at `frontTap`, rears at `rearTap`, each through its chamber; only the mouth radiates (TH) |
| `sealedBox`        | `closedBox`'s circuit                                                                            |
| `ventedBox`        | `boxModel`'s circuit, lumped vent, radiating leak                                                |

`presetModel` gives a preset's result in the horn engine's shape (`HornModel`).

- **Chambers.** A front-loaded or OD horn's throat and rear chambers are lumped volumes, as Hornresp's masked mode.
  A tapped horn's chambers are straight passages from the cones to their taps, as Hornresp's TH. Each has a volume and
  an area (`TapChamber`); its length is the volume over the area.

### Parity

`tests/acoustic-network.test.ts` checks the network against the existing models. The bar was 0.01 dB and 0.1 %.

| Check                                            | Result                                            |
| ------------------------------------------------ | ------------------------------------------------- |
| Every Hornresp case the horn engine passes       | Every readout within 1e-9 of `hornModel`          |
| Horn engine's box mode, slot vent, quarter space | Within 1e-9                                       |
| `closedBox`, Le 0 and 1.5 mH                     | SPL, excursion, phase within 1e-9                 |
| `boxModel`, Le 0 and 1.5 mH, two loss sets       | SPL, excursion, vent speed, phase, Fb within 1e-9 |

- **The horn engine keeps its own code.** Parity holds to rounding, not bit for bit. The PA optimizers call
  `hornModel`, and their snapshots must not move. A later change can make `hornModel` call the network.
- **The box models keep their inline real arithmetic.** The optimizers run them millions of times.

### Physics checks

- An offset-driver horn tapped at its throat is the front-loaded horn. Tap 0 meets the horn engine to rounding.
  A 10 µm stub comes within 0.01 dB.
- A tapped horn's response moves smoothly as a tap moves. A 1 mm move changes it less than a fifth of a 1 cm move.
- A section split where no driver taps changes nothing.
- A tapped horn with both taps at one point plays nothing: the two sides cancel.
- Every node's flows add to zero, to 1e-12.
- A chamber's loss is a leak whose flow does not radiate. A duct with no sections is its loss alone.
- Two drivers in one bank are two driver parts side by side. Two boxes in half space are one box in quarter space.
- A tapped horn rolls off below its path's quarter-wave resonance: 12 dB per octave or more at the bottom.

### Hornresp reader

`hornrespRecord.ts` reads a Hornresp record onto the presets.

| Supported                                     | Not supported yet (the reader says so)                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| Front-loaded horns and direct radiators       | Rg, a driver count other than 1, 4π                        |
| OD: closed at S1, fronts at S2                | Semi-inductance, lossy inductance, damping models          |
| TH: closed at S1, fronts at S2, rears at S3   | Hornresp's vent end correction, acoustic path length       |
| TH with four sections: rears at S4            | Other flares (for example Tra), filled chambers, absorbent |
| Con, Exp and Par sections, up to four         | Passive radiators, active filters, equalizer bands         |
| Sealed or vented rear chamber, throat chamber | A vent on a tapped horn, an open rear (Vrc 0)              |
| TH chambers: Vtc with Atc, Vrc with Lrc       | Other layouts (OD1, OD2, TH1, BP4 and more)                |
| 2π, π and π/2                                 | A TH throat chamber with no Atc                            |

- **Hornresp's conventions.** Mmd without air load; lossless horn chambers; a direct radiator's leak of QL 7 that
  does not radiate. With that leak, the network meets `sub-direct-vented` to 0.0003 dB. The horn engine radiates the
  leak and needs 0.6 dB there.
- **Every committed record** reads and meets Hornresp's results: SPL within 0.0003 dB, Ze within 0.005 %.
- **Layouts.** The key of the driver count line (the line after Re) names the layout: `Nd`, `OD` or `TH`. Its value
  is the number of drivers. Hornresp writes it so. The caller can give another layout, also for an unknown key.
- **TH chambers.** Hornresp's TH takes Vtc and Vrc as passages, masked or not. Vtc has the area Atc. Vrc has the length
  Lrc, so its area is Vrc / Lrc. Either value at zero gives no chamber.
- **Invalid records.** A blank or non-numeric value, a negative length, or a driver value of zero or less fails. So
  do horn rows with the wrong keys, or a row that does not start at the end of the row before it. The reason starts
  "invalid record: ".
- **End correction flag.** Hornresp sets it on every TH record. The reader checks it only when the record has a vent.
- **SKRAM.** `tests/hornresp-layouts/skram-od.txt` is hand-written from its FreeCAD model. Its Vrc is a placeholder,
  so its test is structural only.

### Reference records for Hornresp

`tools/hornresp/records/` holds five records, as Hornresp 60.60 exported them. Their results are in
`tests/hornresp/`. `tests/hornresp-reader.test.ts` checks them with the committed records' tolerances.

| Record                | Design                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `th-thorn10`          | A Thorn-like 10″ TH: 200 cm conical path, taps at 30 and 120 cm                                     |
| `th-thorn10-chambers` | `th-thorn10` with Vtc 1500 cc (Atc 300 cm²) and Vrc 6 L (Lrc 20 cm)                                 |
| `th-15`               | A 15″ TH: 300 cm conical path, taps at 40 and 180 cm                                                |
| `th-15-four`          | `th-15` with its last section split in two: four sections, rears at S4                              |
| `od-skram`            | The SKRAM-like OD: parabolic, stub 27.28 cm, Vrc 120 L (a plausible value), vent 732 cm² × 79.54 cm |

The network meets all five: SPL within 0.0001 dB, Ze within 0.0001 %, excursion within Hornresp's rounding.

The run answered the open points:

| Point                    | Answer                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| The OD and TH record key | `OD = 1` or `TH = 1` in place of `Nd = 1`: the driver count line                          |
| TH sides                 | The front at S2 with Vtc, the rear at S3 with Vrc. The phase matches Hornresp's to 0.1°   |
| TH chambers              | Passages, not lumped volumes. As lumped volumes, the chambers case missed by 55 dB        |
| TH with four sections    | The rears tap S4                                                                          |
| OD throat chamber        | Lumped, as the front-loaded horn's                                                        |
| Mouth key after Par      | `Fta`, the wall angle at the mouth. The area grows linearly, so Fta = atan(dS/dx / (2πr)) |

### Next

| Phase | Work                                                                              |
| ----- | --------------------------------------------------------------------------------- |
| 1     | New wirings: bandpass (4th and 6th order), back-loaded horn, isobaric, push-pull  |
| 1     | Chambers as ducts (Lrc, Atc), for chamber resonances                              |
| 2     | Folded geometry: the path drawn in legs, panel angles, cutlist, bracing, net air  |
| 3     | UI: a chamber editor, a path editor, the optimizer on the network in a web worker |

## Open questions

1. Horn geometry as catalog data (`src/data/catalog/`) or as design settings?
2. Default solid angle: half space (as today), or a floor-and-wall corner for ground-stacked bins?
3. Curved walls in the 3D view and cutlist, or a flat-panel approximation?

## Running Hornresp

Hornresp is a free Windows program (hornresp.net). It runs under Wine on Linux, in a cloud session. `tools/hornresp/`
has the setup, a script that drives it, a record writer and Hornresp's rules for a record (see its README).

- **Set the air each time:** 343 m/s and 1.18 kg/m³. A new container starts with Hornresp's defaults.
- **Check the setup first:** run a committed case. Its results must be identical.
- **Mask the chamber resonances:** lumped chambers, as the engine. A TH's chambers are passages either way.
