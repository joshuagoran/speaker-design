import { defineConfig } from "vite-plus";

// The config behind `vp run xmax-audit`: it runs only the Xmax audit writer, which the main config's test include
// leaves out.
export default defineConfig({
  test: { include: ["tests/xmax-audit.ts"] },
});
