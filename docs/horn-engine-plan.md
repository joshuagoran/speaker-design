# Horn engine: Hornresp-style horn modeling in the planner

A plan, Oct 2026. It adds a 1-D horn model to the PA planner for the boxes in [pa-v2-plan.md](pa-v2-plan.md):
front-loaded sub bins and mid horns with vented rear chambers, later folded and tapped horns. Phase 1 (the engine and
its tests) is done. It matches Hornresp (see [Validation](#validation)). The horn boxes now go to the modular
Designer, not the PA page (see [Phases](#phases)).

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

| Topology                       | Chain                                                   | Phase |
| ------------------------------ | ------------------------------------------------------- | ----- |
| Front-loaded horn, sealed rear | rear chamber ‖ cone → throat chamber → segments → mouth | 1     |
| Front-loaded horn, vented rear | as above, with a port; port and mouth outputs summed    | 1     |
| Folded horn                    | the same chain; folds not modeled, only the path        | 3     |
| Tapped horn                    | both sides of the cone drive one path at two points     | later |

### Outputs

- **SPL** at 1 m, two ways:
  - `spl`, on axis: mouth and port as point sources, summed with their path offset.
  - `powerSpl`, as Hornresp shows it: each source's radiated power spread over the solid angle (no directivity). It
    equals `spl` while the mouth is small. Above that it reads lower by the mouth's directivity index: 5–11 dB at
    500–950 Hz for the PA v2 mid box.
- **Cone excursion, port and throat air speed, electrical impedance.**
- **Group delay,** for the front end's alignment.
- **Limits:** the existing thermal, excursion and port-speed logic, on the new curves (phase 2). The throat's air
  speed takes the box's air speed limit, as a vent does (the Speaker page's maximum SPL and its checks).

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

- **Le for most of the catalog.** Only the PA v2 drivers and the Hi-fi woofers list it. The others model with no
  inductance and read a few dB high near the top of their band.
- **Straight-walled 1-D flares.** Hornresp's parabolic profile (area grows linearly) is not in the engine. Use several
  conical segments: the PA v2 sub bin uses four.
- **Chamber standing waves.** The chambers are lumped, as Hornresp's masked mode. Hornresp can also model them as
  ducts (Lrc, Atc).
- **Inductance models.** Only Hornresp's plain Le; not its semi-inductance or lossy models.
- **The leak.** The engine radiates the leak's flow, as the box models and Small's model. Hornresp does not: up to
  0.6 dB below 20 Hz on a direct radiator.
- **Slot exits with images.** In quarter or eighth space, or with boxes side by side, the slot's shape scales the
  merged round exit: an approximation.
- **Folds, tapped and back-loaded horns.** Not modeled (`hornDesignOf` names the gap).

## Open questions

1. Horn geometry as catalog data (`src/data/catalog/`) or as design settings?
2. Default solid angle: half space (as today), or a floor-and-wall corner for ground-stacked bins?
3. Curved walls in the 3D view and cutlist, or a flat-panel approximation?

## Running Hornresp

Hornresp is a free Windows program (hornresp.net). It runs under Wine on Linux, in a cloud session. `tools/hornresp/`
has the setup, a script that drives it, a record writer and Hornresp's rules for a record (see its README).

- **Set the air each time:** 343 m/s and 1.18 kg/m³. A new container starts with Hornresp's defaults.
- **Check the setup first:** run a committed case. Its results must be identical.
- **Mask the chamber resonances:** lumped chambers, as the engine.
