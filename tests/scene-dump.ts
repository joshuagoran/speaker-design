import { test } from "vite-plus/test";
import fs from "node:fs";
import { buildStackScene } from "../src/components/stack-view/buildStackScene";
import { sceneCases, dumpScene } from "./scene-cases";

// Rewrites tests/scene-dump.json from the current scene builder. Run it after each step of a refactor of the builder, on its
// own:
//   vp run scene-dump
// then `git diff tests/scene-dump.json` must be empty. It is not part of `vp test` (see tests/scene-dump.config.ts).
test("write tests/scene-dump.json", () => {
  const out: Record<string, object[]> = {};
  for (const c of sceneCases) out[c.name] = dumpScene(buildStackScene(c.props));
  fs.writeFileSync(
    new URL("./scene-dump.json", import.meta.url),
    JSON.stringify(out, null, 1) + "\n",
  );
});
