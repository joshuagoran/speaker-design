# Traced folded horns: plan

This plan replaces the passage model of the folded-horn work (#190, #191). The boards stay. The app no longer stores
the passage as a recipe. It traces the passage from what the user draws.

A working mock shows the model: `docs/traced-horn-mock.html`.

## The goal

- A folded horn is a straight horn, folded. The design starts from the straight horn.
- The user draws the fold: boards, drivers and the mouth.
- The app finds the passage, measures it, compares it with the straight horn and plays it.
- No layout limits what the user can draw.
- Every drawing gives a cutlist.

## What the user does

| Action           | How                                                               |
| ---------------- | ----------------------------------------------------------------- |
| Add a board      | Drag in the side view. The ends snap onto walls and other boards. |
| Join boards      | Drop an end on another board's end (corner) or edge (butt).       |
| Move a board     | Drag the board, or drag one end. Joined ends move with it.        |
| Square only      | A switch. Board ends then move only across or up and down.        |
| Delete a board   | Delete tool, then click the board.                                |
| Place drivers    | Click a board. Click again to turn the cones the other way.       |
| Move the drivers | Drag them along their board.                                      |
| Set the mouth    | Click any outer wall. Drag the opening's two ends.                |
| Size the box     | Depth, height and width fields; drag the back or top wall.        |
| Start a design   | A starting layout or Design from goals. Both give boards to edit. |
| Read the path    | Point in the side view: the chart marks that spot on the path.    |
| Find a spot      | Point at the chart: the side view lights that band of air.        |

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
| Match            | How far the traced sections stray from the straight horn, in dB.       |
| Cutlist          | Each board's long edge and the cut at each end (next section).         |

### Horn type from the taps

| Front of the cones  | Back of the cones   | Horn type                                                 |
| ------------------- | ------------------- | --------------------------------------------------------- |
| In the passage      | In the passage      | Tapped                                                    |
| In the passage      | In a sealed chamber | Offset; front-loaded when the cones sit at the closed end |
| In a sealed chamber | In the passage      | The same, turned round                                    |
| Blocked             | Blocked             | No horn: a notice says why                                |

The Horn type setting goes away for folded horns. The drawing sets it.

## Straight horn first

1. Design from goals sizes the straight horn: length, start and mouth area, flare.
2. The app places boards so the traced passage follows it.
3. The chart shows the straight horn (dashed) and the traced passage.
4. The user edits the boards by hand. The match readout updates.

## Cutlist

| End meets      | Cut                                             |
| -------------- | ----------------------------------------------- |
| Another end    | Mitre on the line that halves the corner        |
| A wall         | Square or bevel to the wall                     |
| Another's edge | Butt: cut to that board's face, square or bevel |
| Nothing        | Square                                          |

The long edge comes from the board's faces between its two cuts. The bevel angle is shown when it is not 0°.

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

| Part               | Change                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Data               | Boards (two ends each), drivers (board, place along it, cone side), mouth (wall, two ends) |
| Sound model        | Reads the traced sections, the taps and the sealed chamber's volume                        |
| Rear chamber vents | Open from the sealed chamber that holds the backs of the cones                             |
| Starting layouts   | Give boards, drivers and a mouth only                                                      |
| Design from goals  | Moves board ends and the drivers; scores the traced passage                                |
| Side view          | As the mock: passage shaded along the path, closed end marked, linked to the path chart    |
| Path chart         | Traced width along the path, the straight horn dashed, fixed axes                          |
| 3D view            | Boards as now, with mitres and butts                                                       |
| Cutlist            | From the joints (Cutlist section)                                                          |
| Saved designs      | Boards from #190 convert: their ends, the drivers' spot, the mouth from the mouth wall     |

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
8. Join two boards at a corner and one at an edge. The cutlist shows a mitre and a butt.
9. Turn on Square only. Drag an end. It stays square.
10. Point at the chart. The side view lights the right band.

## Steps

| Step | Work                                                                                                      | PR  |
| ---- | --------------------------------------------------------------------------------------------------------- | --- |
| 1    | Owner tests the mock and approves this plan                                                               | -   |
| 2    | The trace, its checks, the new data and the sound model input, with tests                                 | 1   |
| 3    | The side view editor (the mock's tools, joints, Square only), the path chart, the 3D view and the cutlist | 1   |
| 4    | Rear chamber vents, starting layouts, Design from goals (straight horn first)                             | 2   |
| 5    | Convert saved boards; remove the recipe model                                                             | 2   |
