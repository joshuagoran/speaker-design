import { defineConfig } from "vite-plus";
import type { Plugin } from "vite-plus";
import {
  HOST_THEME_ATTR,
  THEME_ATTR,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
} from "./src/constants/themes";

// Applies the stored theme choice before first paint, so a page pinned to light or dark never flashes the other: a tiny
// classic script at the top of <head>, ahead of the stylesheet. It keeps a theme the host page set first (the claude.ai
// artifact frame) for System to return to; without storage it does nothing and the device's setting applies.
const q = (v: unknown) => JSON.stringify(v);
const themeBootScript = (): Plugin => ({
  name: "speaknow-theme-boot",
  transformIndexHtml: () => [
    {
      tag: "script",
      injectTo: "head-prepend",
      children:
        `(function(){var r=document.documentElement,h=r.getAttribute(${q(THEME_ATTR)});` +
        `if(h)r.setAttribute(${q(HOST_THEME_ATTR)},h);` +
        `try{var t=JSON.parse(localStorage.getItem(${q(THEME_STORAGE_KEY)}));` +
        `if(${q([THEME_LIGHT, THEME_DARK])}.indexOf(t)>=0)r.setAttribute(${q(THEME_ATTR)},t)}catch(e){}})()`,
    },
  ],
});

// The Pages build (build/build.sh sets this) keeps Firebase in its own file next to the page, fetched only when someone
// signs in; the artifact page stays a single file with everything inlined.
const splitFirebase = process.env.SPEAKNOW_SPLIT_FIREBASE === "1";

export default defineConfig({
  // relative URLs, so the separate Firebase file resolves next to the page on GitHub Pages
  base: "./",
  plugins: [themeBootScript()],
  // one self-contained page: a single JS chunk (dynamic imports and the worker inlined), one stylesheet, and every
  // asset (fonts) inlined as data URLs; build/inline.mjs then puts the JS and CSS into the HTML itself
  build: {
    // split chunks sit beside the entry chunk, so their relative imports still resolve once the entry is inlined
    assetsDir: splitFirebase ? "" : "assets",
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    // single-file by design (about 1.2 MB, or 1.7 MB with Firebase for Pages)
    chunkSizeWarningLimit: 4000,
    rolldownOptions: { output: { codeSplitting: splitFirebase } },
  },
  staged: {
    "*": "vp check --fix",
  },
  test: {
    include: ["tests/**/*.test.{js,ts}"],
    // the optimizer tests take 5–7 s and assert their own 10 s budget; Vitest's 5 s default would cut them off
    testTimeout: 30_000,
  },
  fmt: {
    // golden.json, optimizer-dump.json, optimizer-snapshot.json, the slot inner-end table and the meshes are generated
    ignorePatterns: [
      "dist/**",
      "src/data/acoustics/slot-inner-end.ts",
      "src/data/meshes/h1105.ts",
      "tests/golden.json",
      "tests/optimizer-dump.json",
      "tests/optimizer-snapshot.json",
    ],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true },
      ],
    },
    options: { typeAware: true, typeCheck: true },
  },
});
