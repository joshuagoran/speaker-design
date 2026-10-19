# Switch-over: remove the old pages

Issue: #178 (Switch-over).

## Goal

- Remove the PA, Hi-fi, Coverage, and Fills pages.
- The app opens on the Stack page.
- The Speaker, Stack, Space, and Notes pages work as they do now.
- Designs saved on the PA and Hi-fi pages are no longer read. The owner copied the stacks to keep.

## What stays

The old pages' model code is shared. The new pages import it from about 40 files. It stays.

| Code                                                                                                                                                                                | Why it stays                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/pa`: calc, chips, coverage, coverageLayout, bracing, hardware, hornMount, hornColor, musicBalance, paDesign, tubes, tower, subVentPlan, dispersion, cutlist, roomAcoustics | The Speaker model, the Space coverage map, the 3D view, and the cutlist use it. |
| `src/lib/hifi`: hifi, boxLayout, cutlist, hifiDriverLists                                                                                                                           | The Speaker model and the 3D view use it.                                       |
| `src/lib/defaults.ts` (`DEFAULT_PA`, `DEFAULT_HIFI`)                                                                                                                                | Templates, Stack presets, and the Notes page use it.                            |
| `src/components/saved-configs`                                                                                                                                                      | The Speaker, Stack, and Space pages save with it.                               |
| `useDesignOptimizer`, `useOptimizerLocks`, `OptimizerPanel`                                                                                                                         | The Speaker and Stack optimizers use them.                                      |

## What goes

| Page                                         | Folders and files                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA                                           | `src/pages/pa-stack`, `src/pages/cutlist/PaCutlistPage.tsx`                                                                                                                                                                                                                                       |
| Hi-fi                                        | `src/pages/hifi`, `src/pages/cutlist/HifiCutlistPage.tsx`                                                                                                                                                                                                                                         |
| Coverage                                     | `src/pages/coverage` (after one helper moves)                                                                                                                                                                                                                                                     |
| Fills                                        | `src/pages/fills`                                                                                                                                                                                                                                                                                 |
| Old-only model code                          | The PA and Hi-fi optimizers (`optimize*`, `optimizeExact*`, `compareDrivers`, `exactSub`), `lib/hifi/hifiDesign`, `nearField`, `diffraction`, and `lib/pa/runCoverage`. Check each with `vp check` for dead exports before it goes.                                                               |
| Scripts                                      | `optimizer-dump*`, `optimizer-snapshot`, `tests/optimizer-dump.json`                                                                                                                                                                                                                              |
| Starts that copy the open PA or Hi-fi design | The four "New from" entries on the Speaker page ("The PA design's sub", "The PA design's mid/high box", "The PA design's tower", and "The Hi-fi design"), `SPEAKER_CURRENT_START`, `paPlannerDesign.ts`, and the Stack page's entry for the open PA design. The other templates and presets stay. |
| Old saves                                    | `src/pages/stack/useOldSaves.ts`, `oldSaves.ts`, `OLD_SAVE_COLLECTIONS`, and `tests/old-saves.test.ts`. The Stack page no longer lists designs saved on the PA and Hi-fi pages.                                                                                                                   |

## Saved data

| Data                                                  | After the switch-over    |
| ----------------------------------------------------- | ------------------------ |
| Firebase `configs` (PA) and `hifiConfigs` (Hi-fi)     | Not read. Left in place. |
| localStorage `planner.*`, `hifi.*`, `coverage.layout` | Not read. Left in place. |

## Steps

Each step is one PR. Each keeps CI green.

| Step | Work                                                                                                                                                                                                                                                                                    | Proof                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Open on `#stack`, and remove the PA tab. Old links get no redirect. Move `assumptionGroups` out of `src/pages/coverage`. Remove the starts that copy the open PA or Hi-fi design, the Stack page's old saves list, and the `planner` and `hifi` props from the Speaker and Stack pages. | `page-route` test for the default page. The phone check passes. |
| 2    | Delete the Fills, Coverage, and Hi-fi pages, their hooks, the Hi-fi cutlist, their tests, and their phone check sections.                                                                                                                                                               | `vp check`, the full suite, and the phone check.                |
| 3    | Delete the PA page, its hooks, the PA cutlist, and the PA-only tests.                                                                                                                                                                                                                   | Same as step 2.                                                 |
| 4    | Remove the old-only model code and scripts. Update CLAUDE.md, README.md, and the docs. Mark the old plan docs as history.                                                                                                                                                               | `vp check` with no unused exports.                              |

## Owner tasks (acceptance)

Run each in the browser after step 1, and again after step 3.

1. Open the app with no link. It opens on the Stack page.
2. On the Stack page, open a saved stack.
3. On the Speaker page, start from each template. Each one opens and draws.
4. On the Space page, place a stack. The coverage map draws.
5. Open the Speaker and Stack cutlists.
6. Open `/notes`. It shows the parts and defaults.
7. At phone width, do tasks 1, 3, and 4.

## Decisions

| Question                                     | Decision                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old saves                                    | Dropped.                                                                                                                                                                                                                                                                                          |
| Starts that copy the open PA or Hi-fi design | The four "New from" entries on the Speaker page ("The PA design's sub", "The PA design's mid/high box", "The PA design's tower", and "The Hi-fi design"), `SPEAKER_CURRENT_START`, `paPlannerDesign.ts`, and the Stack page's entry for the open PA design. The other templates and presets stay. |
| Old saves                                    | `src/pages/stack/useOldSaves.ts`, `oldSaves.ts`, `OLD_SAVE_COLLECTIONS`, and `tests/old-saves.test.ts`. The Stack page no longer lists designs saved on the PA and Hi-fi pages.                                                                                                                   |
| Notes page                                   | No change. It reads the defaults.                                                                                                                                                                                                                                                                 |
