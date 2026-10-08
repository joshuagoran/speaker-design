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
- Ribs: none by default; the seam flanges stiffen the walls. With `--rib-angles` (for example `60,120,240,300`)
  you get radial ribs that taper from 15 mm at the rear to 5 mm at the mouth, with a ramp at the rear end.
- Seam flanges on the four quarter seams, 3 mm per quarter (6 mm per seam), with M4 bolt holes and 4 mm dowel
  holes. They stay full height so the bolt heads and nuts fit. At the mouth end (the lip, or the roll end) each
  flange comes down to the wall instead of ending square, so it dies into the lip: along a straight 40 mm ramp
  with blended ends (`--seam-end taper`, the default), or a convex quarter curve over its last 15 mm
  (`--seam-end round`). `--seam-end-l` sets the length; 0 gives a square end. The bolt and dowel holes stay where the flange is full
  height. The seams are meant to be glued (see below).
- Throat fins on part T, on the seam planes. Each fin runs from the driver flange's front face to the T / quarter
  split. It has the seam flange's thickness and top line, so fin and flange read as one spine. An R8 round
  (`--fin-root-r`) joins each fin to the flange face. The script stops if a fin would hit a driver bolt hole.
- A full round on the top edges of the fins and seam flanges (radius half the thickness). The whole top line is
  smoothed (3 mm Gaussian) so the round can follow it; that only shows near a roll, where the wall bends tight. If
  OCC cannot build the round on a spine, the script uses a chamfer there and says so in `PRINT_README.md`. Nothing
  is rounded on the inner surface.
- Throat part T and quarters Q1 to Q4. A lap joint joins T to the quarters with no gap or step on the inner surface.
- No mounting foot by default: the plywood throat mount carries the horn. `--feet center` adds one center foot
  under the mouth and `--feet pair` adds two.

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

| Option                                 | Default                        | Meaning                                                       |
| -------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `--step`, `--bem`                      |                                | STEP file and BEM JSON file                                   |
| `--out`                                | `horn-print-out`               | Output folder; keep it outside the repository                 |
| `--wall`                               | `step`                         | Wall thickness in mm, or `step` to keep the STEP shell        |
| `--lip`                                | `auto`                         | `ring`, `none`, or `auto` (ring for a plain mouth)            |
| `--lip-out`, `--lip-depth`             | 5, 6                           | Lip ring width past the outer wall, and depth along the axis  |
| `--rib-angles`                         | `none`                         | Rib planes in degrees from +x, or `none`                      |
| `--rib-t`, `--rib-h`, `--rib-h-end`    | 6, 15, 5                       | Rib thickness, rear height, mouth height                      |
| `--rib-taper` / `--no-rib-taper`       | on                             | Taper the ribs toward the mouth                               |
| `--seam-t`, `--seam-h`                 | 3, 15                          | Seam flange and fin thickness per quarter, and height         |
| `--fin-root-r`                         | 8                              | Round where a throat fin meets the driver flange face         |
| `--seam-end`, `--seam-end-l`           | `taper`, 40 (15 for `round`)   | Seam flange mouth end: `taper` or `round`, and its length     |
| `--bolt-f`, `--dowel-f`                | `0.2,0.55,0.85`, `0.37,0.72`   | Hole positions as fractions of the seam length                |
| `--split-z`, `--joint-l`               | 55, 12                         | T to quarter split, and lap length                            |
| `--feet`                               | `none`                         | `center`, `pair` or `none`                                    |
| `--foot-x`                             | 120                            | Pair only: feet at plus and minus this x                      |
| `--foot-w`, `--foot-depth`, `--foot-t` | 120 or 50, 45, 8               | Foot plate size                                               |
| `--foot-fastener`                      | `m6` (center), `screws` (pair) | One M6 bolt with a counterbore, or #8 countersunk wood screws |
| `--build-vol`                          | `256,256,260`                  | Printer build volume in mm                                    |
| `--draft`                              | off                            | Fast draft into `<out>-draft`; not for printing (see below)   |

## Draft builds

Add `--draft` to try a change quickly. A draft of the R-OSSE takes about 1.5 minutes instead of 3.5. It writes to
`<out>-draft`, so it never overwrites print files, and it says DRAFT at the top of `PRINT_README.md` and in the
`CHECK` line. A draft:

