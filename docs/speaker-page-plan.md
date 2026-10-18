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

| Level        | Settings                                                                        |
| ------------ | ------------------------------------------------------------------------------- |
| Speaker      | Bands, amps, external crossover. The name sits in the saved configurations row. |
| Cabinet      | Construction, wall panels, hardware, look                                       |
| Chamber      | Type (Box or Horn), Path, size, then only what that type uses                   |
| Box chamber  | Vent, fiber fill, bracing, back panel, drivers                                  |
| Horn chamber | Goals, Design from goals, horn type, the side view editor, drivers              |

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

| Section           | Change                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speaker           | Removed. The name and "New from…" sit in the saved configurations row (full save and open redesign: #180).                                                              |
| Construction      | Construction, wall panels and hardware only.                                                                                                                            |
| Chamber           | Sub-sections, each a light inset box with a small heading: Size, Vent, Fill and bracing (Box), Horn (Horn), Drivers. Type and Path on one row; dimensions on one row.   |
| Horn              | Goals on one row with Design from goals (its tooltip says what it reads and sets). Horn type. Straight horn read-only, with "Edit by hand". "Import a Hornresp record". |
| Drivers           | Each driver is a box with a trash icon at its top right. Type and Size on one row. Model and Count on one row. Band. Add driver on its own line under the last driver.  |
| Bands and filters | Filter types in dropdowns, not six-button rows. Corner and level fields beside them.                                                                                    |
| Optimizer         | No change.                                                                                                                                                              |

### Band colors

Each band keeps one color everywhere: its chart line. Low to high: the lowest yellow, the highest cyan, the ones between magenta (every second one dashed). A single band is yellow.

- Yellow lines need a new palette token, "yellow line": a deep gold (#b08000) in the light theme, so a line passes 3:1 on white; the brand yellow in the dark theme.

- The 2D views draw each driver in its band's color. A coaxial driver shows both of its bands.
- The Bands menu shows the color as a swatch before each band's name.
- Each driver's summary line shows its band's swatch. The chart legends use the same swatches.

### All sections

- Drivers, Vent, Fill and bracing, Horn settings and each band fold to one summary line, for example "2 × B&C 18TBX100 · Low band". Click the line to open it. Size and Goals stay open.
- A filter that is off is one short row.

- Field labels carry no unit: every length is inches. A units setting comes later (#149).
- A fold's summary wraps under its title in small text, up to two lines. Summaries keep to the key facts.
- Net air is always worked out for a Box chamber: no Auto/Custom control. A straight horn shows "Rear chamber" in Horn settings, set by Design from goals or a Hornresp import, with "Edit by hand".
- A driver's Band tooltip: "The band from Bands and filters that plays this driver."
- The chamber's position uses the same labels: "Left (−) / Right (+)" from the cabinet's center, "Down (−) / Up (+)" from its bottom.
- Taps: "Front tap after section", "Back tap after section", "Taps from closed end". Tooltip: "Where the front and back of the cones join the horn, counted from the closed end."

### Driver position

- Drag the drivers in the Front view. The fields follow.
- The labels follow the convention in #173 (owner approved). The code keeps x, y and z.

| Axis                           | Label                | Measured from (in the tooltip)            |
| ------------------------------ | -------------------- | ----------------------------------------- |
| Left/right                     | Left (−) / Right (+) | The chamber's center, seen from the front |
| Up/down                        | Down (−) / Up (+)    | The chamber's bottom                      |
| Front/back (a horn on the top) | Front (−) / Back (+) | The front edge                            |

- The Front view marks the point a field measures from, while the field has focus.
- The first PR that uses these labels adds them to CLAUDE.md as a UI rule.

### Input range

From #173 (owner, Oct 2026):

- Rename "Input range" to "External crossover". Tooltip: "The filters in your DSP or amp, before this speaker."
- Remove the line under the heading. The tooltip says the same.
- One spelling for filter names: "High-pass" and "Low-pass".

### Fiber fill

The buttons name what to do; each button's tooltip says how. A readout beside them shows what it does.

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
6. Set fiber fill. Read its effect beside the buttons.
7. Set a band's high-pass and low-pass without long button rows.
8. Add a second driver, then delete it with its trash icon.
9. Move a driver on the baffle by dragging it in the Front view. Read its position in the fields.

## Decisions

1. Arched top: keep it, for speakers with only Box chambers. A speaker with a horn chamber does not show it.
2. Chamber checks: chips, as now. Their long text goes into each chip's tooltip, so no text blocks stay on the page.
3. Mock comments (Oct 18): units off the labels, fill hints as tooltips, sub-section boxes, wrapped summaries, Hornresp named, straight horn read-only, taps wording, Start from moves to saved configurations, charts at the app's fixed height.

## Steps

| Step | Work                                                                            | PR   |
| ---- | ------------------------------------------------------------------------------- | ---- |
| 1    | This plan and a working mock; owner tests the mock                              | this |
| 2    | Black interior, drivers button, side view                                       | 1    |
| 3    | Details fold, headings, results layout                                          | 1    |
| 4    | Levels: bracing and back panel per Box chamber; saved designs keep their choice | 2    |
| 5    | Settings layout, fiber fill, filter dropdowns                                   | 2    |
