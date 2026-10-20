// Layout check at phone and tablet widths, run in CI after the build (not part of `vp test`).
//   node tests/mobile-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE (path to playwright's index.mjs, default "playwright"), PW_CHROMIUM (browser binary).
// Fails on: horizontal page scroll, touch targets under 40 px, chip text squeezed under 120 px, page errors, and any
// request outside the page: everything is bundled in, so the page must work with the network blocked.
// On the Speaker and Stack pages (360 px, a tablet, a desktop), every fold open and the optimizer's cards showing: nothing past the settings pane's edge.
// On a phone, every page's settings sheet is checked closed and open on each tab (with its heading), and closes again.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GOAL_SHORT_NAMES } from "../src/constants/optimizerText.ts";
import { SPEAKER_START_NAMES } from "../src/constants/speakerStarts.ts";
import { START_PICKER_TEXT } from "../src/constants/startPicker.ts";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow.ts";
import { SPEAKER_OPTIMIZER_TEXT } from "../src/constants/speakerOptimizerText.ts";

const { chromium } = await import(process.env.PW_MODULE || "playwright");
const page = pathToFileURL(path.resolve(process.argv[2] || "dist/stack-planner.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader"],
});

const sizes = [
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: "tablet", viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  // the dark theme (the device's setting): the same views, so a dark-only layout problem or page error shows up too
  {
    name: "phone-dark",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  },
];
// "" (no hash) opens the Speaker page
const views = ["", "#speaker", "#speaker-cutlist", "#stack", "#stack-cutlist", "#space"];
const failures = [];

// Everything the check measures, evaluated in the page.
const measure = () => {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  };
  const small = [...document.querySelectorAll("button, select, nav a")]
    .filter(vis)
    .filter((e) => e.getBoundingClientRect().height < 39.5)
    .map(
      (e) =>
        `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().height)}px`,
    );
  // chip body forced into a narrow column: under 120 px wide and wrapping past two lines
  const squeezed = [...document.querySelectorAll("div > b.font-semibold + span")]
    .filter(vis)
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width < 120 && r.height > 2.5 * parseFloat(getComputedStyle(e).lineHeight || "16");
    })
    .map(
      (e) =>
        `"${e.previousElementSibling.textContent.slice(0, 40)}" ${Math.round(e.getBoundingClientRect().width)}px`,
    );
  return {
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    small,
    squeezed,
  };
};

for (const size of sizes) {
  const ctx = await browser.newContext({ ...size, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  // block the network: anything not inside the page (file: / data: / blob:) is a failure
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (/^(file|data|blob):/.test(u)) return r.continue();
    failures.push(`${size.name}: external request ${u.slice(0, 100)}`);
    return r.abort();
  });
  await p.goto(page);
  await p.waitForFunction(() => document.querySelector("nav a"), null, { timeout: 30000 });
  // the compiled Tailwind stylesheet is inlined: without it every measurement is meaningless
  const styled = await p
    .waitForFunction(
      () => getComputedStyle(document.querySelector("nav")).display === "flex",
      null,
      { timeout: 30000 },
    )
    .then(
      () => true,
      () => false,
    );
  if (!styled) {
    failures.push(
      `${size.name}: the page isn't styled (compiled Tailwind CSS missing); can't check the layout`,
    );
    await ctx.close();
    continue;
  }
  const check = async (label) => {
    const m = await p.evaluate(measure);
    if (m.sw > m.iw)
      failures.push(`${size.name} ${label}: page scrolls sideways (${m.sw} > ${m.iw} px)`);
    for (const s of m.small) failures.push(`${size.name} ${label}: small touch target ${s}`);
    for (const s of m.squeezed) failures.push(`${size.name} ${label}: chip text squeezed ${s}`);
    return m;
  };
  for (const v of views) {
    await p.evaluate((h) => {
      location.hash = h;
    }, v);
    await p.waitForTimeout(600);
    await check(v || "(no hash)");
    // on a phone the settings are a sheet: each tab opens it on its section, with the section's name on top; a second
    // tap on the open tab closes it
    const tabs = p.locator("aside [role=tab]:visible");
    const names = await tabs.allTextContents();
    for (const [i, name] of names.entries()) {
      await tabs.nth(i).click();
      await p.waitForTimeout(250);
      await check(`${v || "(no hash)"} sheet ${name}`);
      if (!(await p.locator("aside h2:visible").count()))
        failures.push(`${size.name} ${v}: the sheet's ${name} tab shows no heading`);
    }
    if (names.length) {
      await tabs.nth(names.length - 1).click();
      await p.waitForTimeout(250);
      if (await p.locator("aside [role=tab][aria-selected=true]").count())
        failures.push(`${size.name} ${v}: a tap on the open tab leaves the sheet open`);
    }
  }
  for (const e of errs) failures.push(`${size.name}: page error: ${e}`);
  await ctx.close();
}

