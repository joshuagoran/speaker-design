# horn-print

`horn_print.py` turns a hornlab.io waveguide into a horn you can 3D print.
It reads the hornlab STEP solid and the BEM JSON export of the same design.
It writes a throat part and four quarters as STEP and STL files, with previews, checks and a `PRINT_README.md`.

This tool is separate from the web app. It is not part of the build, the tests or CI.

## What it builds

- The inner (acoustic) surface stays exactly as designed. The script keeps the STEP's own faces and only adds
  material outside them.
- Wall: the STEP shell as designed, or thicker with `--wall`. A wall thinner than the STEP shell is refused.
- Mouth lip: a small ring flush with the mouth plane. There is no ring when the profile rolls back (the outside of
  the roll is acoustic surface) or when the design has a mouth flange (the flange is kept as designed).
- Ribs: radial ribs on the wide walls. By default they taper from 15 mm at the rear to 5 mm at the mouth, with a
  ramp at the rear end.
- Seam flanges on the four quarter seams, with M4 bolt holes and 4 mm dowel holes. They stay full height so the
  bolt heads and nuts fit.
- Gussets from the driver flange to the wall, halfway between the driver bolts.
- Throat part T and quarters Q1 to Q4. A lap joint joins T to the quarters with no gap or step on the inner surface.
- A mounting foot on the bottom: one center foot (default) or two feet. A design with a mouth flange gets no foot
  unless you ask for one.

The design must have a throat (driver) flange, and its JSON must include the build settings
(`design.parameters.build`) and the profiles in mm. The script stops with a clear message otherwise.

## Setup

Python 3.11 to 3.14. The OCP wheel is about 100 MB.
Keep the virtual environment outside the repository, for example:

```sh
python3 -m venv ~/.venvs/horn-print
~/.venvs/horn-print/bin/pip install -r tools/horn-print/requirements.txt
```

## Usage

Keep the STEP and JSON inputs and the output folder outside the repository too.
Run every stage in order with `all`:

```sh
~/.venvs/horn-print/bin/python -I tools/horn-print/horn_print.py \
  --step ~/horns/os-maybe-build.step --bem ~/horns/os-bem-30pt.json --out ~/horns/print-os --wall 8 all

~/.venvs/horn-print/bin/python -I tools/horn-print/horn_print.py \
  --step ~/horns/rosse-110x50.step --bem ~/horns/rosse-bem-30pt.json --out ~/horns/print-rosse all
```

Or run one stage at a time. Each stage reads the previous stage's files from `<out>/_work`:

```text
wall
body lip | body seams | body ribs | body feet | body holes
split T | split Qall
quarter 1 | quarter 2 | quarter 3 | quarter 4
export | check | render | readme
```

Each stage takes from a few seconds to about a minute and a half. The two `split` stages and the four `quarter`
stages can run in parallel. `check` exits with status 1 and prints `CHECK FAIL` when a check fails; `all` still
writes the previews and `PRINT_README.md`, then exits with status 1.

## Main options

`--help` lists every option with its default. `--step` and `--bem` are required.

| Option                                 | Default                         | Meaning                                                       |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `--step`, `--bem`                      |                                 | STEP file and BEM JSON file                                   |
| `--out`                                | `horn-print-out`                | Output folder; keep it outside the repository                 |
| `--wall`                               | `step`                          | Wall thickness in mm, or `step` to keep the STEP shell        |
| `--lip`                                | `auto`                          | `ring`, `none`, or `auto` (ring for a plain mouth)            |
| `--lip-out`, `--lip-depth`             | 5, 6                            | Lip ring width past the outer wall, and depth along the axis  |
| `--rib-angles`                         | `60,120,240,300`                | Rib planes in degrees from +x                                 |
| `--rib-t`, `--rib-h`, `--rib-h-end`    | 6, 15, 5                        | Rib thickness, rear height, mouth height                      |
| `--rib-taper` / `--no-rib-taper`       | on                              | Taper the ribs toward the mouth                               |
| `--seam-t`, `--seam-h`                 | 6, 15                           | Seam flange thickness per quarter, and height                 |
| `--bolt-f`, `--dowel-f`                | `0.2,0.55,0.85`, `0.37,0.72`    | Hole positions as fractions of the seam length                |
| `--split-z`, `--joint-l`               | 55, 12                          | T to quarter split, and lap length                            |
| `--feet`                               | `center` (`none` with a flange) | `center`, `pair` or `none`                                    |
| `--foot-x`                             | 120                             | Pair only: feet at plus and minus this x                      |
| `--foot-w`, `--foot-depth`, `--foot-t` | 120 or 50, 45, 8                | Foot plate size                                               |
| `--foot-fastener`                      | `m6` (center), `screws` (pair)  | One M6 bolt with a counterbore, or #8 countersunk wood screws |
| `--build-vol`                          | `256,256,260`                   | Printer build volume in mm                                    |

## Outputs

In the `--out` folder:

- `horn_assembled.step`: the whole horn as one solid.
- `horn_parts_assembly.step`: the five parts in place.
- `part_T`, `part_Q1` to `part_Q4`: `.step` and `.stl` (0.05 mm chord tolerance).
- `preview_assembly.png`, `preview_exploded.png`, `preview_side.png`, `preview_sections.png`.
- `PRINT_README.md`: part list, sizes, print orientation, masses in PETG and ASA, hardware and print notes.
- `_work/`: `wall.brep`, `b1.brep` to `b4.brep` and `body.brep` (the horn after each body stage), `T.brep`,
  `Qall.brep`, `Q1.brep` to `Q4.brep`, `<part>_coarse.stl` (coarse meshes for the previews), `step_info.json`
  (what the STEP contains), `body_info.json` (lip, foot and hole data) and `check.json` (check results).

## Checks

The `check` stage writes `_work/check.json` and fails when any of these fail:

- Every part and the assembled horn is a valid single solid.
- Every STL is watertight.
- 300 random triangle centroids of `part_Q1.stl` lie within the chord tolerance of the Q1 solid.
- Inner surface, in two ways. First, every point of the BEM profiles in the horizontal and vertical symmetry
  planes, on both sides, lies within 0.2 mm of the parts' cut through that plane. Second, the STEP's own inner
  surface, sampled every 1 mm along radial planes every 15 degrees, lies within 0.2 mm of the parts' cut. In every
  one of those planes, no cut point lies more than 0.2 mm on the air side of the reference. The surface between
  those planes is not sampled.
- Every part fits the build volume. It tries the axis-aligned placement first, then turns the part on the bed.

## Limits

- Built for hornlab.io exports: a B-rep solid with a round driver flange, and a horn symmetric about x = 0 and
  y = 0. The seams are those two planes.
- A mouth flange is kept as designed, but the tool has only been tested on horns without one.
- With a rollback, the foot sits just behind the roll end. The space under the roll belongs to the acoustic surface.
- The quarters need supports under the outer wall, the lip or roll, the ribs and the foot. The inner surface faces
  up and needs none.
- Thickening a wall adds an outer layer that stops 2 mm short of each seam plane. Small strip ribs on T and the seam
  flanges on the quarters close that gap.
- Fusing the features into a thickened B-spline wall is slow (up to about a minute per stage).
