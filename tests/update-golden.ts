import { test } from "vite-plus/test";
import fs from "node:fs";
import { goldenCases, type GoldenValues } from "./golden-configs";

// Rewrites tests/golden.json from the current code. Run it after an intentional change, on its own:
//   vp run golden
// It is not part of `vp test` (see tests/update-golden.config.ts): inside the full suite it would rewrite golden.json
// while tests/optimize.test.ts reads it in a parallel worker.
test("write tests/golden.json", () => {
  const out: Record<string, GoldenValues> = {};
  for (const c of goldenCases) out[c.name] = c.run();
  fs.writeFileSync(new URL("./golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
});
