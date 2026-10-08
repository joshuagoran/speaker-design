// Layout check at phone and tablet widths, run in CI after the build (not part of `vp test`).
//   node tests/mobile-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE (path to playwright's index.mjs, default "playwright"), PW_CHROMIUM (browser binary).
// Fails on: horizontal page scroll, touch targets under 40 px, chip text squeezed under 120 px, page errors, and any
// request outside the page: everything is bundled in, so the page must work with the network blocked. Also drags a
// toe-in handle on the Coverage map (desktop, mid band) and fails if the map doesn't follow or the layout moves.
// Detail rows (label / value / caption): a caption must stay inside its row, right of the label, at every width
// checked here and on a desktop window.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PA_RUN_LABELS } from "../src/constants/optimizerText.ts";
import { PA_SETTINGS_TABS } from "../src/constants/paSettingsTabs.ts";
import { COVERAGE_LAYOUT_KEY, COVERAGE_TEST_IDS } from "../src/constants/coverageTestIds.ts";
import { STAT_ROW_TEST_IDS } from "../src/constants/statRowTestIds.ts";

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
const views = ["", "#coverage", "#cutlist", "#fills", "#hifi", "#hifi-cutlist", "#notes"];
const failures = [];

// Everything the check measures, evaluated in the page.
const measure = (ids) => {
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
  // detail-row captions: the text itself (not its box, which an overflowing line runs past) must end inside the row
  // and start right of the label
  const notes = [...document.querySelectorAll(`[data-testid="${ids.note}"]`)].filter(vis);
  const captions = notes
    .map((e) => {
      const row = e.closest(`[data-testid="${ids.row}"]`);
      const label = row?.firstElementChild;
      if (!row || !label) return `"${e.textContent.slice(0, 40)}" outside a detail row`;
      const range = document.createRange();
      range.selectNodeContents(e);
      const text = range.getBoundingClientRect();
      const cell = row.getBoundingClientRect();
      if (text.right > cell.right + 0.5)
        return `"${e.textContent.slice(0, 40)}" ends ${Math.round(text.right - cell.right)}px past its cell`;
      if (text.left < label.getBoundingClientRect().right - 0.5)
        return `"${e.textContent.slice(0, 40)}" overlaps its label`;
      return null;
    })
    .filter(Boolean);
  return {
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    small,
    squeezed,
    notes: notes.length,
    captions,
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
    const m = await p.evaluate(measure, STAT_ROW_TEST_IDS);
    if (m.sw > m.iw)
      failures.push(`${size.name} ${label}: page scrolls sideways (${m.sw} > ${m.iw} px)`);
    for (const s of m.small) failures.push(`${size.name} ${label}: small touch target ${s}`);
    for (const s of m.squeezed) failures.push(`${size.name} ${label}: chip text squeezed ${s}`);
    for (const s of m.captions) failures.push(`${size.name} ${label}: detail caption ${s}`);
    return m;
  };
  for (const v of views) {
    await p.evaluate((h) => {
      location.hash = h;
    }, v);
    await p.waitForTimeout(600);
    await check(v || "#planner");
  }
  // planner on phones: open every folded section and every settings tab
  await p.evaluate(() => {
    location.hash = "";
  });
  await p.waitForTimeout(600);
  if (size.name === "phone") {
    const closed = p.locator("h2 button[aria-expanded=false]");
    for (let i = 0; i < 10 && (await closed.count()); i++) await closed.first().tap();
    await p.waitForTimeout(300);
    const open = await check("#planner, sections open");
    if (!open.notes) failures.push(`${size.name} #planner: no detail-row captions to check`);
    for (const tab of Object.values(PA_SETTINGS_TABS)) {
      await p.getByRole("tab", { name: tab }).tap();
      await p.waitForTimeout(300);
      await check(`#planner, ${tab} tab`);
    }
    // optimizer on: lock buttons in the settings, the panel, and result cards after a search
    await p
      .getByRole("button", { name: "Close settings" })
      .tap()
      .catch(() => {});
    await p.locator('button:has-text("Optimizer: off")').tap();
    await p.waitForTimeout(300);
    await check("#planner, optimizer on");
    await p.locator('button[title="Same output, cheaper"]').tap(); // goals start unselected
    await p.getByRole("button", { name: PA_RUN_LABELS.improve, exact: true }).tap();
    await p.waitForSelector("text=Searched", { timeout: 90000 });
    await check("#planner, optimizer results");
  }
  for (const e of errs) failures.push(`${size.name}: page error: ${e}`);
  await ctx.close();
}

