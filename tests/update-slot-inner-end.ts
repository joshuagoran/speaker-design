import { test } from "vite-plus/test";
import fs from "node:fs";
import { SLOT_INNER_END } from "../src/data/acoustics/slot-inner-end";
import { solveGroups } from "./slot-flow";

// Rewrites src/data/acoustics/slot-inner-end.ts from the potential-flow solver (tests/slot-flow.ts), on the table's own
// axes, one worker per core (tests/slot-flow-worker.mjs), each box's shelf thicknesses in turn on one grid. Run it on
// its own after a change to the solver or the axes (about half a minute on four cores):
//   vp run slot-inner-end
test("write src/data/acoustics/slot-inner-end.ts", { timeout: 3600_000 }, async () => {
  const { gap, span, wall, run } = SLOT_INNER_END;
  const groups = gap.flatMap((u) =>
    span.flatMap((v) =>
      run.map((r) => wall.map((w) => ({ t: w, span: 1 / v, gap: 1 / u, run: r }))),
    ),
  );
  const solved = await solveGroups(groups);
  // back in the table's order, [gap][span][wall][run]
  const ec = (a: number, b: number, c: number, d: number) =>
    solved[(a * span.length + b) * run.length + d][c].ec;
  const rows = gap.map((_, a) =>
    span.map((_, b) => wall.map((_, c) => run.map((_, d) => ec(a, b, c, d).toFixed(3)))),
  );
  const file = new URL("../src/data/acoustics/slot-inner-end.ts", import.meta.url);
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("  ecOverH: [");
  const end = src.indexOf("\n  ],\n", start) + "\n  ],\n".length;
  const body =
    "  ecOverH: [\n" +
    rows
      .map(
        (r) =>
          "    [\n" +
          r
            .map((c) => "      [" + c.map((d) => "[" + d.join(", ") + "]").join(", ") + "],\n")
            .join("") +
          "    ],\n",
      )
      .join("") +
    "  ],\n";
  fs.writeFileSync(file, src.slice(0, start) + body + src.slice(end));
});