- writes coarse STLs (0.3 mm chord, 0.5 rad);
- skips the top round on the fins and seam flanges (square tops);
- checks the inner surface sparsely: every third BEM profile point and radial planes every 45 degrees. It still
  fails on any material on the air side;
- renders one low-resolution preview;
- runs the body stages in one process, and the quarters with the quarter ring.

It keeps the solid, watertight, bed-fit, seam and fin checks. Rebuild without `--draft` before you print.

## Outputs

In the `--out` folder:

- `horn_assembled.step`: the whole horn as one solid.
- `horn_parts_assembly.step`: the five parts in place.
- `part_T`, `part_Q1` to `part_Q4`: `.step` and `.stl` (0.05 mm chord tolerance).
- `preview_assembly.png`, `preview_exploded.png`, `preview_side.png`, `preview_sections.png`.
- `PRINT_README.md`: part list, sizes, print orientation, solid masses in PETG and ASA with a rough estimate for a
  gyroid print, hardware, assembly, the plywood throat mount and print notes (with Bambu Studio settings).
- `_work/`: `wall.brep`, `b1.brep` to `b4.brep` and `body.brep` (the horn after each body stage), `T.brep`,
  `Qall.brep`, `Q1.brep` to `Q4.brep`, `<part>_coarse.stl` (coarse meshes for the previews), `step_info.json`
  (what the STEP contains), `body_info.json` (lip, foot and hole data) and `check.json` (check results).

## Gluing the seams

The thin seam flanges are meant to be glued with ASA slurry: ASA scraps dissolved in acetone. Brush it on both faces
of each seam, then bolt the seam. The M4 bolts clamp it while the slurry cures. Work outdoors or with strong
ventilation. Slurry bonds ASA and ABS only; for PETG, rely on the bolts or use epoxy.

## Plywood throat mount

`PRINT_README.md` sizes a 1/2 in (12 mm) birch ply mount from the model. The upright sits against the driver
flange's front face, on a ply base screwed to the lid, with one gusset. It is written for a driver with 1/4-20
tapped holes, such as the N314T.

- Width: the flange diameter (130 mm for the R-OSSE).
- Top edge: half the spine width plus 1 mm below the horn axis (4 mm), so it clears the side fins. The half width is
  `--seam-t`, or `--seam-trim` plus 1 mm if that is more (a thicker wall adds strip ribs that wide).
- Saddle: a half circle for the neck. Its radius is the neck's largest outer radius across the ply (z = 12 to 24 for
  the R-OSSE) plus 1.5 mm, rounded up (R32).
- Slot: the spine width + 1 mm (7 mm), from the saddle down to the bottom fin's reach across the ply plus 1 mm,
  rounded up to 0.5 mm (r = 52 mm).
- Holes: each driver bolt either goes through the ply (its 1/4 in washer, about 6 mm past the hole edge, lies
  wholly below the top edge) or sits on the horn flange face (its washer lies wholly above). The script stops if a
  washer would straddle the edge, or if a washer on the flange face would touch a fin. For the 45 deg pattern,
  the bottom 2 bolts are 1/4-20 x 1-1/4 in through the ply and the horn flange, and the top 2 are 1/4-20 x 3/4 in
  through the horn flange only.
- Height: from the axis height above the lid, with the horn's lowest point on the lid.
- Gusset: a 45 deg triangle at x = 0 on the mouth side. Its legs are the longest (in 5 mm steps) that stay 3 mm
  below the bottom fin and seam flange, and below the slot. The base runs from the flange face to the gusset's end.
- With a foot (`--feet`), the base stops 5 mm short of the foot and the gusset 5 mm short of the center foot's web.
  If that leaves less than 20 mm of gusset, `PRINT_README.md` says to brace the upright another way.

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
- The quarters need supports under the outer wall and the lip or roll, and under any ribs and foot. The inner
  surface faces up and needs none.
- Thickening a wall adds an outer layer that stops 2 mm short of each seam plane. Small strip ribs and the throat
  fins on T, and the seam flanges on the quarters, close that gap.
- Fusing the features into a thickened B-spline wall is slow (up to about a minute per stage).
