# Speaker page: update plan

## The goal

Less scrolling, with no loss of use. Show only the settings that do something for the chamber. Horns and boxes get the settings each one uses.

Today, with the TH18 template and every fold open, the results pane is about 2,700 px tall and the settings column about 3,900 px.

## Owner's list

| #   | Change                                                                                          |
| --- | ----------------------------------------------------------------------------------------------- |
| 1   | Fix the black interior in the 3D view. It must look as it does with an inset baffle.            |
| 2   | An icon button on the 3D view shows or hides the drivers.                                       |
| 3   | The 2D drawing gets a side view.                                                                |
| 4   | The text blocks under the charts go into one Details fold at the bottom, as bullets or a table. |
| 5   | Remove the "The speaker" heading.                                                               |
| 6   | Redo Fiber fill. It must say what to do and what it does.                                       |
| 7   | Refine and reorganize every section to cut scrolling, with no loss of use.                      |
| 8   | Each driver gets a delete icon button (trash) at its top right.                                 |
| 9   | Add driver gets its own line, under the last driver.                                            |
| 10  | The driver position fields ("From left", "Back from front") are confusing. Make them clear.     |

## Proposals

### Levels

Each setting sits at the level it belongs to.

| Level        | Settings                                                           |
| ------------ | ------------------------------------------------------------------ |
| Speaker      | Name, start from, bands, amps, input range                         |
| Cabinet      | Construction, wall panels, hardware, look                          |
| Chamber      | Type (Box or Horn), Path, size, then only what that type uses      |
| Box chamber  | Vent, fiber fill, bracing, back panel, drivers                     |
| Horn chamber | Goals, Design from goals, horn type, the side view editor, drivers |

- Bracing and back panel move from Construction to each Box chamber. A horn chamber gets no added braces: its boards brace the panels.
- Arched top: Box-only speakers (Decisions).

### Results pane

| Part                         | Change                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Views                        | 3D and 2D side by side, as now. The 2D view has Front and Side buttons. The 3D view has a drivers button (icon).                                                        |
| Folded horn                  | No change (editor and chart side by side).                                                                                                                              |
| Response and Maximum output  | Side by side when the pane is wide. The tiles stay under each chart.                                                                                                    |
| Chamber checks               | One compact row of chips per chamber. Each chip's text goes in its tooltip.                                                                                             |
| Price, weight, bracing       | One row of tiles. Its notes go to Details.                                                                                                                              |
| Details (new, at the bottom) | Every note now under a chart: what the response includes, what the price counts, how bracing is set, what the maximum output stops at. Short bullets, grouped by chart. |

### Settings column

| Section           | Change                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speaker           | "Start from" and its button on one row. The warning goes into the button's tooltip.                                                                                    |
| Construction      | Construction, wall panels and hardware only.                                                                                                                           |
| Chamber           | Type and Path on one row. Width, height and depth on one row. Fiber fill with its effect (below).                                                                      |
| Horn              | Goals on one row with Design from goals. Horn type. Straight horn and Import in folds.                                                                                 |
| Drivers           | Each driver is a box with a trash icon at its top right. Type and Size on one row. Model and Count on one row. Band. Add driver on its own line under the last driver. |
| Bands and filters | Filter types in dropdowns, not six-button rows. Corner and level fields beside them.                                                                                   |
| Optimizer         | No change.                                                                                                                                                             |

### Driver position

- Drag the drivers in the Front view. The fields follow.
- The labels follow the convention in #173 (owner approved). The code keeps x, y and z.

| Axis                           | Label                    | Measured from (in the tooltip)            |
| ------------------------------ | ------------------------ | ----------------------------------------- |
| Left/right                     | Left (−) / Right (+), in | The chamber's center, seen from the front |
| Up/down                        | Down (−) / Up (+), in    | The chamber's bottom                      |
| Front/back (a horn on the top) | Front (−) / Back (+), in | The front edge                            |

- The Front view marks the point a field measures from, while the field has focus.
- The first PR that uses these labels adds them to CLAUDE.md as a UI rule.

### Input range

From #173 (owner, Oct 2026):

- Rename "Input range" to "External crossover". Tooltip: "The filters in your DSP or amp, before this speaker."
- Remove the line under the heading. The tooltip says the same.
- One spelling for filter names: "High-pass" and "Low-pass".

### Fiber fill

The control names what to do, and a line shows what it does.

| Choice | What you do                      |
| ------ | -------------------------------- |
| None   | No fill                          |
| Lined  | Line the walls, about 1 in thick |
| Half   | Fill about half the air, loosely |
| Full   | Fill all the air, loosely        |

- Beside it: "Acts as 352 L (+10%)". The net air and its gain, from the chamber.
- Tooltip: "Polyester fiber slows the air in the box. The box then acts larger and tunes a little lower."
- A drawn tapped horn has no rear chamber: no fill control.

## Owner's tasks (acceptance tests)

Run each in the mock first, then in the app before every hand-over.

1. Open the TH18 template. See the whole design with less scrolling than today.
2. Show and hide the drivers in the 3D view. The interior is not black.
3. Switch the 2D view between Front and Side.
4. Find what the response chart includes, in Details.
5. Change a chamber from Box to Horn. Bracing and back panel go away; the horn settings come.
6. Set fiber fill. Read what it does without a tooltip.
7. Set a band's highpass and lowpass without long button rows.
8. Add a second driver, then delete it with its trash icon.
9. Move a driver on the baffle by dragging it in the Front view. Read its position in the fields.

## Decisions

1. Arched top: keep it, for speakers with only Box chambers. A speaker with a horn chamber does not show it.
2. Chamber checks: chips, as now. Their long text goes into each chip's tooltip, so no text blocks stay on the page.

## Steps

| Step | Work                                                                            | PR   |
| ---- | ------------------------------------------------------------------------------- | ---- |
| 1    | This plan and a working mock; owner tests the mock                              | this |
| 2    | Black interior, drivers button, side view                                       | 1    |
| 3    | Details fold, headings, results layout                                          | 1    |
| 4    | Levels: bracing and back panel per Box chamber; saved designs keep their choice | 2    |
| 5    | Settings layout, fiber fill, filter dropdowns                                   | 2    |
