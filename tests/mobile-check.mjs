// Layout check at phone and tablet widths, run in CI after the build (not part of `vp test`).
//   node tests/mobile-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE (path to playwright's index.mjs, default "playwright"), PW_CHROMIUM (browser binary).
// Fails on: horizontal page scroll, touch targets under 40 px, chip text squeezed under 120 px, page errors, and any
// request outside the page: everything is bundled in, so the page must work with the network blocked.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PA_RUN_LABELS } from "../src/constants/optimizerText.ts";
import { PA_SETTINGS_TABS } from "../src/constants/paSettingsTabs.ts";

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
const views = ["", "#coverage", "#cutlist", "#fills", "#hifi", "#notes"];
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
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, small, squeezed };
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
    await check("#planner, sections open");
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
await browser.close();

if (failures.length) {
  console.error(`mobile check: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`mobile check: ok (${sizes.map((s) => s.name).join(", ")}; ${views.length} views)`);
