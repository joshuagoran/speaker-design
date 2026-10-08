# horn-print

`horn_print.py` turns a hornlab.io waveguide into a horn you can 3D print.
It reads the hornlab STEP solid and the BEM JSON export of the same design.
It writes a throat part and four quarters as STEP and STL files, with previews, checks and a README.

This tool is separate from the web app. It is not part of the build, the tests or CI.

## What it builds

- The inner (acoustic) surface stays exactly as designed. The script keeps the STEP's own faces and only adds
  material outside them.
- Wall: the STEP shell as designed, or thicker with `--wall`.
- Mouth lip: a small ring flush with the mouth plane. A profile that rolls back gets no ring, because the outside
  of the roll is acoustic surface. There the roll is the stiff edge.
- Ribs: radial ribs on the wide walls. By default they taper from 15 mm at the rear to 5 mm at the mouth, with a
  45 degree ramp at the rear end.
- Seam flanges on the four quarter seams, with M4 bolt holes and 4 mm dowel holes. They stay full height so the
  bolt heads and nuts fit.
- Four gussets from the driver flange to the wall, clear of the diagonal driver bolts.
- Throat part T and quarters Q1 to Q4. A lap joint joins T to the quarters with no gap or step on the inner surface.
- A mounting foot on the bottom: one center foot (default) or two feet.

## Setup

Python 3.11 or newer. The OCP wheel is about 100 MB.

```sh
python3 -m venv .venv
.venv/bin/pip install -r tools/horn-print/requirements.txt
```

## Usage

Run every step in order with `all`:

```sh
.venv/bin/python -I tools/horn-print/horn_print.py \
  --step os-maybe-build.step --bem os-bem-30pt.json --out print-os --wall 8 all

.venv/bin/python -I tools/horn-print/horn_print.py \
  --step rosse-110x50.step --bem rosse-bem-30pt.json --out print-rosse all
```

Or run one step at a time. Each step reads the previous step's files from `<out>/_work`:

```text
wall
body lip | body seams | body ribs | body feet | body holes
split T | split Qall
quarter 1 | quarter 2 | quarter 3 | quarter 4
export | check | render | readme
```

Each step takes from a few seconds to about a minute and a half. The two `split` steps and the four `quarter` steps
can run in parallel.

## Main options

| Option                                 | Default                        | Meaning                                                        |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| `--step`, `--bem`, `--out`             |                                | STEP file, BEM JSON file, output folder                        |
| `--wall`                               | `step`                         | Wall thickness in mm, or `step` to keep the STEP shell         |
| `--lip`                                | `auto`                         | `ring`, `none`, or `auto` (ring unless the profile rolls back) |
| `--lip-out`, `--lip-depth`             | 5, 6                           | Lip ring width past the outer wall, and depth along the axis   |
| `--rib-angles`                         | `60,120,240,300`               | Rib planes in degrees from +x                                  |
| `--rib-t`, `--rib-h`, `--rib-h-end`    | 6, 15, 5                       | Rib thickness, rear height, mouth height                       |
| `--rib-taper` / `--no-rib-taper`       | on                             | Taper the ribs toward the mouth                                |
| `--seam-t`, `--seam-h`                 | 6, 15                          | Seam flange thickness per quarter, and height                  |
| `--bolt-f`, `--dowel-f`                | `0.2,0.55,0.85`, `0.37,0.72`   | Hole positions as fractions of the seam length                 |
| `--split-z`, `--joint-l`               | 55, 12                         | T to quarter split, and lap length                             |
| `--feet`                               | `center`                       | `center`, `pair` or `none`                                     |
| `--foot-x`                             | 120                            | Pair only: feet at plus and minus this x                       |
| `--foot-w`, `--foot-depth`, `--foot-t` | 120 or 50, 45, 8               | Foot plate size                                                |
| `--foot-fastener`                      | `m6` (center), `screws` (pair) | One M6 bolt with a counterbore, or #8 countersunk wood screws  |
| `--build-vol`                          | `256,256,260`                  | Printer build volume in mm                                     |

`--help` lists every option. The other sizes are constants at the top of the script.

## Outputs

In the `--out` folder:

- `horn_assembled.step`: the whole horn as one solid.
- `horn_parts_assembly.step`: the five parts in place.
- `part_T`, `part_Q1` to `part_Q4`: `.step` and `.stl` (0.05 mm chord tolerance).
- `preview_assembly.png`, `preview_exploded.png`, `preview_side.png`, `preview_sections.png`.
- `README.md`: part list, sizes, print orientation, masses in PETG and ASA, hardware and print notes.
- `_work/`: intermediate BREP files and the check results (`check.json`).

## Checks

The `check` step writes `_work/check.json`:

- Every part and the assembled horn is a valid single solid.
- Every STL is watertight. A sample of STL triangles lies within the chord tolerance of the solid.
- The inner surface matches the BEM profiles in both symmetry planes, rollback included. No part lies more than
  0.2 mm on the air side of the profile.
- Every part fits the build volume. It tries the axis-aligned placement first, then turns the part on the bed.

## Limits

- Built for hornlab.io exports: a B-rep solid with a round driver flange, and a symmetric horn. The seams are the
  x = 0 and y = 0 planes.
- With a rollback, the foot sits just behind the roll end. The space under the roll belongs to the acoustic surface.
- The quarters need supports under the outer wall, the lip or roll, the ribs and the foot. The inner surface faces
  up and needs none.
- Thickening a wall adds an outer layer that stops 2 mm short of each seam plane. Small strip ribs on T and the seam
  flanges on the quarters close that gap.
- Fusing the features into the B-spline wall is slow for thick walls (up to about a minute per step).
