# Horn engine: Hornresp-style horn modeling in the planner

A plan, Oct 2026. It adds a 1-D horn model to the PA planner, so it can model the boxes in
[pa-v2-plan.md](pa-v2-plan.md): front-loaded sub bins and mid horns with vented rear chambers, and later folded and
tapped horns. Nothing is built yet.

## What the planner has today

- **A lumped-element acoustic circuit** with inline complex arithmetic: `boxModel` and `closedBox` in
  `src/lib/pa/calc.ts`, and the shared fast form in `src/lib/pa/exactSub.ts` (`subCircuit`, `ventedCurves`).
- **The driver** from its Thiele/Small parameters: Mas, Cas, Ras, Rae, Bl (`subCircuit`).
- **Sealed and vented boxes:** the box compliance, the port mass from its tuning, leakage and port losses.
- **Outputs:** SPL at 1 m in half space, cone excursion, port air speed, and the thermal, excursion and port limits
  (`subwooferLimits`, `midSystem`).
- **A 12–300 Hz grid,** fast enough for the optimizers, which run in workers.

Hornresp uses the same driver model. What it adds is a chain of acoustic two-ports between the cone and the air.

## The model

### Elements

Each element is a 2 × 2 complex matrix that maps pressure and volume velocity at its input to its output. The chain
multiplies them per frequency.

| Element                    | Model                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Straight duct              | Plane-wave tube: cos(kL), j·Z0·sin(kL), with Z0 = ρc/S                                  |
| Conical segment            | Closed-form solution of the horn (Webster) equation for a conical flare                 |
| Exponential segment        | Closed-form solution for an exponential flare; below its cutoff it passes no real power |
| Hyperbolic-exponential (T) | Later, if a design needs it                                                             |
| Curved walls, tractrix     | Several short conical segments                                                          |
| Throat (front) chamber     | Shunt compliance V/(ρc²), between the cone and the throat                               |
| Rear chamber               | Shunt compliance, as the vented box today                                               |
| Port                       | Series acoustic mass with end corrections and losses, reusing the vent-shape code       |
| Mouth                      | Radiation impedance of a piston, in a chosen solid angle (4π, 2π, π, π/2)               |

- **Radiation impedance.** A piston in a baffle needs the Bessel J1 and the Struve H1 function. Use a published
  closed-form approximation of H1 (for example Aarts and Janssen, 2003) rather than a series.
- **Losses.** Keep the planner's leakage and port losses. Add absorption only if a reference design needs it.

### Topologies

| Topology                       | Chain                                                                    | Phase |
| ------------------------------ | ------------------------------------------------------------------------ | ----- |
| Front-loaded horn, sealed rear | rear chamber ‖ cone → throat chamber → segments → mouth                  | 1     |
| Front-loaded horn, vented rear | as above, with a port on the rear chamber; port and mouth outputs summed | 1     |
| Folded horn                    | the same chain; folds are not modeled, only the path                     | 3     |
| Tapped horn                    | both sides of the cone drive one path at two points                      | later |

### Outputs

- **SPL** at 1 m: the mouth and port volume velocities summed, with the path offset between them.
- **Cone excursion, port air speed, throat air speed,** and the **electrical impedance.**
- **Group delay,** for the front end's alignment (the top-feed all-pass in the PA v2 plan).
- **Limits:** the existing thermal, excursion and port-speed logic, on the new curves.

### Stacking

N identical boxes side by side: model one box with every area and volume times N, and N drivers in parallel. This is
exact for mirror-image units and an approximation otherwise. It gives the lower loading of stacked mouths that the
v2 plan relies on.

### Grid

Add a horn grid from about 10 Hz to 2 kHz, so the mid horns reach their 950 Hz crossover. Keep the 12–300 Hz grid for
the existing box models, so their results and the optimizer snapshots do not change.

## Limits (the same as Hornresp's)

- **1-D only.** The model holds while the cross-section is below about half a wavelength. A 500 mm mid mouth reaches
  that near 350 Hz; above it the mid horn's response is approximate.
- **No directivity.** Coverage stays a job for BEM (hornlab.io, ABEC) or measurement.
- **Folds are ideal.** Bend resonances are not modeled.
- **No cone breakup**, and mutual coupling between separate stacks is not modeled.

## Validation

Hornresp itself is not required. Check the engine in this order:

1. **Reduce to known models.** A horn chain with zero-length segments and a rear chamber must match `boxModel` and
   `closedBox` within a small tolerance, on their grid. This ties the new engine to the validated one.
2. **Analytic cases.**
   - A closed tube: quarter-wave resonances at c(2n − 1)/(4L).
   - An infinite exponential horn: throat resistance near ρc/S well above cutoff, and no real part below it.
   - A conical horn: its known throat impedance.
3. **Published designs.** Hornresp results published with their inputs (for example HOQS designs and forum
   threads). Digitize a few points and match within about 1–2 dB.
4. **Hornresp golden files,** when a machine can run it (see [Running Hornresp](#running-hornresp)).
5. **Measurement** of the built boxes with REW.

Tests follow the existing pattern: unit tests per element in `tests/`, and golden curves like
`tests/golden.test.ts`.

## Phases

1. **Engine and tests.** `src/lib/acoustics/` (or `src/lib/pa/horn/`): the complex helpers, the elements, the chain
   solver and the outputs, with the validation steps 1–3. No UI. Shared types go in `src/types.ts`.
2. **Sub bins on the PA page.** A front-loaded horn box type with a vented rear chamber, its settings in a
   `SettingsSection`, and the curves on the existing charts with their fixed axes (15 Hz–20 kHz; 80–135 dB).
3. **Mid horns and stacking.** Horn mids, N-box stacking, the 2.5-way roll-off and the summed system response. Folded
   horns as a chain without bends.
4. **Build outputs.** The 3D view and the cutlist for the flared walls. The curved side walls are the hard part:
   kerfed or bent panels, or stacked layers.
5. **Optimizers.** Let the PA optimizers size the rear chamber, port and flare.

## Open questions

1. Horn geometry as catalog data (`src/data/catalog/`) or as design settings?
2. Which solid angle by default: half space (as today) or a floor-and-wall corner for ground-stacked bins?
3. How much of the 3D view and cutlist to build for curved walls, against a flat-panel approximation?

## Running Hornresp

Hornresp is a free Windows program. Ways to run it without a Windows machine _(unverified)_:

- **Wine on a Mac** (Homebrew or CrossOver).
- **A Windows virtual machine** on a Mac (UTM or Parallels with Windows 11 on ARM).
- **A rented Windows cloud machine** (for example AWS or Azure), reached over Remote Desktop from a Mac, iPad or
  phone.
- **Wine in a cloud session.** These containers have no hardware virtualization, so a full Windows VM can't run, but
  Wine with a virtual display may. It would need a setup script each session.
