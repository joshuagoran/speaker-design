# Switch-over: remove the old pages

Issue: #178 (Switch-over).

## Goal

- Remove the PA, Hi-fi, Coverage, and Fills pages, in two PRs.
- The app opens on the Speaker page.
- The Speaker, Stack, Space, and Notes pages work as they do now.
- Move the old pages' model code into the new structure. Delete the code nothing uses.
- Designs saved on the PA and Hi-fi pages are no longer read. The owner copied the stacks to keep.

## What goes

| Part                                         | Folders and files                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA                                           | `src/pages/pa-stack`, `src/pages/cutlist/PaCutlistPage.tsx`                                                                                                                                                                                                                                       |
| Hi-fi                                        | `src/pages/hifi`, `src/pages/cutlist/HifiCutlistPage.tsx`                                                                                                                                                                                                                                         |
| Coverage                                     | `src/pages/coverage` (after `assumptionGroups` moves)                                                                                                                                                                                                                                             |
| Fills                                        | `src/pages/fills`                                                                                                                                                                                                                                                                                 |
| Starts that copy the open PA or Hi-fi design | The four "New from" entries on the Speaker page ("The PA design's sub", "The PA design's mid/high box", "The PA design's tower", and "The Hi-fi design"), `SPEAKER_CURRENT_START`, `paPlannerDesign.ts`, and the Stack page's entry for the open PA design. The other templates and presets stay. |
| Old saves                                    | `src/pages/stack/useOldSaves.ts`, `oldSaves.ts`, `OLD_SAVE_COLLECTIONS`, and `tests/old-saves.test.ts`                                                                                                                                                                                            |
| Old-only model code                          | The PA and Hi-fi optimizers (`optimize*`, `optimizeExact*`, `compareDrivers`, `exactSub`, `nearMiss`), `lib/hifi/hifiDesign`, `nearField`, `diffraction`, `lib/pa/runCoverage`, and anything else the dead code check finds                                                                       |
| Scripts                                      | `optimizer-dump*`, `optimizer-snapshot`, `tests/optimizer-dump.json`                                                                                                                                                                                                                              |

`nearField` and `diffraction` stay in git history for #31.

## Where the model code moves

`src/lib/pa` and `src/lib/hifi` go away. Their shared code moves by what it does, not by the old page. PR 2 settles the final file names: `pa/calc` is `acoustics/boxModels`, and `hifi/hifi` splits into `acoustics/wooferBox`, `acoustics/directivity`, and `speaker/twoWay`.

| Folder                | What goes there                                                                        | From                                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/acoustics`   | Box models, dispersion, room acoustics, and the coverage engine                        | `pa/calc`, `pa/dispersion`, `pa/roomAcoustics`, `pa/coverage`, `pa/coverageLayout`, and the box parts of `hifi/hifi`                                                                                                                                                                            |
| `src/lib/build` (new) | Cutlists, bracing, hardware, horn mounts, tubes, vent plans, and box layout            | `pa/cutlist`, `pa/cutlist.worker`, `pa/runCutlist`, `pa/bracing`, `pa/hardware`, `pa/hornMount`, `pa/tubes`, `pa/subVentPlan`, `hifi/cutlist`, `hifi/boxLayout`, and the build files at the top of `src/lib` (`bracing`, `boxFit`, `panel`, `cutlistCsv`, `tubeFold`, `strength`, `plateModes`) |
| `src/lib/speaker`     | Checks, music balance, amp power, horn colors, the tower, and the PA and Hi-fi presets | `pa/chips`, `pa/musicBalance`, `pa/ampPower`, `pa/hornColor`, `pa/tower`, `pa/paDesign`, `hifi/hifiDriverLists`, and the rest of `hifi/hifi` that the Speaker model uses                                                                                                                        |

## Dead code check

- A script lists every export that no file imports. It ignores tests, which can only keep code alive if a page also uses it.
- Delete each export it lists, then run it again until it lists none.
- Delete tests that cover only deleted code.
- Delete constants, types, and strings that only deleted code used.
- The golden snapshot (`tests/golden-configs.ts`) counts as a user, so the goldens do not change.

## Saved data

| Data                                                  | After the switch-over    |
| ----------------------------------------------------- | ------------------------ |
| Firebase `configs` (PA) and `hifiConfigs` (Hi-fi)     | Not read. Left in place. |
| localStorage `planner.*`, `hifi.*`, `coverage.layout` | Not read. Left in place. |

## Steps

Two PRs. Each keeps CI green.

| PR  | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Proof                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Remove the old pages (all the user sees changes here). Open on the Speaker page, and remove the old pages' tabs. Old links get no redirect. Move `assumptionGroups` out of `src/pages/coverage`. Remove the starts that copy the open PA or Hi-fi design, the Stack page's old saves list, and the `planner` and `hifi` props. Delete the Fills, Coverage, Hi-fi, and PA pages, their hooks, their cutlists, their tests, and their phone check sections. | `page-route` test for the default page. `vp check`, the full suite, and the phone check pass. The owner tasks pass.                                         |
| 2   | Clean up (no change the user sees). Move the model code (see "Where the model code moves"). Run the dead code check and delete what it finds. Remove the old scripts. Update CLAUDE.md, README.md, and the docs. Mark the old plan docs as history.                                                                                                                                                                                                       | The dead code script lists nothing. `vp check` and the full suite pass. The speaker optimizer snapshot and the goldens do not change. The owner tasks pass. |

## Status

| PR  | Status                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Done (#212).                                                                                                                                               |
| 2   | Done.                                                                                                                                                      |
| 2   | CI: the unit tests, the phone check, and the 3D checks run as parallel jobs. The 3D job runs on a PR only when the 3D view or the horn mount code changes. |
| 2   | Horn mount tests: each horn's scene checks run with its smallest and largest driver only.                                                                  |

## Owner tasks (acceptance)

Run each in the browser after each PR.

1. Open the app with no link. It opens on the Speaker page.
2. On the Speaker page, start from each template. Each one opens and draws.
3. On the Stack page, open a saved stack.
4. On the Space page, place a stack. The coverage map draws.
5. Open the Speaker and Stack cutlists.
6. Open `/notes`. It shows the parts and defaults.
7. At phone width, do tasks 1, 2, and 4.

## Decisions

| Question                                     | Decision                                       |
| -------------------------------------------- | ---------------------------------------------- |
| Start page                                   | The Speaker page.                              |
| Old links                                    | No redirect.                                   |
| Old saves                                    | Dropped.                                       |
| Starts that copy the open PA or Hi-fi design | Removed. The other templates and presets stay. |
| Old model code                               | Moved by what it does. Dead code deleted.      |
| Notes page                                   | No change. It reads the defaults.              |
