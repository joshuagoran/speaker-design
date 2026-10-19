// Lists the code in src/ that the app never uses: files nothing live imports, and top-level declarations (exported or
// not) that no live code refers to. Tests do not count as users. Live code starts at the page entry (src/main.tsx, from
// index.html), at the Node-loaded files that the build or CI runs (vite.config.ts, tailwind.config.js, and the phone
// and 3D checks), and at the data scripts listed in ROOTS. From there it follows names: a live declaration makes live what it names in its own file and the
// exports it imports. Worker imports (?worker&inline) and dynamic imports count.
//
// Run: node tools/dead-exports.mjs (vp run dead-exports). It exits 1 when it lists anything. With --fix it deletes the
// dead files and declarations (with their leading comments) and the imports only they used; check the result with
// vp check, since it reads the code by its layout (oxfmt's), not by a full parse.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
/**
 * The page entry, the files outside src/ that the build or CI loads, and the package.json scripts that write or audit
 * the shipped data (preset-levels, slot-inner-end, xmax-audit); all their code is live.
 */
const ROOTS = [
  "src/main.tsx",
  "vite.config.ts",
  "tailwind.config.js",
  "tests/mobile-check.mjs",
  "tests/three-memory-check.mjs",
  "tests/preset-levels.ts",
  "tests/update-slot-inner-end.ts",
  "tests/xmax-audit.ts",
].map((file) => path.join(ROOT, file));
const CODE_EXT = /\.(ts|tsx|js|mjs)$/;
const RESOLVE_EXT = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];
/** A line at column 0 that starts a top-level statement (formatted code: continuations start with a bracket or space). */
const STATEMENT_START = /^[A-Za-z_$]/;
const DECLARATION =
  /^(?:export\s+)?(?:declare\s+)?(default\s+)?(?:async\s+)?(?:const|let|var|function\*?|abstract\s+class|class|type|interface|enum|namespace)\s+([A-Za-z_$][\w$]*)/;
/** A name as code uses it: not a property after a dot (a spread's three dots still count). */
const IDENTIFIER = /(?:(?<=\.\.\.)|(?<![\w$.]))[A-Za-z_$][\w$]*/g;

/** Every code file under src/, as absolute paths. */
function listSource(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSource(full);
    return CODE_EXT.test(entry.name) && !entry.name.endsWith(".d.ts") ? [full] : [];
  });
}

/** Removes block comments and line comments (good enough to read names; strings are kept). */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");
}

/** The file a relative import names, or null for a package import. */
function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const bare = path.resolve(path.dirname(fromFile), specifier.replace(/\?.*$/, ""));
  if (CODE_EXT.test(bare) && fs.existsSync(bare)) return bare;
  for (const ext of RESOLVE_EXT) if (fs.existsSync(bare + ext)) return bare + ext;
  return null;
}

/** One import clause's bindings: { local, imported } with imported "default", a name, or "*" for a namespace. */
function clauseBindings(clause) {
  const bindings = [];
  const braces = clause.match(/\{([\s\S]*)\}/);
  const head = clause.replace(/\{[\s\S]*\}/, "").replace(/^\s*type\s+/, "");
  for (const part of head.split(",").map((p) => p.trim())) {
    if (!part) continue;
    const ns = part.match(/^\*\s+as\s+([\w$]+)/);
    bindings.push(ns ? { local: ns[1], imported: "*" } : { local: part, imported: "default" });
  }
  for (const part of braces ? braces[1].split(",") : []) {
    const [imported, local = imported] = part
      .trim()
      .replace(/^type\s+/, "")
      .split(/\s+as\s+/)
      .map((s) => s.trim());
    if (imported) bindings.push({ local, imported });
  }
  return bindings;
}

/**
 * Splits a file into top-level statements by its layout. Each one keeps its line range (with the comments right above
 * it), the names it declares, the names it exports, and its text without comments.
 */
