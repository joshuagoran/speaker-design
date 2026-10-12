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

- Share links (a design packed into a URL). A later step can reuse the same format.
- Old saves from the PA and Hi-fi pages. Owner policy: clean code comes first. A user opens an old save on its page
  and exports it from the Designer, Stack or Space page.
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
- The app reads only the current version. It rejects other versions with a clear message: "This file comes from a
  different version of SpeakNow." No migration code, per the owner policy.
- A test pins the current version to the spec types, so a type change without a version change fails the build.

## Export

- **Where:** an "Export" action on each library row (Designer, Stack and Space), and "Export this design" on each
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
- Share links with the same format, packed and compressed into the URL.

## Open questions

1. Should a file also copy the catalog parts it uses, so a shared design opens in an older or newer catalog? This
   spec says no: ids only.
2. Is 1 MB enough? A test should measure a large space with many stacks before this limit is final.
3. Should the PA and Hi-fi pages also get Export, before L3f removes or changes them? This spec says no.
