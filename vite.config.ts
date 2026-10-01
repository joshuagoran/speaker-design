import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  test: {
    include: ["tests/**/*.test.js"],
    // the optimizer tests take 5–7 s and assert their own 10 s budget; Vitest's 5 s default would cut them off
    testTimeout: 30_000,
  },
  fmt: {
    // the head files are open-ended fragments the build concatenates with the bundle; golden.json is generated
    ignorePatterns: ["dist/**", "tools/*.head.html", "tests/golden.json"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