function parse(file) {
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split("\n");
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!STATEMENT_START.test(lines[i])) continue;
    // take in the comment lines right above the statement
    let from = i;
    while (
      from > 0 &&
      /^\s*(\/\/|\/\*|\*)/.test(lines[from - 1]) &&
      !(starts.length && starts.at(-1).line >= from - 1)
    )
      from--;
    starts.push({ line: i, from });
  }
  const statements = starts.map((start, k) => {
    const to = k + 1 < starts.length ? starts[k + 1].from : lines.length;
    const text = stripComments(lines.slice(start.line, to).join("\n"));
    return {
      from: start.from,
      to,
      text,
      declares: [],
      exports: [],
      imports: null,
      reexports: null,
    };
  });
  for (const s of statements) {
    const decl = s.text.match(DECLARATION);
    const isExport = /^export\b/.test(s.text);
    if (/^import\b/.test(s.text)) {
      const m = s.text.match(/^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/);
      const bare = s.text.match(/^import\s+["']([^"']+)["']/);
      s.imports = m
        ? { specifier: m[2], bindings: clauseBindings(m[1]) }
        : { specifier: bare?.[1] ?? "", bindings: [] };
    } else if (/^export\s+(?:type\s+)?\{[^}]*\}\s*from\b/.test(s.text)) {
      const m = s.text.match(/^export\s+(?:type\s+)?\{([^}]*)\}\s*from\s+["']([^"']+)["']/);
      s.reexports = { specifier: m[2], bindings: clauseBindings(`{${m[1]}}`), star: false };
    } else if (/^export\s+\*/.test(s.text)) {
      const m = s.text.match(/from\s+["']([^"']+)["']/);
      s.reexports = { specifier: m[1], bindings: [], star: true };
    } else if (/^export\s+(?:type\s+)?\{/.test(s.text)) {
      // a local export list: each exported name points at a local declaration
      const m = s.text.match(/^export\s+(?:type\s+)?\{([^}]*)\}/);
      s.aliases = clauseBindings(`{${m[1]}}`).map(({ local, imported }) => ({
        exported: local,
        local: imported,
      }));
    } else if (decl) {
      const isDestructure = /^(?:export\s+)?(?:const|let|var)\s+[{[]/.test(s.text);
      if (isDestructure) {
        const names =
          s.text.match(/^(?:export\s+)?(?:const|let|var)\s+[{[]([^}\]]*)[}\]]/)?.[1] ?? "";
        s.declares = names
          .split(",")
          .map((n) => n.split(":").pop().trim())
          .filter(Boolean);
      } else s.declares = [decl[2]];
      if (isExport) s.exports = decl[1] ? ["default"] : s.declares;
    } else if (/^export\s+default\b/.test(s.text)) {
      s.exports = ["default"];
    }
  }
  // the names each statement refers to
  for (const s of statements) {
    const body = s.declares.length ? s.text.replace(DECLARATION, " ") : s.text;
    s.refs = new Set(body.match(IDENTIFIER) ?? []);
  }
  return { file, raw, lines, statements };
}

const files = listSource(SRC);
/** @type {Map<string, ReturnType<typeof parse>>} */
const parsed = new Map();
/** Each statement's file. */
const fileOf = new Map();
const get = (file) => {
  if (!parsed.has(file)) {
    const result = parse(file);
    parsed.set(file, result);
    for (const s of result.statements) fileOf.set(s, file);
  }
  return /** @type {ReturnType<typeof parse>} */ (parsed.get(file));
};

// the worklist: live statements, and live (file, export name) pairs
const liveStatements = new Set();
const liveExports = new Set();
const reachable = new Set();
const queue = [];
const markStatement = (s) => {
  if (liveStatements.has(s)) return;
  liveStatements.add(s);
  queue.push({ statement: s });
};
const exportKey = (file, name) => `${file}\0${name}`;
const markExport = (file, name) => {
  const key = exportKey(file, name);
  if (liveExports.has(key)) return;
  liveExports.add(key);
  queue.push({ file, name });
};
const markFile = (file) => {
  if (reachable.has(file)) return;
  reachable.add(file);
  const { statements } = get(file);
  for (const s of statements) {
    // statements that run on load: anything not a declaration, import, or export of names
    const declaresOnly =
      s.declares.length || s.imports || s.reexports || s.aliases || s.exports.length;
    if (!declaresOnly || ROOTS.includes(file)) markStatement(s);
  }
};
for (const file of [...files, ...ROOTS]) get(file);

