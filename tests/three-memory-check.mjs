// GPU memory check for the 3D views (the PA stack's, the Hi-fi speaker's and the Speaker page's), run in CI after the build
// (not part of `vp test`).
//   node tests/three-memory-check.mjs [page]        default: dist/stack-planner.html
// Env: PW_MODULE, PW_CHROMIUM as for tests/mobile-check.mjs.
// On each page, rebuilds its 3D view many times (its first slider, or the Speaker page's first number field, stepped up and
// back) and fails if the live geometry or texture count (three.js renderer.info.memory, which the viewer, SceneView3D, writes on its mount as
// data-geometries / data-textures, with data-rebuilds counting its rebuilds) grows, or if the view holds more than one
// canvas (one WebGL renderer for the component's life).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PA_LAYOUT_NAMES } from "../src/constants/paLayouts.ts";
import { SPEAKER_START_NAMES, SPEAKER_START_TEXT } from "../src/constants/speakerStarts.ts";

const REBUILDS = 30;
/** The pages with a 3D view: the PA stack (the default view), Hi-fi and the Speaker page, and the control each steps. */
const SLIDER = { control: 'input[type="range"]', up: "ArrowRight", down: "ArrowLeft" };
const VIEWS = [
  { name: "PA", hash: "", ...SLIDER },
  { name: "Hi-fi", hash: "#hifi", ...SLIDER },
  // the PA tower started on the Speaker page (horns, a vent, shared walls), its first chamber's width stepped: one shell, then a
  // stepped one
  {
    name: "Speaker",
    hash: "",
    control: 'input[type="number"]',
    up: "ArrowUp",
    down: "ArrowDown",
    prepare: async (page) => {
      await page.getByRole("button", { name: PA_LAYOUT_NAMES.tower, exact: true }).first().click();
      await page.evaluate(() => (location.hash = "#speaker"));
      await page
        .getByLabel(SPEAKER_START_TEXT.startFrom)
        .selectOption({ label: SPEAKER_START_NAMES.paTower });
      await page.getByRole("button", { name: SPEAKER_START_TEXT.startOver }).click();
      // built empty when the page opens, then as the tower
      await page.waitForFunction(
        () => Number(document.querySelector("[data-geometries]")?.dataset.rebuilds) >= 2,
        null,
        { timeout: 30_000 },
      );
    },
  },
];
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const url = pathToFileURL(path.resolve(process.argv[2] || "dist/stack-planner.html")).href;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader"],
});
const failures = [];
const results = [];
for (const { name, hash, control, up, down, prepare } of VIEWS) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + hash);
  const view = page.locator("[data-geometries]");
  await view.waitFor({ timeout: 60_000 });
  if (prepare) await prepare(page);
  const read = () =>
    view.evaluate((el) => ({
      geometries: Number(el.dataset.geometries),
      textures: Number(el.dataset.textures),
      canvases: el.querySelectorAll("canvas").length,
    }));
  const slider = page.locator(control).first();
  /** Steps the control and waits for the rebuild it starts (after the viewer's 120 ms throttle). */
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
    await step(i % 2 ? down : up);
    counts.push(await read());
  }
  await page.close();

  const last = counts[counts.length - 1];
  failures.push(...errors.map((e) => `${name}: page error: ${e}`));
  // an even number of steps ends on the design it started from, so the counts must match
  if (last.geometries > first.geometries)
    failures.push(
      `${name}: geometries grew from ${first.geometries} to ${last.geometries} over ${REBUILDS} rebuilds`,
    );
  if (last.textures > first.textures)
    failures.push(
      `${name}: textures grew from ${first.textures} to ${last.textures} over ${REBUILDS} rebuilds`,
    );
  if (counts.some((c) => c.canvases !== 1))
    failures.push(`${name}: the view held ${Math.max(...counts.map((c) => c.canvases))} canvases`);
  results.push(
    `${name} ${first.geometries} → ${last.geometries} geometries, ${last.textures} textures`,
  );
}
await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`three memory check: ok (${REBUILDS} rebuilds each; ${results.join("; ")}; 1 canvas)`);
