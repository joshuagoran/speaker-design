# Import and export: spec

Owner request, Oct 2026. This spec adds files to SpeakNow: export a design to a file, and import a file as a design.
It builds on the Speaker / Stack / Space layers in [speaker-designer-plan.md](speaker-designer-plan.md). Nothing here
is built yet.

## Goals

- Back up designs outside the database.
- Share a design with another person, signed in or not.
- Move a design between accounts or browsers.
- Keep one clear file format for the three layers.

## Not in scope

- Share links (a design packed into a URL). [share-plan.md](share-plan.md) adds them, with the same format.
- Old saves from the PA and Hi-fi pages. Owner policy: clean code comes first. An old PA or Hi-fi save opens
  through the L3f read adapter, as speakers and a stack, and the user exports it from the Speaker or Stack page.
- Cutlist, chart and 3D exports. See [Later](#later).

## File format

- One JSON file per export, named `<name>.speaknow.json`. UTF-8, no comments.
- The top level is an envelope:

  ```json
  {
    "format": "speaknow",
    "version": 1,
    "kind": "speaker",
    "exportedAt": "2026-10-12T18:00:00Z",
    "speakers": [],
    "stacks": [],
    "spaces": []
  }
  ```

- `kind` is `speaker`, `stack`, `space` or `bundle`. It names the item the user exported. A bundle holds any mix.
- The three lists hold `SpeakerSpec`, `StackSpec` and `SpaceSpec` values, exactly as the app stores them. No
  second schema.
- A file is complete: a stack lists the speakers it uses, and a space lists the stacks and speakers it places.
- Catalog parts go by id only. The file does not copy catalog data.
- Ids for the format, the kinds and the version are constants in `src/constants/`, defined once.

## Versions

- `version` is a whole number. It changes only when a spec type changes in a way an old reader cannot read.
- Version 1 has no older files, so the first PR reads only version 1. A newer file gets a clear message: "This
  file comes from a newer version of SpeakNow."
- A test pins the current version to the spec types, so a type change without a version change fails the build.
- **During alpha** (now), exported files can break between versions. When the version changes, the app rejects older
  files with a clear message: "This file comes from an older version of SpeakNow and cannot be read." No upgrade steps
  are written.
- **The first public release** sets the version that the path below supports from then on. Its fixtures start at that
  version.

### Backward compatibility path (draft, from the first public release)

Exported files live outside the app, so they need a way forward. This path starts at the first public release; it does
not apply during alpha. It applies to files only. Saves in the database still follow the owner policy: clean code
first, no migration code for them.

- **One step per version.** When the version goes from N to N + 1, the same PR adds one pure function,
  `upgradeVN(file): FileVN1`. It changes only what the new version changed: rename a field, set a new field to its
  default, split or join a value.
- **A chain.** `parseFile` reads the version, then runs the steps in order up to the current version. Then it runs
  the normal checks. The rest of the app sees only current specs.
- **One place.** All steps live in `src/lib/io/upgrade/`, one file per step, with the old file shape typed there.
  No other code knows about old versions.
- **Fixtures.** Each version keeps a few sample files in `tests/io-fixtures/vN/`: a speaker, a stack, a space and a
  bundle, exported from the app at that version. A test upgrades every fixture to the current version and checks the
  result against the current types and the model (no gaps beyond the ones the file had).
- **Defaults are visible.** When a step fills a new field with a default, the import preview says so ("Bracing
  target set to 280 Hz").
- **Loss is visible.** When a step must drop or approximate a value, the preview lists it. The import never fails
  silently.
- **Support window.** The app reads every version back to the first public release's version. If a step becomes too costly, the owner decides to drop
  the oldest versions; the message then names the oldest version the app reads.
- **Export is always current.** The app never writes an old version.

## Export

- **Where:** an "Export" action on each library row (Speaker, Stack and Space), and "Export this design" on each
  page for the open design.
- **Bundle:** "Export all" in each library writes one bundle with every saved item of that kind and what they use.
- **Signed out:** export works for the open design. The library actions need a sign-in, as today.
- **How:** the browser downloads the file. In the claude.ai artifact build, use the host's file-save capability
  if the browser download is blocked.

## Import

- **Where:** an "Import" action in each library, plus drag and drop of a file onto the page.
- **Steps:**
  1. The user picks a file.
  2. The app checks it (see [Checks](#checks)).
  3. A preview lists what the file holds: names, kinds and counts.
  4. The user confirms.
  5. The app saves the items to the library (signed in), or opens the design without saving (signed out).
- **Same id already in the library:** the default is "Keep both". The import gets new ids and a name such as
  "Name (imported)". A "Replace" choice overwrites, after a confirmation that names the item.
- **Missing catalog parts:** a part id the catalog no longer has stays in the spec. The model shows it as a named
  gap, as it does today for a missing driver. The preview lists these parts.
- Stacks and spaces point to the new ids of the speakers and stacks imported with them.

## Checks

The file is untrusted data.

- Size limit: 1 MB.
- Parse as JSON only. Never evaluate it.
- Check the envelope (format, version, kind, lists) and each item with type guards at the boundary. A file that
  fails gets one clear message, and nothing is saved.
- Limit names to a sensible length and plain text.
- Clamp numbers that the model needs inside their ranges, as the settings fields do. The existing named gaps cover
  values the model cannot use.

## Code

- `src/lib/io/`: `exportFile(items)`, `parseFile(text)`, `remapIds(items, taken)`. Pure functions with tests.
- One shared UI component in `src/components/ui` for the Import and Export actions and the preview, used by all
  three libraries.
- The library store gets `importItems(items, mode)`. It reuses the existing save path.
- No new Firestore collections or rules.

## Tests

- Round trip: export, then import, gives the same specs (new ids aside).
- Each template and each golden design exports and imports cleanly.
- A stack or space keeps its links to its speakers and stacks after the ids change.
- Bad files: not JSON, wrong format, other version, missing fields, too large. Each gives its message and saves
  nothing.
- Missing catalog part: the import works, and the model shows the gap.

## Phase

- One PR into `designer`, after L4b (Space), so all three kinds exist.
- It can also come after the L3f switch-over. It does not depend on it.

## Later

- Cutlist export: CSV and a printable sheet layout.
- Chart export: PNG, and CSV of the curves.
- 3D export: STL or glTF of the cabinet, for a visual or a print.
- Share links: see [share-plan.md](share-plan.md).

## Owner decisions (Oct 2026)

- A file holds catalog ids only. It does not copy catalog parts.
- The PA and Hi-fi pages get no Export.
- Exported files get a backward compatibility path (above). Database saves do not.
- SpeakNow is in alpha. The backward compatibility path applies only from the first public release. During alpha,
  exported files can break between versions: a version change rejects older files with a clear message, and no
  upgrade steps are written. The first public release sets the version that the path supports from then on, and its
  fixtures start there.

## Open questions

1. Is 1 MB enough? A test should measure a large space with many stacks before this limit is final.
