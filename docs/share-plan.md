# Share links and files: plan

Owner request, Oct 2026. Share a speaker, a stack, or a space with another person. Two ways:

- **A link.** Send it in a message. It opens the design on the right page. The main case is a space: a user sends
  their real room and setup to another user, and that user opens it to find the problem.
- **A file.** Export to a `.speaknow.json` file, and import it. See [import-export-spec.md](import-export-spec.md).

Both use one format. A link is the same envelope as a file, compressed and put in the URL. Nothing here is built yet.

## Goals

- Any user sends a link to any other user. The owner is a user like any other: no owner-only features.
- The recipient opens the link and sees the same room, boxes, aims, and listener.
- The recipient changes the space and sends a link back. The sender opens the fixed version.
- A link works signed out, on a phone, with no server.
- Opening a link never loses the recipient's own work.
- Files back up designs and move them between accounts or browsers (the existing spec).

## Not in scope

- Live shared editing (two people on one design at once).
- Links that update when the sender changes the design. A link is a snapshot.
- Cutlist, chart, and 3D exports (see [import-export-spec.md](import-export-spec.md#later)).
- Stored short links (a link with only an id, the design kept in Firestore). Reconsider only if real links get cut
  short in the apps users send them with.
- Links in the claude.ai artifact build. Links target the GitHub Pages site. The artifact build keeps files only.

## User tasks (acceptance tests)

Run each in the browser before every hand-over.

1. Build a space with two stacks and a fill. Tap Share. Paste the link in a message. Open it on a phone, signed out.
   The room, the placements, the listener, and the map are the same.
2. Another user sends a link of their living room. Open it. Move the listener and change a delay. Find the problem.
   Tap Share and send the fixed link back. The sender opens the fixed space.
3. Open a link while the Space page holds an unsaved design. Close the shared design. The unsaved design comes back.
4. Open a shared space, change it, and tap "Save a copy" (signed in). The space and its stacks and speakers are in
   the libraries as new items. The sender's items do not change.
5. Open your own shared link and change it. The only save is "Save a copy". The saved original does not change.
6. Open a link that a chat app cut short. A clear message shows. Nothing changes.
7. Share a speaker and a stack. Each link opens on its own page with the same design.
8. Export a space to a file. Import it in another browser. The space is the same.

## Size (measured, Oct 2026)

| Design (stack preset as a space) | JSON   | Compressed | In the link   |
| -------------------------------- | ------ | ---------- | ------------- |
| PA stack                         | 3.0 KB | 1.0 KB     | ≈ 1,400 chars |
| PA tower                         | 2.7 KB | 1.0 KB     | ≈ 1,350 chars |
| Hi-fi pair                       | 1.9 KB | 0.9 KB     | ≈ 1,150 chars |

- Compression is deflate, then base64url.
- A space with three different stacks and fills should stay under about 5,000 characters. A test measures it.
- Email, Slack, iMessage, and WhatsApp keep links of this length. Some SMS apps cut long links.
- So links need no server, and no stored short links (see [Not in scope](#not-in-scope)).

## Link format

- The design goes in the fragment (after `#`): `https://<site>/#space&s=1.<payload>`.
  - `#space` is the page hash today. `pageAt` reads the part before `&`.
  - `s=1.` is the share version, then the payload.
  - The payload is the file envelope as JSON, compressed with `deflate-raw`, then base64url.
- The fragment never goes to a server. GitHub Pages does not log it, and no server length limit applies.
- The browser's own `CompressionStream` does the compression. No new package.
- The envelope is the one in [import-export-spec.md](import-export-spec.md#file-format): `format`, `version`, `kind`,
  and the three lists. A space lists its stacks and speakers, so the link is complete.
- Catalog parts go by id only, as in files.
- One optional field for links and files: `note`. Plain text, 280 characters at most. The sender says what is wrong
  ("Bass is boomy at the back wall"). The shared view shows it.
- The version rules follow the file spec. During alpha, an older link gets the "older version" message.

## Share (sender)

- One "Share" button on each page (Speaker, Stack, and Space), for the open design. Also a Share action on each
  library row.
- It opens a small panel:
  - An optional note.
  - "Copy link". On a phone, it opens the system share sheet (Web Share API) instead.
  - "Export file", the file download from the file spec.
- After the copy, a line says "Link copied."
- When the link is longer than 8,000 characters, a line says "This link is long. Some apps cut it. Send a file
  instead."
- Share works signed out. It uses the open design, not the library.

## Open a link (recipient)

1. The app reads the fragment at load and on `hashchange`.
2. It checks the payload (see [Checks](#checks)).
3. It opens the design on its page in a **shared view**:
   - A notice at the top: "Shared design: <name>", and the note, if any.
   - The design works as usual: every setting, chart, and the 3D view. The recipient can change it.
   - The only save is "Save a copy" (signed in): new items in the recipient's libraries, with new ids, as the file
     import does. The shared view never overwrites a saved item, the sender's or the recipient's.
   - Signed out, the recipient can change and share the design, but not save it. A line says "Sign in to save a copy."
   - The shared view does not write the page's draft. The recipient's own draft stays in the browser.
   - Other actions: "Share" (send the changed design back) and "Close" (back to the recipient's own draft).
   - "Close" with unsaved changes asks first: "Close without saving a copy?"
4. The app then removes `&s=…` from the address bar (`history.replaceState`). A reload keeps the shared view
   from session storage, so a change is not lost on reload.
5. A bad link shows one message and opens the page's own draft.
6. The link carries no account data. Library ids in it are not used as save targets. A copy always gets new ids.

## Checks

A link is untrusted data, the same as a file.

- Decompress with a limit: stop at 1 MB of JSON. A small link can unpack to a very large text.
- Parse as JSON only. Never evaluate it.
- Run the file spec's checks: the envelope, type guards on each item, name length, and clamped numbers.
- The note is plain text. React shows it as text, never as HTML.
- A missing catalog part is a named gap, as in files.

## Code

- `src/lib/io/`, from the file spec: `exportFile`, `parseFile`, `remapIds`. Plus `encodeLink(envelope)` and
  `decodeLink(fragment)`. Pure, with tests. Links and files share the checks.
- `pageAt` (`src/lib/pageRoute.ts`) reads the page from a hash that carries `&s=`.
- `src/components/ui`: one `SharePanel` and one `SharedNotice`, used on all three pages.
- `usePageDraft` gets a shared mode: it holds a design that it does not write to the draft key.
- The ids (`s`, the share version, the kinds) are constants in `src/constants/`, defined once.
- No new Firestore collections or rules.

## Tests

- Round trip: encode, then decode, gives the same envelope. For each template and stack preset.
- A large space (three stacks, fills, and mirrored pairs) stays under the length the test sets.
- Bad links: cut short, wrong base64, not deflate, too large when unpacked, other version, wrong format. Each gives
  its message and changes nothing.
- The shared view never writes the draft key.
- `pageAt` opens the right page for each kind.
- The phone check covers the Share panel and the shared notice.

## Phases

One feature per PR. Each phase starts after the one before it merges.

### Phase 1: mock

- A Share button on the Space page only. It copies a fragment link. Opening it replaces the open space (no shared
  view yet).
- The owner tests tasks 1 and 2 with a real room and another user.
- Exit: the owner says the flow helps to find real problems, and the link lengths are fine.

### Phase 2: share links

- `src/lib/io` (encode, decode, and the checks), the Share panel, and the shared view on all three pages.
- Tasks 1 to 7 pass.

### Phase 3: files

- Import and export as in [import-export-spec.md](import-export-spec.md). It reuses `src/lib/io` and the Share panel's
  "Export file".
- Task 8 passes.

## Owner decisions (Oct 2026)

1. Users send links to one another. The owner uses links as a user, with no owner-only features.
2. A link or file can carry a note, 280 characters at most.
3. The recipient can change a shared design. Changes save only as a copy in the recipient's account.
4. No stored short links. Reconsider only if real links get cut short.
5. The claude.ai artifact build is out of scope for links for now.

## Open questions

1. Later, a shared space could carry a room measurement: a mic sweep at the listener, from REW or a similar tool.
   The recipient then sees the real room's curve beside the model's. Not in this plan.
