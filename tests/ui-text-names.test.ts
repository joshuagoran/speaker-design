import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

// UI text never names a page that may go away, or an internal rule or engine (CLAUDE.md, "UI rules"). Hornresp may be
// named: it is the program whose records the horn import reads (owner approved, Oct 2026).
const BANNED =
  /\b(PA|Hi-?fi|Coverage|Fills?)( Coverage)? (page|tab|planner)\b|\bthe (horn engine|bracing rule|port rule|slot rule|brace estimate)\b/i;

// ...nor a design by its internal name: the PA sub, the PA boxes, a hi-fi speaker. Strings only (code and paths keep
// them), in the Speaker page's text. Elsewhere those names label pages and starts that exist.
// (an id such as "hifi" is no text: only the hyphenated word is)
const BANNED_NAMES = /\bPA (sub|boxes?)\b|\bhi-fi\b/i;
// ...nor an app item in lower case: Speaker, Stack, Space, and Source start with a capital when they mean the design item
// (CLAUDE.md, Writing). Only these phrases, which almost always mean the item; the plain words stay allowed (a speaker
// on a stand, the space of a room).
const LOWER_CASE_ITEMS =
  /\b([Aa] speaker(?! (on|in|of)\b)|[Tt]his stack|[Yy]our stack|[Tt]he space(?! (of|between|behind|around|under|above|below)\b)|[Aa]dd (speaker|source)|[Tt]his source)\b/;
/** Strings with a lower-case item that wait for the owner's review (issue #173): each is a whole string literal's text. */
const PENDING_REVIEW = new Set([
  "A box's speaker is missing from this stack, so the response leaves it out.",
  "A locked part stays as it is. Lock a speaker to hold it whole. A locked crossover, level or delay stays as it is. Size: free, up to this size (≤) or exactly this size (=).",
  "The settings for each box and band, at the level and delay the space asks of it.",
]);
/** The start of a pending string the check cannot match whole (it holds a name). */
const PENDING_REVIEW_START = ["The space finds each speaker's limit from it."];

const STRING_LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

const SPEAKER_TEXT_FILES = ["src/constants/speakerPage.ts"];
const SPEAKER_TEXT_FOLDERS = ["src/pages/speaker", "src/lib/speaker"];

/** Source folders whose strings the user reads and that stay when the old pages go. */
const FOLDERS = [
  "src/constants",
  "src/components",
  "src/pages/speaker",
  "src/pages/stack",
  "src/pages/space",
  "src/pages/cutlist",
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

/** The lines of a file's strings (its comments and import paths left out) that name a design by its internal name. */
const namedDesigns = (src: string) =>
  withoutComments(src)
    .split("\n")
    .filter((line) => !/\bfrom\s+["']/.test(line))
    .filter((line) => (line.match(STRING_LITERAL) ?? []).some((s) => BANNED_NAMES.test(s)));

test("UI text names no page that may go away and no internal rule or engine", () => {
  const hits = FOLDERS.flatMap(filesIn).flatMap((file) =>
    withoutComments(readFileSync(file, "utf8"))
      .split("\n")
      .filter((line) => BANNED.test(line))
      .map((line) => `${file}: ${line.trim().slice(0, 100)}`),
  );
  expect(hits).toEqual([]);
});

test("UI text names no design by its internal name (the PA sub, the PA boxes, a hi-fi speaker)", () => {
  const files = [...SPEAKER_TEXT_FILES, ...SPEAKER_TEXT_FOLDERS.flatMap(filesIn)];
  const hits = files.flatMap((file) =>
    namedDesigns(readFileSync(file, "utf8")).map((line) => `${file}: ${line.trim().slice(0, 100)}`),
  );
  expect(hits).toEqual([]);
});

test("UI text names a Speaker, Stack, Space, or Source with a capital", () => {
  const hits = FOLDERS.flatMap(filesIn).flatMap((file) =>
    (withoutComments(readFileSync(file, "utf8")).match(STRING_LITERAL) ?? [])
      .map((literal) => literal.slice(1, -1))
      .filter((text) => LOWER_CASE_ITEMS.test(text))
      .filter(
        (text) =>
          !PENDING_REVIEW.has(text) &&
          !PENDING_REVIEW_START.some((start) => text.startsWith(start)),
      )
      .map((text) => `${file}: ${text.slice(0, 100)}`),
  );
  expect(hits).toEqual([]);
});
