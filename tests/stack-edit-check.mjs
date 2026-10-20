// A Stack's speaker edited on the Speaker page, in the browser, at a phone's and a desktop's width. Not part of
// `vp test`. It uses the stand-in database of tests/save-row-check.mjs (tests/stand-in-db.mjs).
//   node tests/stack-edit-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE (path to playwright's index.mjs, default "playwright"), PW_CHROMIUM (browser binary).
// Fails on: Edit, Save & return to Stack, or Cancel not doing what the notice says; the Speaker page's own design not
// back after each; a reload that loses the edit; page errors; and horizontal page scroll.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow.ts";
import { PAGE_DRAFT_KEYS, DRAFT_WRITE_MS } from "../src/constants/pageDrafts.ts";
import { SPEAKER_START_NAMES } from "../src/constants/speakerStarts.ts";
import { STACK_START_NAMES } from "../src/constants/stackPresets.ts";
import { STACK_EDIT_TEXT } from "../src/constants/stackSpeakerEdit.ts";
import { DB_KEY, installDb } from "./stand-in-db.mjs";

const { chromium } = await import(process.env.PW_MODULE || "playwright");
const url = pathToFileURL(path.resolve(process.argv[2] || "dist/stack-planner.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader"],
});

/** The driver's count field on the Speaker page (its label in ChamberSettings). */
const DRIVER_COUNT_LABEL = "Count";
/** The names the check gives its designs. */
const LIBRARY_NAME = "Library box";
const OWN_NAME = "Own speaker";

