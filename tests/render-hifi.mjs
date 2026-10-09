// Renders the Hi-fi speaker's 3D view, for looking at by eye (not part of `vp test` or CI):
//   node tests/render-hifi.mjs [outDir] [view …]
// Bundles tests/render/hifi.html (the default Hi-fi design in the page's own 3D view card, Viewer3DCard and HifiView3D,
// built from the props the Hi-fi page passes) and screenshots each view with Playwright. A view is a query string for
// that page (see hifi-view.tsx), e.g. "tweeter=de250&guide=diy_os90x70&az=35&el=20&zoom=0.9" or
// "box=radiator&az=200&theme=dark". Env: PW_MODULE, PW_CHROMIUM as for tests/mobile-check.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite-plus";

const outDir = path.resolve(process.argv[2] || "dist/render-hifi");
const DEFAULT_VIEWS = [
  "",
  "tweeter=de250&guide=diy_os90x70",
  "tweeter=de250&guide=st260&az=60&el=15",
  "tweeter=lt32&port=slot",
  "tweeter=ft17h&port=2&roundover=1",
  "box=radiator&az=200",
  "cutaway=1&roundover=0.75",
  "theme=dark&tweeter=de250&guide=diy_os90x70&zoom=0.9",
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
    rolldownOptions: { input: path.join(root, "hifi.html") },
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
const url = pathToFileURL(path.join(bundle, "hifi.html")).href;
for (const [i, v] of views.entries()) {
  await page.goto(`${url}?${v}`);
  // the viewer marks its mount once a scene is built and drawn
  await page.waitForSelector("[data-rebuilds]", { timeout: 60_000 });
  await page.waitForTimeout(300);
  const file = path.join(outDir, `view-${i}.png`);
  await page.locator("#root").screenshot({ path: file });
  console.log(file, v);
}
await browser.close();
