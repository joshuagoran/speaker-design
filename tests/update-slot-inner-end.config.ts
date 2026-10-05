import { defineConfig } from "vite-plus";

// The config behind `vp run slot-inner-end`: it runs only the table writer, which the main config's test include leaves
// out.
export default defineConfig({ test: { include: ["tests/update-slot-inner-end.ts"] } });
