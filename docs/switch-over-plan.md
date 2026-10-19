# Switch-over: remove the old pages

Issue: #178 (Switch-over).

## Goal

- Remove the PA, Hi-fi, Coverage, and Fills pages.
- The app opens on the Stack page.
- The Speaker, Stack, Space, and Notes pages work as they do now.
- Saved PA and Hi-fi designs stay readable on the Stack page.

## What stays

The old pages' model code is shared. The new pages import it from about 40 files. It stays.

| Code                                                                                                                                                                                | Why it stays                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/pa`: calc, chips, coverage, coverageLayout, bracing, hardware, hornMount, hornColor, musicBalance, paDesign, tubes, tower, subVentPlan, dispersion, cutlist, roomAcoustics | The Speaker model, the Space coverage map, the 3D view, and the cutlist use it. |
| `src/lib/hifi`: hifi, boxLayout, cutlist, hifiDriverLists                                                                                                                           | The Speaker model and the 3D view use it.                                       |
| `src/lib/defaults.ts` (`DEFAULT_PA`, `DEFAULT_HIFI`)                                                                                                                                | Templates, Stack presets, the Notes page, and old saves use it.                 |
| `src/components/saved-configs`                                                                                                                                                      | The Speaker, Stack, and Space pages save with it.                               |
| `src/pages/stack/useOldSaves.ts`, `oldSaves.ts`                                                                                                                                     | The Stack page lists old PA and Hi-fi saves (read-only).                        |
| `useDesignOptimizer`, `useOptimizerLocks`, `OptimizerPanel`                                                                                                                         | The Speaker and Stack optimizers use them.                                      |

## What goes

| Page                         | Folders and files                                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA                           | `src/pages/pa-stack`, `src/pages/cutlist/PaCutlistPage.tsx`                                                                                                                                                                         |
| Hi-fi                        | `src/pages/hifi`, `src/pages/cutlist/HifiCutlistPage.tsx`                                                                                                                                                                           |
| Coverage                     | `src/pages/coverage` (after one helper moves)                                                                                                                                                                                       |
| Fills                        | `src/pages/fills`                                                                                                                                                                                                                   |
| Old-only model code          | The PA and Hi-fi optimizers (`optimize*`, `optimizeExact*`, `compareDrivers`, `exactSub`), `lib/hifi/hifiDesign`, `nearField`, `diffraction`, and `lib/pa/runCoverage`. Check each with `vp check` for dead exports before it goes. |
| Scripts                      | `optimizer-dump*`, `optimizer-snapshot`, `tests/optimizer-dump.json`                                                                                                                                                                |
| "Design you have now" starts | The Speaker page's PA and Hi-fi starts (`SPEAKER_CURRENT_START`), `paPlannerDesign.ts`, and the Stack page's current PA start. Templates and presets stay.                                                                          |

## Routes

| Old link          | Opens              |
| ----------------- | ------------------ |
| empty, `#`        | `#stack`           |
| `#hifi`, `#fills` | `#speaker`         |
| `#coverage`       | `#space`           |
| `#cutlist`        | `#stack-cutlist`   |
| `#hifi-cutlist`   | `#speaker-cutlist` |
| `/notes`          | Notes (no change)  |

## Saved data

| Data                                                  | After the switch-over                                 |
| ----------------------------------------------------- | ----------------------------------------------------- |
| Firebase `configs` (PA) and `hifiConfigs` (Hi-fi)     | Kept. The Stack page reads them. Nothing writes them. |
| localStorage `planner.*`, `hifi.*`, `coverage.layout` | Not read. Left in place.                              |

## Steps

Each step is one PR. Each keeps CI green.

| Step | Work                                                                                                                                                                                                                                        | Proof                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Routes: open on `#stack`, add the redirects above, and remove the PA tab. Move `assumptionGroups` out of `src/pages/coverage`. Remove the "design you have now" starts and the `planner` and `hifi` props from the Speaker and Stack pages. | `page-route` test for every old link. The phone check passes. |
| 2    | Delete the Fills, Coverage, and Hi-fi pages, their hooks, the Hi-fi cutlist, their tests, and their phone check sections.                                                                                                                   | `vp check`, the full suite, and the phone check.              |
| 3    | Delete the PA page, its hooks, the PA cutlist, and the PA-only tests. Keep the old-save adapter and its test.                                                                                                                               | Same as step 2. Old saves still list on the Stack page.       |
| 4    | Remove the old-only model code and scripts. Update CLAUDE.md, README.md, and the docs. Mark the old plan docs as history.                                                                                                                   | `vp check` with no unused exports.                            |

## Owner tasks (acceptance)

Run each in the browser after step 1, and again after step 3.

1. Open the app with no link. It opens on the Stack page.
2. Open an old `#hifi` link and an old `#coverage` link. Each opens the page in the Routes table.
3. On the Stack page, open an old saved PA design and an old saved Hi-fi design.
4. On the Speaker page, start from each template. Each one opens and draws.
5. On the Space page, place a stack. The coverage map draws.
6. Open the Speaker and Stack cutlists.
7. Open `/notes`. It shows the parts and defaults.
8. At phone width, do tasks 1, 4, and 5.

## Decisions

| Question                     | Proposal                                    |
| ---------------------------- | ------------------------------------------- |
| Old link redirects           | The Routes table above.                     |
| Old saves                    | Read-only on the Stack page. No write path. |
| "Design you have now" starts | Removed. Templates and presets stay.        |
| Notes page                   | No change. It reads the defaults.           |
