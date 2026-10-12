import { defineConfig } from "vite-plus";

// The config behind `vp run preset-levels`: it runs only the Levels writer, which the main config's test include leaves
// out.
export default defineConfig({ test: { include: ["tests/update-preset-levels.ts"] } });
