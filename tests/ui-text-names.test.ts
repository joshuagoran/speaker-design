import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

// UI text never names a page that may go away, or an internal rule or engine (CLAUDE.md, "UI rules").
const BANNED =
  /\b(PA|Hi-?fi|Coverage|Fills?)( Coverage)? (page|tab|planner)\b|\bthe (horn engine|bracing rule|port rule|slot rule|brace estimate)\b|\bHornresp\b/i;

/** Source folders whose strings the user reads and that stay when the old pages go. */
const FOLDERS = [
  "src/constants",
  "src/components",
  "src/pages/speaker",
  "src/pages/stack",
  "src/pages/space",
  "src/pages/cutlist",
  "src/pages/notes",
  "src/lib/optimizer",
  "src/lib/speaker",
];

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesIn(join(dir, e.name))
      : /\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

/** A file without its comments, so only the strings and the JSX text stay. */
const withoutComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

test("UI text names no page that may go away and no internal rule or engine", () => {
  const hits = FOLDERS.flatMap(filesIn).flatMap((file) =>
    withoutComments(readFileSync(file, "utf8"))
      .split("\n")
      .filter((line) => BANNED.test(line))
      .map((line) => `${file}: ${line.trim().slice(0, 100)}`),
  );
  expect(hits).toEqual([]);
});
