import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

// Layouts own the spacing (CLAUDE.md, "UI rules"): a container spaces its children with one gap rule (`STACK` and the
// others in `src/styles/layout.ts`), so a shared control from `src/components/ui` carries no outer margin. This test
// fails when a page (or another component) passes one of those controls a margin class in its `className`.
//
// How it works, with no list to keep: the controls are every component exported from `src/components/ui`; every
// `<Control ...>` in `src/**/*.tsx` is found, the `className` among its own props is cut out, and each string in it is
// checked for a margin utility: `m-`, `mt-`, `mb-`, `my-`, `mx-`, `ml-`, `mr-`, with a sign or a variant (`-mt-1`,
// `md:mb-3`). The plain elements a control renders inside itself may keep margins (a label's gap to its field is part
// of the control); only a margin handed to a control from outside is the problem.

/** A margin utility in a class string: start of the string, a space or a variant colon, an optional sign, then `m`. */
const MARGIN = /(?:^|[\s:])-?m[tbyxlr]?-/;

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesIn(join(dir, e.name))
      : e.name.endsWith(".tsx")
        ? [join(dir, e.name)]
        : [],
  );

/** The names of the components a folder's `.tsx` files export: the shared controls. */
const controlsIn = (dir: string) =>
  filesIn(dir).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/^export (?:function|const) ([A-Z]\w*[a-z]\w*)/gm)].map(
      (m) => m[1] ?? "",
    ),
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

/**
 * The `className` among the props of the opening tag that starts at `from` (just after `<Name`): its string or `{...}`
 * expression, "" when it has none. Props of elements nested inside another prop (`label={<b className="x">`) don't count.
 */
const classNameOf = (src: string, from: number) => {
  for (let i = from; i < src.length; i++) {
    const c = src.charAt(i);
    if (c === '"' || c === "'" || c === "`" || c === "{") i = endOf(src, i) - 1;
    else if (c === ">" && src.charAt(i - 1) !== "=") return "";
    else if (src.startsWith("className=", i) && /\s/.test(src.charAt(i - 1))) {
      const start = i + "className=".length;
      return src.slice(start, endOf(src, start));
    }
  }
  return "";
};

/** The margin classes the shared controls `controls` are given in `src`, as "Name: class string". */
const controlMargins = (src: string, controls: readonly string[]) =>
  [...src.matchAll(/<([A-Z]\w*)(?=[\s/>])/g)].flatMap((m) => {
    const name = m[1] ?? "";
    if (!controls.includes(name)) return [];
    const cls = classNameOf(src, m.index + m[0].length);
    return [...cls.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)]
      .map((s) => s[1] ?? s[2] ?? s[3] ?? "")
      .filter((s) => MARGIN.test(s))
      .map((s) => `${name}: ${s}`);
  });

test("the check finds a margin on a control and nothing else", () => {
  const controls = ["ToggleGroup", "NumberField"];
  const found = (src: string) => controlMargins(src, controls);
  expect(found('<ToggleGroup className="mb-3" value={v} />')).toEqual(["ToggleGroup: mb-3"]);
  expect(
    found('<NumberField\n  label="a"\n  className={on ? "col-span-2 md:-mt-1" : ""}\n/>'),
  ).toEqual(["NumberField: col-span-2 md:-mt-1"]);
  // an arrow function in a prop does not end the tag early
  expect(found('<NumberField onChange={(v) => set(v)} className="mt-2" />')).toEqual([
    "NumberField: mt-2",
  ]);
  // none: a margin on a plain element, other classes (even ones that contain "m-"), a margin inside another prop
  expect(found('<div className="mb-3"><ToggleGroup className="col-span-2" /></div>')).toEqual([]);
  expect(found('<NumberField className="min-w-0 max-w-md" onChange={() => 1} />')).toEqual([]);
  expect(found('<ToggleGroup label={<b className="mb-1">x</b>} value={v} />')).toEqual([]);
});

test("shared controls carry no outer margin: a layout's gap rule spaces them", () => {
  const controls = controlsIn("src/components/ui");
  expect(controls.length).toBeGreaterThan(20);
  const found = filesIn("src").flatMap((file) =>
    controlMargins(readFileSync(file, "utf8"), controls).map((m) => `${file} ${m}`),
  );
  expect(found).toEqual([]);
});