// The Notes page has no tab and no hash: it opens at the path /notes. Serve the page at that path and check it as the
// views are checked, and that no tab leads to it.
for (const size of sizes) {
  const ctx = await browser.newContext({ ...size });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route("https://speaknow.test/**", (r) =>
    r.fulfill({ path: fileURLToPath(page), contentType: "text/html" }),
  );
  await p.goto("https://speaknow.test/notes/");
  await p.waitForFunction(() => document.querySelector("nav a"), null, { timeout: 30000 });
  await p.waitForTimeout(600);
  const m = await p.evaluate(measure);
  if (m.sw > m.iw)
    failures.push(`${size.name} /notes: page scrolls sideways (${m.sw} > ${m.iw} px)`);
  for (const t of m.small) failures.push(`${size.name} /notes: small touch target ${t}`);
  if (!(await p.locator("h2").count()))
    failures.push(`${size.name} /notes: the Notes page is not shown`);
  if (await p.locator("nav a", { hasText: /^Notes$/ }).count())
    failures.push(`${size.name}: a tab leads to Notes`);
  for (const e of errs) failures.push(`${size.name} /notes: page error: ${e}`);
  await ctx.close();
}

// Page errors on desktop windows, every view (sections fold on phones only, so all are open here).
for (const width of [1024, 1600]) {
  const name = `desktop ${width}`;
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(page);
  await p.waitForFunction(() => document.querySelector("nav a"), null, { timeout: 30000 });
  for (const v of views) {
    await p.evaluate((h) => {
      location.hash = h;
    }, v);
    await p.waitForTimeout(600);
  }
  for (const e of errs) failures.push(`${name}: page error: ${e}`);
  await ctx.close();
}