const WIDTHS = [
  { width: 390, height: 844, isMobile: true, hasTouch: true },
  { width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const failures = [];

for (const size of WIDTHS) {
  const label = `${size.width}`;
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.isMobile,
    hasTouch: size.hasTouch,
  });
  await ctx.addInitScript(installDb, DB_KEY);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const fail = (m) => failures.push(`${label}: ${m}`);
  const check = (ok, m) => ok || fail(m);
  /** every saved speaker: [{ id, name, speaker, ... }] */
  const docs = () =>
    p.evaluate((key) => {
      const all = JSON.parse(localStorage.getItem(key) || "{}");
      return Object.entries(all.speakers || {}).map(([id, data]) => ({ id, ...data }));
    }, DB_KEY);
  const docNamed = async (name) => (await docs()).find((d) => d.name === name);
  const waitCount = (n) =>
    p
      .waitForFunction(
        ({ key, n }) =>
          Object.keys(JSON.parse(localStorage.getItem(key) || "{}").speakers || {}).length === n,
        { key: DB_KEY, n },
        { timeout: 5000 },
      )
      .catch(() => fail(`expected ${n} saved speakers`));
  /** a page's draft, once written */
  const draft = async (key) => {
    await p.waitForTimeout(DRAFT_WRITE_MS + 400);
    return p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), key);
  };
  const row = p.getByRole("group", { name: SAVE_ROW_TEXT.row });
  const nameBox = row.getByRole("textbox").first();
  const button = (name) => p.getByRole("button", { name, exact: true });
  const banner = (speaker, stack) => p.getByText(STACK_EDIT_TEXT.editing(speaker, stack));
  // on a phone the settings are a sheet, one section per tab (a tap on the open tab closes it); from md up the column
  // shows every section, in folds
  const tabs = p.locator("aside [role=tab]:visible");
  const closeSheet = async () => {
    const open = p.locator("aside [role=tab][aria-selected=true]:visible");
    if (await open.count()) await open.first().click();
  };
  const reveal = async (target) => {
    const shown = () => target.first().isVisible();
    const closed = p.locator("aside button[aria-expanded=false]:visible");
    const n = await tabs.count();
    for (let i = 0; i < Math.max(n, 1) && !(await shown()); i++) {
      if (n && (await tabs.nth(i).getAttribute("aria-selected")) !== "true")
        await tabs.nth(i).click();
      for (let j = 0; j < 10 && !(await shown()) && (await closed.count()); j++)
        await closed.first().click();
    }
  };
  const goTo = async (hash) => {
    await p.evaluate((h) => (location.hash = h), hash);
    await p.waitForTimeout(400);
  };
  const noScroll = async (when) => {
    const m = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: innerWidth,
    }));
    check(m.sw <= m.iw, `page scrolls sideways ${when} (${m.sw} > ${m.iw} px)`);
  };
  /** the speaker page's driver count, one more */
  const addDriver = async () => {
    const count = p.getByLabel(DRIVER_COUNT_LABEL, { exact: true }).first();
    await reveal(count);
    const n = Number(await count.inputValue());
    await count.fill(String(n + 1));
    await count.press("Tab");
    await closeSheet();
  };
  /** opens member `k`'s speaker (named `name` on its card) from the Stack page */
  const edit = async (k, name) => {
    const target = p.getByRole("button", { name: STACK_EDIT_TEXT.editLabel(`${k + 1}. ${name}`) });
    await reveal(target);
    await target.click();
    await p.waitForTimeout(400);
    check(
      await p.evaluate(() => location.hash === "#speaker"),
      "Edit did not open the Speaker page",
    );
  };
  /** the Speaker page shows its own design: its save row, under the own design's name */
  const ownBack = async (when) => {
    await goTo("#speaker");
    await closeSheet();
    check(await row.isVisible(), `the save row is not back ${when}`);
    check(
      (await nameBox.inputValue()) === OWN_NAME,
      `the Speaker page's own design is not back ${when}`,
    );
    await goTo("#stack");
    await closeSheet();
  };
  try {
    // a saved speaker for the library, then the Speaker page's own design (not saved)
    await p.goto(`${url}#speaker`);
    await row.waitFor();
    await p
      .getByLabel(SAVE_ROW_TEXT.newFrom)
      .selectOption({ label: SPEAKER_START_NAMES.hifiTwoWay });
    await nameBox.fill(LIBRARY_NAME);
    await button(SAVE_ROW_TEXT.save).click();
    await waitCount(1);
    const library = await docNamed(LIBRARY_NAME);
    await p.getByLabel(SAVE_ROW_TEXT.newFrom).selectOption({ label: SPEAKER_START_NAMES.paSubBox });
    await nameBox.fill(OWN_NAME);
    const own = await draft(PAGE_DRAFT_KEYS.speaker);
    // a Stack: the PA preset, and the saved speaker on top
    await goTo("#stack");
    await p.getByLabel(SAVE_ROW_TEXT.newFrom).selectOption({ label: STACK_START_NAMES.paStack });
    const stackName = await nameBox.inputValue();
    const picker = p.locator("aside select").filter({
      has: p.locator("option", { hasText: LIBRARY_NAME }),
    });
    await reveal(picker);
    await picker.selectOption({ label: LIBRARY_NAME });
    await picker.locator("xpath=following::button[1]").click();
    const before = await draft(PAGE_DRAFT_KEYS.stack);
    const top = before.stack.members.length - 1;
    check(before.stack.members[top].speakerId === library?.id, "the saved speaker is not on top");

    // Edit the saved member: the notice in place of the save row; a reload keeps the edit
    await edit(top, LIBRARY_NAME);
    await closeSheet();
    check(await banner(LIBRARY_NAME, stackName).isVisible(), "no notice for the edit");
    check(!(await row.isVisible()), "the save row shows during the edit");
    await noScroll("during the edit");
    await addDriver();
    await p.waitForTimeout(DRAFT_WRITE_MS + 400);
    await p.reload();
    await banner(LIBRARY_NAME, stackName).waitFor({ timeout: 10000 });
    check(
      sameJson((await draft(PAGE_DRAFT_KEYS.speaker)).speaker, own.speaker),
      "the edit wrote over the Speaker page's own design",
    );
    // Save & return: the same save takes the edit, and the Stack's copy is the save
    await button(STACK_EDIT_TEXT.saveAndReturn).dblclick();
    await p.waitForTimeout(800);
    check(await p.evaluate(() => location.hash === "#stack"), "Save & return did not go back");
    await waitCount(1);
    const updated = await docNamed(LIBRARY_NAME);
    check(updated?.id === library?.id, "Save & return made a new save, not an update");
    check(!sameJson(updated?.speaker, library?.speaker), "the save did not take the edit");
    const afterSaved = await draft(PAGE_DRAFT_KEYS.stack);
    const copy = afterSaved.speakers.find((s) => s.id === library?.id);
    check(
      copy && sameJson(copy.cabinet, updated?.speaker.cabinet),
      "the Stack's copy is not the save",
    );
    check(afterSaved.stack.members[top].speakerId === library?.id, "the member lost its speaker");
    await ownBack("after Save & return");

    // Edit a preset member (no save has its speaker): a new save, and the Stack uses it
    const presetId = afterSaved.stack.members[0].speakerId;
    const presetName = afterSaved.speakers.find((s) => s.id === presetId).name;
    await edit(0, presetName);
    await closeSheet();
    check(await banner(presetName, stackName).isVisible(), "no notice for the preset's edit");
    await button(STACK_EDIT_TEXT.saveAndReturn).click();
    await waitCount(2);
    const made = await docNamed(presetName);
    check(Boolean(made), "the preset's speaker made no save");
    const afterPreset = await draft(PAGE_DRAFT_KEYS.stack);
    check(
      afterPreset.stack.members.every((m) => m.speakerId !== presetId),
      "a member still names the preset's speaker",
    );
    check(
      afterPreset.stack.members[0].speakerId === made?.id,
      "the member does not use the new save",
    );
    await ownBack("after the preset's save");

    // Cancel: no change to the Stack or the saves
    await edit(0, presetName);
    await addDriver();
    await closeSheet();
    await button(STACK_EDIT_TEXT.cancel).click();
    await p.waitForTimeout(400);
    check(await p.evaluate(() => location.hash === "#stack"), "Cancel did not go back");
    check(sameJson(await draft(PAGE_DRAFT_KEYS.stack), afterPreset), "Cancel changed the Stack");
    check(
      sameJson((await docNamed(presetName))?.speaker, made?.speaker),
      "Cancel changed the save",
    );
    await ownBack("after Cancel");
    await noScroll("at the end");
  } catch (e) {
    fail(`stopped: ${e.message.split("\n")[0]}`);
  }
  for (const e of errs) fail(`page error: ${e}`);
  await ctx.close();
}

/** A value as JSON with its keys sorted, so two documents compare by content, not by key order. */
function sorted(v) {
  return Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
}
function sameJson(a, b) {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

await browser.close();
if (failures.length) {
  console.error(`stack edit check: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log("stack edit check: ok (390 and 1440 px)");
