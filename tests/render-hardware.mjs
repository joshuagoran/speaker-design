// Renders the 3D view's hardware close up, for looking at by eye (not part of `vp test`):
//   node tests/render-hardware.mjs [outDir] [view …]
// Bundles tests/render/hardware.html (the default PA stack with its handles, dishes and posts, built as the planner
// builds it) and screenshots each view with Playwright. A view is a query string for that page (see hardware-view.ts),
// e.g. "handle=H1105&az=90&el=10&dist=40&ty=18". Env: PW_MODULE, PW_CHROMIUM as for tests/mobile-check.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite-plus";

const outDir = path.resolve(process.argv[2] || "dist/render-hardware");
const DEFAULT_VIEWS = [
  "handle=H1105&az=60&el=15&dist=150",
  "handle=H1105&az=90&el=8&dist=45&ty=18",
  "handle=30769&az=90&el=8&dist=45&ty=18",
  "handle=H1105&az=180&el=10&dist=60&ty=10",
  "handle=H1105&az=150&el=55&dist=45&ty=44",
  "handle=H1105&cutaway=1&az=60&el=25&dist=120",
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
    rolldownOptions: { input: path.join(root, "hardware.html") },
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
const url = pathToFileURL(path.join(bundle, "hardware.html")).href;
for (const [i, v] of views.entries()) {
  await page.goto(`${url}?${v}`);
  await page.waitForFunction(() => document.title === "rendered", null, { timeout: 60_000 });
  const file = path.join(outDir, `view-${i}.png`);
  await page.screenshot({ path: file });
  console.log(file, v);
}
await browser.close();
