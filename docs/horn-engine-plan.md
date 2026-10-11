# Horn engine: Hornresp-style horn modeling in the planner

A plan, Oct 2026. It adds a 1-D horn model to the PA planner for the boxes in [pa-v2-plan.md](pa-v2-plan.md):
front-loaded sub bins and mid horns with vented rear chambers, later folded and tapped horns. Phase 1 (the engine and
its tests) is done. It matches Hornresp (see [Validation](#validation)).

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
- **Limits:** the existing thermal, excursion and port-speed logic, on the new curves (phase 2).

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
   - Power conservation through a lossless chain; mutual coupling against the piston formula.
3. **Published designs.** Skipped: the forums that post Hornresp inputs and plots block automated access. Step 4
   replaces it.
4. **Hornresp golden files.** Done, with Hornresp 60.60 under Wine (see [Running Hornresp](#running-hornresp)).
   `tests/hornresp.test.ts` compares eight designs (nine readings), 10 Hz–2 kHz (`tests/hornresp/`: each record and its results).
5. **Measurement** of the built boxes with REW.

### Hornresp results

| Case                | Checks                                                   | SPL       | Ze, excursion |
| ------------------- | -------------------------------------------------------- | --------- | ------------- |
| `sub-sealed-exp`    | Exponential horn, throat chamber, sealed rear            | < 0.01 dB | < 0.1 %       |
| `sub-bin-vented`    | Four conical segments, vented rear (the sub bin)         | < 0.01 dB | < 0.1 %       |
| `sub-bin-eighth`    | The same in eighth space (images)                        | < 0.01 dB | < 0.1 %       |
| `sub-direct-vented` | Direct radiator, vented box, QL 7                        | < 0.6 dB  | < 0.1 %       |
| `mid-vented`        | Exponential mid horn, throat chamber, vented rear        | < 0.01 dB | < 0.1 %       |
| `mid-pair`          | Two boxes side by side (count 2) vs Hornresp's composite | < 0.01 dB | < 0.1 %       |
| `mid-pair`          | Two drivers on one throat (`drivers: 2`), same record    | < 0.01 dB | < 0.1 %       |
| `sub-bin-le`        | The sub bin with Le 1.6 mH                               | < 0.01 dB | < 0.1 %       |
| `mid-le`            | The mid horn with Le 0.6 mH                              | < 0.01 dB | < 0.1 %       |

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

1. **Engine and tests** (`src/lib/acoustics/`). No UI.
2. **Sub bins on the PA page.** A front-loaded box type with a vented rear chamber, its settings in a
   `SettingsSection`, its curves on the existing charts with their fixed axes (15 Hz–20 kHz; 80–135 dB).
3. **Mid horns and stacking.** Horn mids, N-box stacking, the 2.5-way roll-off, the summed response. Folded horns as
   a chain without bends.
4. **Build outputs.** The 3D view and the cutlist for the flared walls: kerfed or bent panels, or stacked layers.
5. **Optimizers.** Size the rear chamber, the port and the flare.

## Open questions

1. Horn geometry as catalog data (`src/data/catalog/`) or as design settings?
2. Default solid angle: half space (as today), or a floor-and-wall corner for ground-stacked bins?
3. Curved walls in the 3D view and cutlist, or a flat-panel approximation?

## Running Hornresp

Hornresp is a free Windows program (hornresp.net). It runs under Wine on Linux or a Mac. The steps used here, in a
cloud session (Ubuntu 24.04):

1. Install 32-bit Wine, a virtual display and a GUI driver: add the i386 architecture, then the packages `wine`,
   `wine32:i386`, `xvfb` and `xdotool`.
2. Unzip `Setup.exe` (it is a zip): `Hornresp.exe`, `Msvbvm60.dll`, the help file.
3. Give Wine a "Courier New" font. Hornresp stops without it. A copy of Liberation Mono renamed to "Courier New" in
   the prefix's `windows/Fonts` works.
4. Start `Xvfb :99`, then `wine Hornresp.exe` with `DISPLAY=:99`. Drive it with `xdotool` and check it with
   screenshots.
5. Set the air: click the input window, then Ctrl+F5: 343 m/s and 1.18 kg/m³. The window's title then shows them.
   A new container starts with Hornresp's defaults, so set the air each time.
6. Per case: put the record in `Import`, then File > Import > Hornresp Record. Calculate, and answer "Yes" to mask the
   chamber resonances. On the Acoustical Power chart, File > Export > All Chart Data. Use a short file name.
7. Keep frequency, SPL, Ze and Xd up to 2 kHz in `tests/hornresp/<case>-results.txt`.

Record files must have CRLF on every line. Multi-segment horns take `Fta` (the mouth's wall angle) in place of `Cir`.
Hornresp rejects a record that breaks either rule as "not a valid record".
