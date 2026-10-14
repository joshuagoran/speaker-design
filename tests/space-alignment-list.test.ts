// The Space page's alignment list: one row per box and band, in a single column at every width. A long speaker or band
// name must not squeeze the filters, level and delay into a narrow column (one character a line), so the list uses no
// grid columns and no `min-w-0` squeeze, and each row's text is a plain block that wraps at word boundaries.
import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlignmentList } from "../src/pages/space/AlignmentList";
import type { AlignmentRow } from "../src/lib/speaker/spaceAlignment";

const LONG = "american power with a very long speaker name that has to wrap";

const row = (member: number, box: string, band: string): AlignmentRow => ({
  placement: 0,
  member,
  box,
  bands: [{ id: band.toLowerCase(), name: band }],
  highpass: { hz: 130, type: "LR24" },
  lowpass: null,
  levelDb: -3,
  delayMs: 0.5,
  crossoverDelayMs: 0,
});

test("the alignment list is rows in one column: no grid, no squeezed column, one row per box and band", () => {
  const rows = [row(0, LONG, "Low"), row(1, `${LONG} two`, "Mid"), row(1, `${LONG} two`, "High")];
  const html = renderToStaticMarkup(createElement(AlignmentList, { rows }));
  expect(html.match(/<li[ >]/g)).toHaveLength(rows.length);
  // every class in the markup: none makes columns, none lets a text box shrink below its words
  const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? "").split(/\s+/));
  expect(classes.filter((c) => /(^|:)(grid|inline-grid|flex|columns-|min-w-0)/.test(c))).toEqual(
    [],
  );
  expect(classes.filter((c) => /grid-cols|col-span|basis-/.test(c))).toEqual([]);
  // the name, then the filters, level and delay, whole
  expect(html).toContain(`${LONG}: Low`);
  expect(html).toContain("High-pass 130 Hz");
});