for (const file of ROOTS) markFile(file);
while (queue.length) {
  const item = /** @type {{ statement?: any, file?: string, name?: string }} */ (queue.pop());
  if (item.statement) {
    const s = item.statement;
    const file = fileOf.get(s);
    const { statements } = get(file);
    if (s.imports) {
      const target = resolveImport(file, s.imports.specifier);
      if (target && !s.imports.bindings.length) markFile(target);
    }
    // a dynamic import loads the whole module
    for (const m of s.text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
      const target = resolveImport(file, m[1]);
      if (!target) continue;
      markFile(target);
      for (const t of get(target).statements) t.exports.forEach((n) => markExport(target, n));
    }
    // imports and export lists pass on only the names that are live, below
    const passesNames = !s.imports && !s.reexports && !s.aliases;
    for (const other of passesNames ? statements : []) {
      if (other === s) continue;
      if (other.declares.some((n) => s.refs.has(n))) markStatement(other);
      // an import binding this statement names makes the imported export live
      if (other.imports) {
        const target = resolveImport(file, other.imports.specifier);
        if (!target) continue;
        for (const b of other.imports.bindings) {
          if (!s.refs.has(b.local)) continue;
          markStatement(other);
          markFile(target);
          if (b.imported === "*")
            for (const t of get(target).statements) t.exports.forEach((n) => markExport(target, n));
          else markExport(target, b.imported);
        }
      }
    }
  } else {
    const { file, name } = item;
    markFile(file);
    for (const s of get(file).statements) {
      if (s.exports.includes(name)) markStatement(s);
      for (const alias of s.aliases ?? []) {
        if (alias.exported !== name) continue;
        markStatement(s);
        for (const t of get(file).statements)
          if (t.declares.includes(alias.local)) markStatement(t);
        // an exported import (import { a } ...; export { a })
        for (const t of get(file).statements)
          for (const b of t.imports?.bindings ?? [])
            if (b.local === alias.local) {
              const target = resolveImport(file, t.imports.specifier);
              if (!target) continue;
              markStatement(t);
              markFile(target);
              markExport(target, b.imported);
            }
      }
      if (!s.reexports) continue;
      const target = resolveImport(file, s.reexports.specifier);
      if (!target) continue;
      const hit = s.reexports.star
        ? !get(file).statements.some((t) => t.exports.includes(name))
        : s.reexports.bindings.some((b) => b.local === name);
      if (!hit) continue;
      markStatement(s);
      const original = s.reexports.star
        ? name
        : s.reexports.bindings.find((b) => b.local === name).imported;
      markExport(target, original);
    }
  }
}

const rel = (file) => path.relative(ROOT, file);
const deadFiles = files.filter((file) => !reachable.has(file));
/** Per live file: dead declarations, and export-list names nothing uses. */
const deadStatements = new Map();
const deadListNames = new Map();
for (const file of files) {
  if (!reachable.has(file)) continue;
  const { statements } = get(file);
  const dead = statements.filter(
    (s) => !liveStatements.has(s) && (s.declares.length || s.exports.length),
  );
  if (dead.length) deadStatements.set(file, dead);
  const names = statements.flatMap((s) =>
    listedNames(s).filter((n) => !liveExports.has(exportKey(file, n))),
  );
  if (names.length) deadListNames.set(file, names);
}

/** The names an export list (local, or from another file) exports. */
function listedNames(s) {
  if (s.aliases) return s.aliases.map((a) => a.exported);
  if (s.reexports && !s.reexports.star) return s.reexports.bindings.map((b) => b.local);
  return [];
}

