import { test } from "vite-plus/test";
import fs from "node:fs";
import os from "node:os";
import { Worker } from "node:worker_threads";
import { SLOT_INNER_END } from "../src/data/acoustics/slot-inner-end";

// Rewrites src/data/acoustics/slot-inner-end.ts from the potential-flow solver (tests/slot-flow.ts), on the table's own
// axes, one worker per core (tests/slot-flow-worker.mjs). Run it on its own after a change to the solver or the axes
// (an hour or so on four cores):
//   vp run slot-inner-end
test("write src/data/acoustics/slot-inner-end.ts", { timeout: 8 * 3600_000 }, async () => {
  const { gap, span, wall, run } = SLOT_INNER_END;
  const points = gap.flatMap((u) =>
    span.flatMap((v) =>
      wall.flatMap((w) => run.map((r) => ({ t: w, span: 1 / v, gap: 1 / u, run: r }))),
    ),
  );
  const ec: number[] = [];
  // the largest grids first, so no worker is left with one at the end
  const order = points
    .map((p, i) => ({ i, cells: (p.gap + p.run) * p.span }))
    .sort((a, b) => b.cells - a.cells)
    .map((p) => p.i);
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(os.availableParallelism(), points.length) },
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(new URL("./slot-flow-worker.mjs", import.meta.url));
          const send = () => {
            if (next < order.length) {
              const i = order[next++];
              worker.postMessage({ i, point: points[i] });
            } else void worker.terminate().then(() => resolve());
          };
          worker.on("message", (m: { i: number; ec: number }) => {
            ec[m.i] = m.ec;
            send();
          });
          worker.on("error", reject);
          send();
        }),
    ),
  );
  let k = 0;
  const rows = gap.map(() => span.map(() => wall.map(() => run.map(() => ec[k++].toFixed(3)))));
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
