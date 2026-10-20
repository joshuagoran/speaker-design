// Which page an address opens (src/lib/pageRoute).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { pageAt } from "../src/lib/pageRoute";
import { DEFAULT_PAGE, PAGE_HASHES } from "../src/constants/pages";

test("page at an address: the hash's page, the Speaker page by default", () => {
  assert.equal(pageAt(PAGE_HASHES.space), "space");
  assert.equal(DEFAULT_PAGE, "speaker");
  assert.equal(pageAt(""), DEFAULT_PAGE);
  assert.equal(pageAt("#"), DEFAULT_PAGE);
  assert.equal(pageAt(PAGE_HASHES.speaker), "speaker");
});

test("the old pages' links open the Speaker page: no redirect, no page of their own", () => {
  for (const hash of [
    "#coverage",
    "#cutlist",
    "#fills",
    "#hifi",
    "#hifi-cutlist",
    "#notes",
    "#space-notes",
    "#unknown",
  ])
    assert.equal(pageAt(hash), DEFAULT_PAGE, hash);
  for (const id of ["planner", "coverage", "cutlist", "fills", "hifi", "hifiCutlist", "notes"])
    assert.ok(!Object.hasOwn(PAGE_HASHES, id), id);
});
