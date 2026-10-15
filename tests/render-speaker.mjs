// Renders the Speaker page's 3D view and front drawing, for looking at by eye (not part of `vp test` or CI):
//   node tests/render-speaker.mjs [outDir] [view …]
// Bundles tests/render/speaker.html (a template's speaker in the page's own 3D view card, Viewer3DCard and
// SpeakerView3D, or its SpeakerFront) and screenshots each view with Playwright. A view is a query string for that page
// (see speaker-view.tsx), e.g. "template=paV2SubBinTwo&cutaway=1&az=30&el=20". Env: PW_MODULE, PW_CHROMIUM as for
// tests/mobile-check.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite-plus";

const outDir = path.resolve(process.argv[2] || "dist/render-speaker");
const DEFAULT_VIEWS = [
  "template=paV2SubBinOne&az=25&el=15",
  "template=paV2SubBinTwo&az=25&el=15",
  "template=paV2MidBox&az=25&el=15",
  "template=paV2SubBinTwo&cutaway=1&az=25&el=20",
  "template=paV2MidBox&view=front",
  "template=paV2MidBox&cutaway=1&az=10&el=15",
  "template=paSubBox&az=75&el=12",
  "template=paSubBox&view=front",
];
const views = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_VIEWS;
const root = path.resolve("tests/render");
const bundle = path.join(outDir, "page");
await build({
  root,
  configFile: false,
  base: "./",
  logLevel: "warn",
  build: {
    outDir: bundle,
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: { input: path.join(root, "speaker.html") },
  },
});
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ["--use-gl=swiftshader", "--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
fs.mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(path.join(bundle, "speaker.html")).href;
for (const [i, v] of views.entries()) {
  await page.goto(`${url}?${v}`);
  // the viewer marks its mount once a scene is built and drawn; the front drawing sets the title
  await page.waitForFunction(
    () => document.title === "rendered" || document.querySelector("[data-rebuilds]"),
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(300);
  const file = path.join(outDir, `view-${i}.png`);
  await page.locator("#root").screenshot({ path: file });
  console.log(file, v);
}
await browser.close();
