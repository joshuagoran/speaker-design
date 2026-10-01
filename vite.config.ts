import { defineConfig } from "vite-plus";

export default defineConfig({
  // one self-contained page: a single JS chunk (dynamic imports and the worker inlined), one stylesheet, and every
  // asset (fonts) inlined as data URLs; build/inline.mjs then puts the JS and CSS into the HTML itself
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    // single-file by design (about 1.2 MB, or 1.7 MB with Firebase for Pages)
    chunkSizeWarningLimit: 4000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
  staged: {
    "*": "vp check --fix",
  },
  test: {
    include: ["tests/**/*.test.js"],
    // the optimizer tests take 5–7 s and assert their own 10 s budget; Vitest's 5 s default would cut them off
    testTimeout: 30_000,
  },
  fmt: {
    // golden.json is generated
    ignorePatterns: ["dist/**", "tests/golden.json"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
