import { test } from "vite-plus/test";
import fs from "node:fs";
import { straightSlotInnerEnd } from "./slot-flow";
import { SLOT_INNER_END } from "../src/data/acoustics/slot-inner-end";

// Rewrites src/data/acoustics/slot-inner-end.ts from the potential-flow solver (tests/slot-flow.ts), on the table's own
// axes. Run it on its own after a change to the solver or the axes (a few tens of minutes):
//   vp run slot-inner-end
test("write src/data/acoustics/slot-inner-end.ts", { timeout: 4 * 3600_000 }, () => {
  const { gap, span, wall, run } = SLOT_INNER_END;
  const rows = gap.map((u) =>
    span.map((v) =>
      wall.map((w) => straightSlotInnerEnd({ t: w, span: 1 / v, gap: 1 / u, run }).toFixed(3)),
    ),
  );
  const file = new URL("../src/data/acoustics/slot-inner-end.ts", import.meta.url);
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("  ecOverH: [");
  const end = src.indexOf("  ],\n", start) + "  ],\n".length;
  const body =
    "  ecOverH: [\n" +
    rows.map((r) => "    [" + r.map((c) => "[" + c.join(", ") + "]").join(", ") + "],\n").join("") +
    "  ],\n";
  fs.writeFileSync(file, src.slice(0, start) + body + src.slice(end));
});
