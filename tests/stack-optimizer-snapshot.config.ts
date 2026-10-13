import { defineConfig } from "vite-plus";

// The config behind `vp run stack-optimizer-snapshot`: it runs only the snapshot writer, which the main config's test
// include leaves out.
export default defineConfig({
  test: { include: ["tests/update-stack-optimizer-snapshot.ts"], testTimeout: 300_000 },
});
