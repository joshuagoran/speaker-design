# Folded horns: boards first

The plan for folded horns on the Speaker page. It replaces the "runs" approach of PR #188 (kept as a draft).

## Why a new approach

PR #188 laid boards out around a center line. It sized each passage from a Hornresp record's areas. The results:

| Problem                          | Cause                                                                    |
| -------------------------------- | ------------------------------------------------------------------------ |
| Wavy boards                      | Each wall bent at every area step. Real boards are flat.                 |
| Boards that cross                | Two walls merged into one board when they were not parallel.             |
| Drivers through walls            | The drivers' spot was a point. No check read the cutout or the magnet.   |
| Corners that overlap             | A passage nearly as high as its run is long has big wedges at its turns. |
| Folds outside their chamber      | The fold did not follow its chamber's place in the cabinet.              |
| A "does not fit" notice on folds | The straight path's check still ran on folded paths.                     |

A record's areas summarize a builder's boards. They cannot give the boards back. Builders place boards; the air between
them is the horn. The page must work the same way.

## Scope

| Now                       | Later                                |
| ------------------------- | ------------------------------------ |
| Tapped horns              | Bandpass boxes (4th and 6th order)   |
| Offset-driver horns       | Back-loaded (rear-loaded) horns      |
| Folded front-loaded horns | Curved boards (for example, a scoop) |

- Every board runs the chamber's full inside width. A design is one side section.
- The data model leaves room for curved boards and the later loads.

## The model

**Corners and boards.** You move corners. Boards fill in between them.

| Part    | What it is                                                                                    |
| ------- | --------------------------------------------------------------------------------------------- |
| Corner  | A point in the side section. On a wall it slides along that wall. Free corners move anywhere. |
| Board   | A flat panel between two corners, one board thick, to one side of its corner line.            |
| Passage | The air between two boards (or a board and a wall), from the closed end to the mouth.         |
| Gate    | A line across the passage where the page measures it: its height times the width is its area. |
| Drivers | On a board or a wall, at a distance along it, the cone facing one side.                       |

- **Sound.** The gates give the sections: each area, and the distance along the path between gates. Straight-sided
  cells grow their area linearly (Hornresp's "Par" profile). The engine reads these sections. The taps are where the
  drivers sit along the path.
- **Build.** Each board is one rectangle: its length, the width, and the bevel at each end. The cutlist, the wood and
  the weight read the boards.
- **Views.** The side view, the 3D view and the front view draw the same boards, inside their chamber.

## Checks

A design passes every check, or the page says which one fails and what to change.

| Check                | Rule                                                           |
| -------------------- | -------------------------------------------------------------- |
| Inside the chamber   | Every board is inside its chamber.                             |
| No crossing          | No two boards touch, except at a shared corner.                |
| Passage height       | Every passage is at least 1.5 in high.                         |
| Cutout on the board  | The board runs at least 1/2 in past the cutout on each side.   |
| Magnet room          | The basket and magnet stay 1 in clear of every board and wall. |
| Cone room            | The cone side has room for the cone's depth and its excursion. |
| Straight path checks | Off for folded paths.                                          |

- Design from goals only keeps designs that pass.
- Tests run every check on every start and on Design from goals results.
- Tests also compare the side view's SVG with a stored copy. The owner reviews changes to it.

## Starting a design

- **Layouts.** Zigzag and spiral, named by shape. Each places its corners to fit the chamber and the drivers. A
  known design (TH18, SKRAM) is a start of its own, with its exact boards.
- **Design from goals.** Moves the corners of the chosen layout to meet the goals. It keeps the checks.
- **Hornresp import.** A record has no boards. Import sets the goals from the record. The page shows how close the
  boards' sound comes to the record's.

## Known designs

| Design      | Load          | Source of its boards           | Status          |
| ----------- | ------------- | ------------------------------ | --------------- |
| TH18 (Xoc1) | Tapped        | A section of the builder's STL | Boards to trace |
| SKRAM       | Offset driver | The FreeCAD sketch             | Boards to trace |
| To pick     | Front-loaded  | -                              | Owner to choose |

- Each start traces the boards from the plans, not from the record.
- The test: every check passes, and the sound is close to the builder's Hornresp result.

## The UI

A clickable mock (`docs/folded-horn-mock.html`) shows the editing model (drag corners, whole boards, the back and top walls, and the drivers; the checks and the
passage's areas update).

| Control       | Place                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Layout picker | Horn settings, under Path                                                       |
| Corner fields | Horn settings: the picked corner's distance from the baffle and height          |
| Drivers       | Horn settings: board, distance along it, the side the cone faces                |
| Checks        | Notices under the side view, one per failed check                               |
| Passage chart | Area along the path, fixed axes                                                 |
| Drag handles  | Side view: corners (squares on a wall, circles free), whole boards, the drivers |
| Box walls     | Side view: drag the back or top wall; depth and height fields                   |

## Steps

| Step | Work                                                                         | PR  |
| ---- | ---------------------------------------------------------------------------- | --- |
| 1    | Owner reviews this plan and the mock                                         | -   |
| 2    | Data model (corners, boards, gates), sections from gates, all checks, tests  | 1   |
| 3    | Views (side, 3D, front) and the cutlist from boards; the straight checks off | 1   |
| 4    | UI: layouts, drag handles, corner and driver fields, notices, passage chart  | 2   |
| 5    | Design from goals on boards                                                  | 2   |
| 6    | TH18 and SKRAM starts traced from their plans; their drivers                 | 3   |
| 7    | Later: bandpass, back-loaded, curved boards                                  | -   |

- From #188, keep: the amplifier output resistance (Rg), the TH18 reference record and test, the taps from the
  drivers' spot.
