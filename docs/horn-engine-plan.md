# Horn engine: Hornresp-style horn modeling in the planner

A plan, Oct 2026. It adds a 1-D horn model to the PA planner for the boxes in [pa-v2-plan.md](pa-v2-plan.md):
front-loaded sub bins and mid horns with vented rear chambers, later folded and tapped horns. Phase 1 (the engine and
its tests) is in PR #128.

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

| Element                    | Model                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| Straight duct              | Plane-wave tube: cos(kL), j·Z0·sin(kL), Z0 = ρc/S                            |
| Conical segment            | Wave solution of the horn (Webster) equation, spherical waves                |
| Exponential segment        | Wave solution of the horn equation; exact at and near its cutoff             |
| Hyperbolic-exponential (T) | Later, if a design needs it                                                  |
| Curved walls, tractrix     | Several short conical segments                                               |
| Throat (front) chamber     | Shunt compliance V/(ρc²), between the cone and the throat                    |
| Rear chamber               | Shunt compliance, as the vented box today                                    |
| Port                       | Series acoustic mass and loss, with the box models' leak and port Q          |
| Mouth                      | Radiation impedance of a baffled piston (half space); other angles by images |

- **Below its cutoff,** an endless exponential horn takes no real power. A finite one still passes some, because the
  mouth reflects. The model gives both.
- **Radiation impedance.** A baffled piston needs the Bessel J₁ and Struve H₁ functions. The engine computes both
  from their integral forms. They stay accurate up to 2ka ≈ 60.
- **Solid angle.** The piston formula is half space (2π). Quarter and eighth space (π, π/2) use mirror images: an
  approximation. Free air (4π) is not modeled.
- **Losses.** The planner's leakage and port losses only. Add absorption if a reference design needs it.
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

- **SPL** at 1 m: mouth and port volume velocities summed, with their path offset.
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

Hornresp is not required. Check in this order:

1. **Reduce to the box models.** No segments, no throat chamber, no radiation load: match `boxModel` and `closedBox`
   on their grids (SPL, excursion, port speed, unwrapped phase, tuning). Done: to 1e-9.
2. **Analytic cases.** Done.
   - A duct driven at one end and closed at the other: input-impedance zeros at c(2n − 1)/(4L).
   - An exponential horn ended in its own forward wave: the endless horn's throat impedance, at and near the cutoff.
   - A conical horn ended in its forward wave: the spherical wave's impedance.
   - Power conservation through a lossless chain; mutual coupling against the piston formula.
3. **Published designs.** Hornresp results published with their inputs (HOQS designs, forum builds). Digitize a few
   points. Match within 1–2 dB.
4. **Hornresp golden files,** when a machine can run it.
5. **Measurement** of the built boxes with REW.

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

Hornresp is a free Windows program. Ways to run it without Windows _(unverified)_:

- **Wine on a Mac** (Homebrew or CrossOver).
- **A Windows VM on a Mac** (UTM or Parallels, Windows 11 on ARM).
- **A rented Windows cloud machine** (AWS or Azure), over Remote Desktop from a Mac, iPad or phone.
- **Wine in a cloud session.** The containers have no hardware virtualization, so no full VM. Wine with a virtual
  display may work, with a setup script each session.
