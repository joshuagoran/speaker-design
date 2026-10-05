import { defineConfig } from "vite-plus";

// The Pages build (build/build.sh sets this) keeps Firebase in its own file next to the page, fetched only when someone
// signs in; the artifact page stays a single file with everything inlined.
const splitFirebase = process.env.SPEAKNOW_SPLIT_FIREBASE === "1";

export default defineConfig({
  // relative URLs, so the separate Firebase file resolves next to the page on GitHub Pages
  base: "./",
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
    // golden.json and optimizer-dump.json are generated
    ignorePatterns: ["dist/**", "tests/golden.json", "tests/optimizer-dump.json"],
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