// An optimizer page (Speaker, Stack) started from one of its starts, every fold open and the Keep list open: pick a goal,
// find designs, wait for the cards (the results block shows its heading). Nothing past the settings pane's edge and no
// sideways page scroll, on a 360 px phone, a tablet (the two panes from md up) and a desktop.
async function optimizerPageCheck({ name, hash, width, phone, startName, fallbackStart }) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: phone,
    hasTouch: phone,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(page + hash);
  await p.waitForFunction(() => document.querySelector("aside"), null, { timeout: 30000 });
  // on a phone the settings are a sheet, one section per tab: open each tab in turn (a tap on the open tab closes it)
  const tabs = p.locator("aside [role=tab]:visible");
  const openTab = async (i) => {
    if ((await tabs.nth(i).getAttribute("aria-selected")) !== "true") await tabs.nth(i).click();
  };
  /** opens the sheet on the tab that shows `target` (from md up the column shows every section) */
  const reveal = async (target) => {
    const n = await tabs.count();
    for (let i = 0; i < n && !(await target.first().isVisible()); i++) await openTab(i);
  };
  const closed = p.locator("aside button[aria-expanded=false]:visible");
  const openFolds = async () => {
    for (let i = 0; i < 10 && (await closed.count()); i++) await closed.first().click();
  };
  const tabCount = await tabs.count();
  if (tabCount)
    for (let i = 0; i < tabCount; i++) {
      await openTab(i);
      await openFolds();
    }
  else await openFolds();
  // a page with a saving row starts from its "New from…" list (picking one replaces the design); else from its picker
  const newFrom = p.getByLabel(SAVE_ROW_TEXT.newFrom);
  const fromRow = (await newFrom.count()) > 0;
  const start = fromRow ? newFrom : p.getByLabel(START_PICKER_TEXT.startFrom);
  await reveal(start);
  const options = await start.locator("option").allTextContents();
  const many = startName ?? options.find((o) => fallbackStart.test(o));
  if (many) {
    await start.selectOption({ label: many });
    if (!fromRow) await p.getByRole("button", { name: START_PICKER_TEXT.startOver }).click();
  }
  // the Keep list (a closed fold inside the Optimizer fold) open too: its long lines must wrap inside the pane
  const goal = p.getByRole("button", { name: GOAL_SHORT_NAMES.cheaper });
  await reveal(goal);
  const keep = p.locator("aside details:not([open]) > summary", {
    hasText: SPEAKER_OPTIMIZER_TEXT.keep,
  });
  if (await keep.count()) await keep.first().click();
  // the Optimizer fold: pick a goal, find designs, and wait for the cards
  await goal.click();
  await p.getByRole("button", { name: SPEAKER_OPTIMIZER_TEXT.run }).click();
  try {
    await p
      .getByRole("heading", { name: SPEAKER_OPTIMIZER_TEXT.results, exact: true, level: 2 })
      .waitFor({ timeout: 60000 });
  } catch {
    failures.push(`${name}: the optimizer showed no results`);
  }
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const aside = document.querySelector("aside");
    const edge = aside ? aside.getBoundingClientRect().right : Infinity;
    const past = aside
      ? [...aside.querySelectorAll("input, select, button")]
          .filter((e) => e.getBoundingClientRect().right > edge + 0.5)
          .map(
            (e) =>
              `${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") || e.textContent || e.id).trim().slice(0, 30)}"`,
          )
      : [];
    return {
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      past,
    };
  });
  if (m.sw > m.iw) failures.push(`${name}: page scrolls sideways (${m.sw} > ${m.iw} px)`);
  for (const s of m.past) failures.push(`${name}: past the settings pane's edge: ${s}`);
  for (const e of errs) failures.push(`${name}: page error: ${e}`);
  await ctx.close();
}

// The Speaker page started from the PA mid/high box (or tower) template, and from the PA v2 sub bin (its Horn settings).
for (const [width, phone, startName] of [
  [360, true, null],
  [768, true, null],
  [1024, false, null],
  [360, true, SPEAKER_START_NAMES.paV2SubBinTwo],
  [1024, false, SPEAKER_START_NAMES.paV2SubBinTwo],
])
  await optimizerPageCheck({
    name: `speaker ${width}${startName ? ` (${startName})` : ""}`,
    hash: "#speaker",
    width,
    phone,
    startName,
    fallbackStart: /tower|mid\/high/i,
  });

// The Stack page started from the PA stack (sub and top) and from the PA tower (one speaker).
for (const [width, phone, start] of [
  [360, true, /^PA stack/],
  [768, true, /^PA stack/],
  [1024, false, /^PA stack/],
  [360, true, /PA tower/],
  [1024, false, /PA tower/],
])
  await optimizerPageCheck({
    name: `stack ${width} (${start.source})`,
    hash: "#stack",
    width,
    phone,
    startName: null,
    fallbackStart: start,
  });

await browser.close();

if (failures.length) {
  console.error(`mobile check: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(
  `mobile check: ok (${sizes.map((s) => s.name).join(", ")}, desktop 1024, desktop 1600; ${views.length} views)`,
);
