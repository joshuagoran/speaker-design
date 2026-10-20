// The saving row in the browser, on the Speaker, Stack, and Space pages, at a phone's and a desktop's width. Not part
// of `vp test`. The built page cannot save on its own (Firebase is only on GitHub Pages, the artifact database only on
// claude.ai), so this check stands in for the artifact host: it gives the page `window.claude.use("db")`, a database
// held in the browser's storage. Nothing of it ships in the app.
//   node tests/save-row-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE (path to playwright's index.mjs, default "playwright"), PW_CHROMIUM (browser binary).
// Fails on: a save action that does not do what the row says, page errors, and horizontal page scroll.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow.ts";
import { PAGE_DRAFT_KEYS, DRAFT_WRITE_MS } from "../src/constants/pageDrafts.ts";
import { SPEAKER_START_NAMES } from "../src/constants/speakerStarts.ts";
import { STACK_START_NAMES } from "../src/constants/stackPresets.ts";
import { DB_KEY, installDb } from "./stand-in-db.mjs";

const { chromium } = await import(process.env.PW_MODULE || "playwright");
const url = pathToFileURL(path.resolve(process.argv[2] || "dist/stack-planner.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader"],
});

/** Each page: its hash, its draft's key, and two starts "New from…" lists. */
const PAGES = [
  {
    name: "speaker",
    hash: "#speaker",
    draft: PAGE_DRAFT_KEYS.speaker,
    starts: [SPEAKER_START_NAMES.hifiTwoWay, SPEAKER_START_NAMES.paSubBox],
  },
  {
    name: "stack",
    hash: "#stack",
    draft: PAGE_DRAFT_KEYS.stack,
    starts: [STACK_START_NAMES.paStack, STACK_START_NAMES.hifiPair],
  },
  {
    name: "space",
    hash: "#space",
    draft: PAGE_DRAFT_KEYS.space,
    starts: [STACK_START_NAMES.paStack, STACK_START_NAMES.hifiPair],
  },
];
const WIDTHS = [
  { width: 390, height: 844, isMobile: true, hasTouch: true },
  { width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const failures = [];

/** A value as JSON with its keys sorted, so two documents compare by content, not by key order. */
const sorted = (v) =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
const sameJson = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

for (const pageDef of PAGES)
  for (const size of WIDTHS) {
    const label = `${pageDef.name} ${size.width}`;
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
    /** every saved document, across the collections: [{ id, name, ... }] */
    const docs = () =>
      p.evaluate((key) => {
        const all = JSON.parse(localStorage.getItem(key) || "{}");
        return Object.values(all).flatMap((c) =>
          Object.entries(c).map(([id, data]) => ({ id, ...data })),
        );
      }, DB_KEY);
    const docNamed = async (name) => (await docs()).find((d) => d.name === name);
    /** whether the save the design is open in (the draft's id, once written) passes `want` within 5 s */
    const openIs = async (want) => {
      for (let i = 0; i < 25; i++) {
        const id = await p.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) || "{}").id,
          pageDef.draft,
        );
        if (await want(id)) return true;
        await p.waitForTimeout(200);
      }
      return false;
    };
    const waitCount = (n) =>
      p
        .waitForFunction(
          ({ key, n }) =>
            Object.values(JSON.parse(localStorage.getItem(key) || "{}")).reduce(
              (sum, c) => sum + Object.keys(c).length,
              0,
            ) === n,
          { key: DB_KEY, n },
          { timeout: 5000 },
        )
        .catch(() => fail(`expected ${n} saves`));
    // the row's first text box is the name box, its first list the saved designs ("New from…" is the last)
    const row = p.getByRole("group", { name: SAVE_ROW_TEXT.row });
    const nameBox = row.getByRole("textbox").first();
    const list = row.getByRole("combobox").first();
    /** whether the design is open in no save: its id is no save's */
    const openInNone = () => openIs(async (id) => !(await docs()).some((d) => d.id === id));
    const button = (name) => p.getByRole("button", { name, exact: true });
    const pick = async (name) => {
      const doc = await docNamed(name);
      if (!doc) return fail(`no save named ${name}`);
      await list.selectOption(doc.id);
    };
    const noScroll = async (when) => {
      const m = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
      }));
      check(m.sw <= m.iw, `page scrolls sideways ${when} (${m.sw} > ${m.iw} px)`);
    };
    try {
      await p.goto(`${url}${pageDef.hash}`);
      await row.waitFor();
      await p.getByLabel(SAVE_ROW_TEXT.newFrom).selectOption({ label: pageDef.starts[0] });
      // Save a new design: one save, and the design is open in it
      await nameBox.fill("Design A");
      await button(SAVE_ROW_TEXT.save).click();
      await waitCount(1);
      const a = await docNamed("Design A");
      check(a && (await openIs((id) => id === a.id)), "a new save is not the open one");
      await noScroll("after Save");
      // edit and Save: the same save takes the edit (Enter in the name box saves)
      await nameBox.fill("Design A edited");
      await nameBox.press("Enter");
      await p.waitForTimeout(300);
      await waitCount(1);
      const edited = await docNamed("Design A edited");
      check(edited && a && edited.id === a.id, "Save made a new save, not an update");
      // the save holds the design as the page keeps it (its draft, written by now)
      await p.waitForTimeout(DRAFT_WRITE_MS + 500);
      const draft = await p.evaluate((key) => JSON.parse(localStorage.getItem(key)), pageDef.draft);
      if (edited && draft) {
        const { id: _i, savedAt: _s, ...stored } = edited;
        const { id: _d, ...kept } = draft;
        check(sameJson(stored, kept), "the save differs from the design");
      }
      // Save as: one more save, under the copy name, now the open one
      await button(SAVE_ROW_TEXT.saveAs).click();
      await waitCount(2);
      const copyName = SAVE_ROW_TEXT.copyName("Design A edited");
      const copy = await docNamed(copyName);
      check(copy && (await openIs((id) => id === copy.id)), "Save as did not open the new save");
      check((await nameBox.inputValue()) === copyName, "Save as left the name box");
      await nameBox.fill("Design B");
      await button(SAVE_ROW_TEXT.save).click();
      await p.waitForTimeout(300);
      await waitCount(2);
      check(
        (await docNamed("Design B"))?.id === copy?.id,
        "Save after Save as missed the new save",
      );
      check(
        Boolean(await docNamed("Design A edited")),
        "Save after Save as changed the first save",
      );
      // open another save
      await pick("Design A edited");
      await button(SAVE_ROW_TEXT.open).click();
      check((await nameBox.inputValue()) === "Design A edited", "Open did not load the name");
      check(await openIs((id) => id === a?.id), "Open did not make the save the open one");
      // a new name and Save: the open save takes it (one name per save)
      await nameBox.fill("Design A renamed");
      await button(SAVE_ROW_TEXT.save).click();
      await p.waitForTimeout(300);
      await waitCount(2);
      check(
        (await docNamed("Design A renamed"))?.id === a?.id,
        "Save did not rename the open save",
      );
      // Save as again, for a save to delete that is not the open one
      await pick("Design A renamed");
      await button(SAVE_ROW_TEXT.saveAs).click();
      await waitCount(3);
      const dupName = SAVE_ROW_TEXT.copyName("Design A renamed");
      check(Boolean(await docNamed(dupName)), "Save as made no copy");
      await pick("Design A renamed");
      await button(SAVE_ROW_TEXT.open).click();
      check(await openIs((id) => id === a?.id), "Open did not reopen the first save");
      // delete asks first: Cancel keeps it, Yes deletes it
      await pick(dupName);
      await p.getByRole("button", { name: SAVE_ROW_TEXT.deleteLabel(dupName) }).click();
      await p.getByText(SAVE_ROW_TEXT.confirmDelete(dupName)).waitFor();
      await noScroll("while Delete asks");
      await button(SAVE_ROW_TEXT.cancel).click();
      await p.waitForTimeout(200);
      await waitCount(3);
      await p.getByRole("button", { name: SAVE_ROW_TEXT.deleteLabel(dupName) }).click();
      await button(SAVE_ROW_TEXT.yes).click();
      await waitCount(2);
      check(await openIs((id) => id === a?.id), "deleting another save closed the open one");
      // deleting the open save closes it; Save then makes a new one
      await pick("Design A renamed");
      await p.getByRole("button", { name: SAVE_ROW_TEXT.deleteLabel("Design A renamed") }).click();
      await button(SAVE_ROW_TEXT.yes).click();
      await waitCount(1);
      check(await openInNone(), "deleting the open save left it open");
      // New from a preset: the design is open in no save
      await pick("Design B");
      await button(SAVE_ROW_TEXT.open).click();
      check(await openIs((id) => id === copy?.id), "Open did not open Design B");
      await p.getByLabel(SAVE_ROW_TEXT.newFrom).selectOption({ label: pageDef.starts[1] });
      check(await openInNone(), "New from left a save open");
      for (const action of [SAVE_ROW_TEXT.save, SAVE_ROW_TEXT.saveAs])
        check((await button(action).getAttribute("title")) === null, `${action} has a tooltip`);
      // a reload keeps the open save, so Save still updates it
      await pick("Design B");
      await button(SAVE_ROW_TEXT.open).click();
      await openIs((id) => id === copy?.id);
      await p.reload();
      await row.waitFor();
      check((await nameBox.inputValue()) === "Design B", "a reload lost the name");
      check(await openIs((id) => id === copy?.id), "a reload lost the open save");
      await nameBox.fill("Design B after reload");
      await button(SAVE_ROW_TEXT.save).click();
      await p.waitForTimeout(300);
      await waitCount(1);
      check(
        (await docNamed("Design B after reload"))?.id === copy?.id,
        "Save after a reload made a new save",
      );
      // a double click on Save, on a new design, makes exactly one save
      await p.getByLabel(SAVE_ROW_TEXT.newFrom).selectOption({ label: pageDef.starts[0] });
      await openInNone();
      await nameBox.fill("Design C");
      await button(SAVE_ROW_TEXT.save).dblclick();
      await p.waitForTimeout(800);
      await waitCount(2);
      const c = await docNamed("Design C");
      check(c && (await openIs((id) => id === c.id)), "a double-clicked Save is not the open one");
      await noScroll("at the end");
    } catch (e) {
      fail(`stopped: ${e.message.split("\n")[0]}`);
    }
    for (const e of errs) fail(`page error: ${e}`);
    await ctx.close();
  }

await browser.close();
if (failures.length) {
  console.error(`save row check: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`save row check: ok (${PAGES.map((p) => p.name).join(", ")}; 390 and 1440 px)`);