// Detail-row captions on desktop windows, every view (sections fold on phones only, so all are open here). At these
// widths PA Design's results column puts its detail rows two to a line, so each row is at its narrowest.
for (const width of [1024, 1600]) {
  const name = `desktop ${width}`;
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(page);
  await p.waitForFunction(() => document.querySelector("nav a"), null, { timeout: 30000 });
  let notes = 0;
  for (const v of views) {
    await p.evaluate((h) => {
      location.hash = h;
    }, v);
    await p.waitForTimeout(600);
    const m = await p.evaluate(measure, STAT_ROW_TEST_IDS);
    notes += m.notes;
    for (const s of m.captions) failures.push(`${name} ${v || "#planner"}: detail caption ${s}`);
  }
  if (!notes) failures.push(`${name}: no detail-row captions to check`);
  for (const e of errs) failures.push(`${name}: page error: ${e}`);
  await ctx.close();
}

// Coverage map, desktop, mid band: dragging a toe-in handle updates the map while dragging and after release, at one
// resolution throughout, and nothing above the map moves meanwhile.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(
    ([key]) => localStorage.setItem(key, JSON.stringify({ band: "mid" })),
    [COVERAGE_LAYOUT_KEY],
  );
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(page + "#coverage");
  const map = p.getByTestId(COVERAGE_TEST_IDS.map);
  const settled = () =>
    p.waitForFunction(
      (id) => {
        const m = document.querySelector(`[data-testid="${id}"]`);
        return m && m.getAttribute("aria-busy") === "false" && m.querySelector("image");
      },
      COVERAGE_TEST_IDS.map,
      { timeout: 30000 },
    );
  const image = () => map.locator("image").getAttribute("href");
  const top = async () => (await map.boundingBox())?.y;
  // the grid's size: the map draws it as an image of one pixel a cell
  const cells = (href) =>
    p.evaluate(
      (src) =>
        new Promise((done) => {
          const im = new Image();
          im.onload = () => done(`${im.naturalWidth}x${im.naturalHeight}`);
          im.onerror = () => done("unreadable");
          im.src = src;
        }),
      href,
    );
  await settled();
  const before = await image(),
    topBefore = await top();
  const h = await p.getByTestId(COVERAGE_TEST_IDS.aimHandle).first().boundingBox();
  if (!h) failures.push("coverage: no toe-in handle on the map");
  else {
    const x = h.x + h.width / 2,
      y = h.y + h.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    const live = new Set();
    for (let i = 1; i <= 8; i++) {
      await p.mouse.move(x + i * 8, y + i * 2);
      await p.waitForTimeout(150);
      live.add(await image());
    }
    if ((await top()) !== topBefore) failures.push("coverage: the map moved during a drag");
    await p.mouse.up();
    await settled();
    const after = await image();
    live.delete(before);
    if (live.size < 2)
      failures.push(`coverage: the map changed ${live.size} time(s) during a toe-in drag`);
    if (after === before) failures.push("coverage: the settled map ignored a toe-in drag");
    const sizes = new Set(await Promise.all([before, after, ...live].map(cells)));
    if (sizes.size !== 1)
      failures.push(`coverage: the grid changed size during a drag (${[...sizes].join(", ")})`);
    if ((await top()) !== topBefore) failures.push("coverage: the map moved after a drag");
  }
  for (const e of errs) failures.push(`coverage drag: page error: ${e}`);
  await ctx.close();
}
await browser.close();

if (failures.length) {
  console.error(`mobile check: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(
  `mobile check: ok (${sizes.map((s) => s.name).join(", ")}, desktop 1024, desktop 1600; ${views.length} views)`,
);
