// GPU memory check for the PA stack's 3D view, run in CI after the build (not part of `vp test`).
//   node tests/three-memory-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE, PW_CHROMIUM as for tests/mobile-check.mjs.
// Rebuilds the 3D view many times (a slider stepped up and back) and fails if the live geometry or texture count
// (three.js renderer.info.memory, which StackView3D writes on its mount as data-geometries / data-textures,
// with data-rebuilds counting its rebuilds) grows, or
// if the view holds more than one canvas (one WebGL renderer for the component's life).
import path from "node:path";
import { pathToFileURL } from "node:url";

const REBUILDS = 30;
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const url = pathToFileURL(path.resolve(process.argv[2] || "dist/stack-planner.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url);
const view = page.locator("[data-geometries]");
await view.waitFor({ timeout: 60_000 });
const read = () =>
  view.evaluate((el) => ({
    geometries: Number(el.dataset.geometries),
    textures: Number(el.dataset.textures),
    canvases: el.querySelectorAll("canvas").length,
  }));
const slider = page.locator('input[type="range"]').first();
/** Steps the slider and waits for the rebuild it starts (after StackView3D's 120 ms throttle). */
const step = async (key) => {
  const before = await view.evaluate((el) => Number(el.dataset.rebuilds));
  await slider.press(key);
  await page.waitForFunction(
    (n) => Number(document.querySelector("[data-geometries]")?.dataset.rebuilds) > n,
    before,
    { timeout: 30_000 },
  );
};
await slider.focus();
const first = await read();
const counts = [];
for (let i = 0; i < REBUILDS; i++) {
  await step(i % 2 ? "ArrowLeft" : "ArrowRight");
  counts.push(await read());
}
await browser.close();

const last = counts[counts.length - 1];
const failures = errors.map((e) => `page error: ${e}`);
// an even number of steps ends on the design it started from, so the counts must match
if (last.geometries > first.geometries)
  failures.push(
    `geometries grew from ${first.geometries} to ${last.geometries} over ${REBUILDS} rebuilds`,
  );
if (last.textures > first.textures)
  failures.push(
    `textures grew from ${first.textures} to ${last.textures} over ${REBUILDS} rebuilds`,
  );
if (counts.some((c) => c.canvases !== 1))
  failures.push(`the view held ${Math.max(...counts.map((c) => c.canvases))} canvases`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `three memory check: ok (${REBUILDS} rebuilds; ${first.geometries} → ${last.geometries} geometries, ${last.textures} textures, 1 canvas)`,
);