if (process.argv.includes("--fix")) {
  for (const file of deadFiles) fs.rmSync(file);
  for (const file of new Set([...deadStatements.keys(), ...deadListNames.keys()])) {
    const { lines, statements } = get(file);
    const drop = new Set(deadStatements.get(file) ?? []);
    const live = (name) => liveExports.has(exportKey(file, name));
    /** Each kept statement's text and the names it refers to; imports are trimmed last. */
    const kept = statements
      .filter((s) => !drop.has(s))
      .map((s) => {
        const text = lines.slice(s.from, s.to).join("\n");
        if (s.aliases && s.aliases.some((a) => !live(a.exported))) {
          const names = s.aliases.filter((a) => live(a.exported));
          const list = names.map((a) =>
            a.local === a.exported ? a.local : `${a.local} as ${a.exported}`,
          );
          const refs = new Set(names.map((a) => a.local));
          return { s, text: names.length ? rewriteList(text, list, "") : null, refs };
        }
        if (s.reexports && !s.reexports.star && s.reexports.bindings.some((b) => !live(b.local))) {
          const names = s.reexports.bindings.filter((b) => live(b.local));
          const list = names.map((b) =>
            b.local === b.imported ? b.local : `${b.imported} as ${b.local}`,
          );
          const from = ` from "${s.reexports.specifier}"`;
          return { s, text: names.length ? rewriteList(text, list, from) : null, refs: new Set() };
        }
        return { s, text, refs: s.refs };
      })
      .filter((k) => k.text !== null);
    const out = kept.map(({ s, text }) => {
      if (!s.imports || !s.imports.bindings.length) return text;
      // keep imports only for the bindings kept code names
      const used = s.imports.bindings.filter((b) =>
        kept.some((k) => k.s !== s && !k.s.imports && k.refs.has(b.local)),
      );
      if (!used.length) return null;
      return used.length < s.imports.bindings.length ? rewriteImport(text, used) : text;
    });
    const head = lines.slice(0, statements[0]?.from ?? lines.length).join("\n");
    const body = out.filter((text) => text !== null);
    fs.writeFileSync(file, [head, ...body].filter((part, i) => i > 0 || part).join("\n"));
  }
}

/** An export list statement with only the kept names (`from` is the re-export's source, or empty). */
function rewriteList(text, names, from) {
  const m = text.match(/^([\s\S]*?)export\s+(type\s+)?\{[^}]*\}[^;\n]*;?([\s\S]*)$/);
  if (!m) return text;
  return `${m[1]}export ${m[2] ?? ""}{ ${names.join(", ")} }${from};${m[3]}`;
}

/** One import statement with only the kept bindings (named ones in braces). */
function rewriteImport(text, kept) {
  const m = text.match(
    /^([\s\S]*?)import\s+(type\s+)?([\s\S]*?)\s+from\s+(["'][^"']+["'];?)([\s\S]*)$/,
  );
  if (!m) return text;
  const [, lead, typeWord = "", , from, rest] = m;
  const def = kept.find((b) => b.imported === "default");
  const ns = kept.find((b) => b.imported === "*");
  const named = kept
    .filter((b) => b.imported !== "default" && b.imported !== "*")
    .map((b) => {
      const typed = new RegExp(`\\btype\\s+${b.imported.replace(/\$/g, "\\$")}\\b`).test(text)
        ? "type "
        : "";
      return typed + (b.local === b.imported ? b.local : `${b.imported} as ${b.local}`);
    });
  const parts = [
    def?.local,
    ns && `* as ${ns.local}`,
    named.length ? `{ ${named.join(", ")} }` : null,
  ].filter(Boolean);
  return `${lead}import ${typeWord}${parts.join(", ")} from ${from}${rest}`;
}

const rows = [
  ...deadFiles.map((file) => `${rel(file)} (whole file)`),
  ...[...deadStatements].flatMap(([file, dead]) =>
    dead.map((s) => {
      const names = (s.exports.length ? s.exports : s.declares).join(", ");
      return `${rel(file)}: ${names}${s.exports.length ? "" : " (not exported)"}`;
    }),
  ),
  ...[...deadListNames].flatMap(([file, names]) =>
    names.map((n) => `${rel(file)}: ${n} (export list)`),
  ),
];
if (rows.length) {
  const fixed = process.argv.includes("--fix");
  const count = `${deadFiles.length} files, ${rows.length - deadFiles.length} declarations`;
  console.log(`Dead code${fixed ? " deleted" : ""} (${count}):`);
  for (const row of rows.sort((a, b) => a.localeCompare(b))) console.log(`  ${row}`);
  process.exit(fixed ? 0 : 1);
}
console.log("No dead code found.");
