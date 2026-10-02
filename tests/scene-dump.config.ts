import { defineConfig } from "vite-plus";

// The config behind `vp run golden`: it runs only the scene dump writer, which the main config's test include leaves out.
export default defineConfig({ test: { include: ["tests/scene-dump.ts"] } });
