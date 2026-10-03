import { defineConfig } from "vite-plus";

// The config behind `vp run optimizer-dump`: it runs only the optimizer dump writer, which the main config's test
// include leaves out. The Hi-fi search takes seconds per run, so the dump takes minutes.
export default defineConfig({
  test: { include: ["tests/optimizer-dump.ts"], testTimeout: 1_800_000 },
});
