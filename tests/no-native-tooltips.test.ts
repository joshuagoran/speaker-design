import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

// One kind of tooltip: every tip shows in the shared `Tooltip` (src/components/ui), never in the browser's own tooltip.
// This test fails on a `title` attribute on a plain element (`<button title=…>`, `<span title=…>`) in `src`. An SVG's
// `<title>` element is no attribute, so it stays; a component's own `title` prop (a fold's heading) is no attribute either.
// `Button` and `ToggleButton` take no `title` (their types leave it out); they take `tip`.

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesIn(join(dir, e.name))
      : e.name.endsWith(".tsx")
        ? [join(dir, e.name)]
        : [],
  );

/** The index just past the string, or the balanced `{...}`, that starts at `start`. */
const endOf = (text: string, start: number) => {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === '"' || c === "'" || c === "`") {
      const end = text.indexOf(c, i + 1);
      if (end < 0) break;
      i = end;
      if (depth === 0) return i + 1; // a bare string value
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  return text.length;
};

/** Whether the opening tag that starts at `from` (just after `<tag`) has a `title=` among its own attributes. */
const hasTitle = (src: string, from: number) => {
  for (let i = from; i < src.length; i++) {
    const c = src.charAt(i);
    if (c === '"' || c === "'" || c === "`" || c === "{") i = endOf(src, i) - 1;
    else if (c === ">" && src.charAt(i - 1) !== "=") return false;
    else if (src.startsWith("title=", i) && /\s/.test(src.charAt(i - 1))) return true;
  }
  return false;
};

/** Each plain element (a lowercase tag) given a `title` attribute in `src`, as "tag line". */
const nativeTitles = (src: string) =>
  [...src.matchAll(/<([a-z][\w-]*)(?=[\s/>])/g)].flatMap((m) =>
    hasTitle(src, m.index + m[0].length)
      ? [`${m[1] ?? ""} ${src.slice(0, m.index).split("\n").length}`]
      : [],
  );

test("the check finds a title attribute on a plain element and nothing else", () => {
  expect(nativeTitles('<button title="Lock">x</button>')).toEqual(["button 1"]);
  expect(nativeTitles("<div>\n  <span title={tip} />\n</div>")).toEqual(["span 2"]);
  // an arrow function in an attribute does not end the tag early
  expect(nativeTitles('<button onClick={() => go()} title="Lock" />')).toEqual(["button 1"]);
  // none: an SVG's title element, a component's title prop, the shared tip
  expect(nativeTitles("<svg><title>Map</title></svg>")).toEqual([]);
  expect(nativeTitles('<FoldBox title="Vent" />')).toEqual([]);
  expect(nativeTitles('<Button tip="Lock">x</Button>')).toEqual([]);
  expect(nativeTitles('<div label={<FoldBox title="Vent" />} />')).toEqual([]);
});

test("no native tooltip: no plain element in src takes a title attribute", () => {
  const found = filesIn("src").flatMap((file) =>
    nativeTitles(readFileSync(file, "utf8")).map((t) => `${file} ${t}`),
  );
  expect(found).toEqual([]);
});
