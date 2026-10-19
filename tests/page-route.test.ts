// Which page an address opens (src/lib/pageRoute): the Notes page has no tab and no hash, and opens only at the path
// /notes.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { isNotesPath, pageAt } from "../src/lib/pageRoute";
import { DEFAULT_PAGE, NOTES_PAGE, PAGE_HASHES, PROJECT_PAGES } from "../src/constants/pages";

test("the nav lists no Notes page: no tab, no hash", () => {
  const tabs: (readonly [string, string])[] = Object.values(PROJECT_PAGES).flat();
  assert.ok(tabs.every(([id, label]) => id !== NOTES_PAGE && label !== "Notes"));
  assert.ok(Object.keys(PAGE_HASHES).every((id) => !/notes/i.test(id)));
  assert.ok(Object.values(PAGE_HASHES).every((hash) => !/notes/i.test(hash)));
});

test("the path check: /notes and /notes/ under any base, nothing else", () => {
  for (const path of ["/notes", "/notes/", "/speaker-design/notes", "/speaker-design/notes/"])
    assert.equal(isNotesPath(path), true, path);
  for (const path of ["/", "/speaker-design/", "/index.html", "/notesy", "/notes/x", "/my-notes/"])
    assert.equal(isNotesPath(path), false, path);
});

test("page at an address: Notes at its path, the hash's page elsewhere, the Speaker page by default", () => {
  assert.equal(pageAt("/speaker-design/notes/", ""), NOTES_PAGE);
  assert.equal(pageAt("/notes", "#"), NOTES_PAGE);
  // a page's own hash wins over the path
  assert.equal(pageAt("/notes/", PAGE_HASHES.space), "space");
  assert.equal(pageAt("/", PAGE_HASHES.space), "space");
  assert.equal(DEFAULT_PAGE, "speaker");
  assert.equal(pageAt("/", ""), DEFAULT_PAGE);
  assert.equal(pageAt("/", "#"), DEFAULT_PAGE);
  assert.equal(pageAt("/", PAGE_HASHES.speaker), "speaker");
  // the old Notes hashes open nothing special
  assert.equal(pageAt("/", "#notes"), DEFAULT_PAGE);
  assert.equal(pageAt("/", "#space-notes"), DEFAULT_PAGE);
});

test("the old pages' links open the Speaker page: no redirect, no page of their own", () => {
  for (const hash of ["#coverage", "#cutlist", "#fills", "#hifi", "#hifi-cutlist", "#unknown"])
    assert.equal(pageAt("/", hash), DEFAULT_PAGE, hash);
  for (const id of ["planner", "coverage", "cutlist", "fills", "hifi", "hifiCutlist"])
    assert.ok(!Object.hasOwn(PAGE_HASHES, id), id);
});
