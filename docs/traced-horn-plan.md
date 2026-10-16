# Traced folded horns: plan

This plan replaces the passage model of the folded-horn work (#190, #191). The boards stay. The app no longer stores
the passage as a recipe. It traces the passage from what the user draws.

A working mock shows the model: `docs/traced-horn-mock.html`.

## The goal

- The user draws the horn: boards, drivers and the mouth.
- The app finds the passage, measures it and plays it.
- No layout limits what the user can draw.

## What the user does

| Action           | How                                                               |
| ---------------- | ----------------------------------------------------------------- |
| Add a board      | Drag in the side view. The ends snap onto walls and other boards. |
| Move a board     | Drag the board, or drag one end. Any angle.                       |
| Delete a board   | Delete tool, then click the board.                                |
| Place drivers    | Click a board. Click again to turn the cones the other way.       |
| Move the drivers | Drag them along their board.                                      |
| Set the mouth    | Click any outer wall. Drag the opening's two ends.                |
| Size the box     | Depth, height and width fields; drag the back or top wall.        |
| Start a design   | A starting layout or Design from goals. Both give boards to edit. |

## What the app works out

| Result           | How                                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| Passage          | The air the mouth reaches. Boards, driver bodies and walls are solid.  |
| Closed end       | The air farthest from the mouth along the passage.                     |
| Path length      | The distance from the mouth to the closed end, through the air.        |
| Width along path | At each distance, the widest circle that fits in the air there.        |
| Sections         | Width times the box's inside width, every 0.5 in along the path.       |
| Sealed chambers  | Air the mouth does not reach. Each one is a separate volume.           |
| Taps             | The path distance where each side of the cones opens into the passage. |
| Horn type        | From the taps (next table).                                            |

### Horn type from the taps

| Front of the cones  | Back of the cones   | Horn type                                                 |
| ------------------- | ------------------- | --------------------------------------------------------- |
| In the passage      | In the passage      | Tapped                                                    |
| In the passage      | In a sealed chamber | Offset; front-loaded when the cones sit at the closed end |
| In a sealed chamber | In the passage      | The same, turned round                                    |
| Blocked             | Blocked             | No horn: a notice says why                                |

The Horn type setting goes away for folded horns. The drawing sets it.

## How the trace works

1. Lay a 0.25 in grid over the side section.
2. Mark every cell inside a board, a driver body or outside the walls as solid. The mouth's opening is not a wall.
3. Find each air cell's distance from the mouth through the air (eight neighbors, √2 on the diagonal).
4. Air with no distance is sealed. Group it into chambers.
5. Find each air cell's clearance: its distance to the nearest solid cell.
6. For each 0.5 in band of distance, the width is twice the largest clearance in the band.
7. Smooth the widths over 2.5 in. Turn them into sections for the sound model.

The mock does this in a few milliseconds per change for a 30 × 40 in box.

## Checks

| Check        | Fails when                                                   |
| ------------ | ------------------------------------------------------------ |
| Mouth        | The mouth opens onto a board.                                |
| Drivers      | Neither side of the cones opens into the passage.            |
| Rear chamber | One side of the cones faces a board with no air behind it.   |
| Cutout       | A cutout runs off its board, with ½ in to spare.             |
| Magnet       | A motor comes within 1 in of a board or a wall.              |
| Dead end     | The cones first open past 40% of the path.                   |
| Choke        | The width falls under ¾ of its median over the 15 in before. |
| Stray air    | A sealed pocket that no driver uses.                         |
| Thin         | The width falls under 1.5 in.                                |

These replace the recipe checks (crossing, broken, outside, shortcut). A drawing cannot cross itself into a wrong
passage any more: the trace follows the air.

## The rest of the app

| Part                | Change                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Data                | Boards (two ends each), drivers (board, place along it, cone side), mouth (wall, two ends) |
| Sound model         | Reads the traced sections, the taps and the sealed chamber's volume                        |
| Rear chamber vents  | Open from the sealed chamber that holds the backs of the cones                             |
| Starting layouts    | Give boards, drivers and a mouth only                                                      |
| Design from goals   | Moves board ends and the drivers; scores the traced passage                                |
| Side view           | As the mock: passage shaded along the path, closed end marked                              |
| 3D view and cutlist | Boards as now                                                                              |
| Saved designs       | Boards from #190 convert: their ends, the drivers' spot, the mouth from the mouth wall     |

## Risks

| Risk                                     | Plan                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Widths in turns read a little wide       | Smoothing and the median in the choke check. Compare with Hornresp records. |
| A 0.25 in grid misses a thin gap         | Boards snap onto each other, so joints close. A gap under 0.5 in warns.     |
| Large boxes trace slowly                 | A coarser grid while dragging, the fine grid when the drag ends.            |
| The sound model gets many short sections | Merge sections that differ by under 2%.                                     |

## Acceptance tasks

The owner does these on the page. I do them in the browser before every hand-over.

1. Start from an empty box. Draw a tapped horn with three boards. Read its path and taps.
2. Move the drivers to another board. The horn type changes when it should.
3. Move the mouth to the top wall. The passage and path update.
4. Add a board across a leg. The passage reroutes or a check says why not.
5. Delete a board. Nothing breaks.
6. Port the sealed chamber of an offset horn. The port stays in that chamber.
7. Run Design from goals, then edit its boards by hand.

## Steps

| Step | Work                                                                      | PR  |
| ---- | ------------------------------------------------------------------------- | --- |
| 1    | Owner tests the mock and approves this plan                               | -   |
| 2    | The trace, its checks, the new data and the sound model input, with tests | 1   |
| 3    | The side view editor (the mock's tools), the 3D view and the cutlist      | 1   |
| 4    | Rear chamber vents, starting layouts and Design from goals on the trace   | 2   |
| 5    | Convert saved boards; remove the recipe model                             | 2   |
