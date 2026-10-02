import { defineConfig } from "vite-plus";

// The config behind `vp run golden`: it runs only the golden writer, which the main config's test include leaves out.
export default defineConfig({ test: { include: ["tests/update-golden.ts"] } });
