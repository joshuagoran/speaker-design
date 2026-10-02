// Turns a `vp build` output directory into one self-contained HTML file: the single JS chunk and the stylesheet go
// inline (fonts and the optimizer worker are already inlined by the build). Usage: node build/inline.mjs <buildDir> <out.html>
import fs from "node:fs";
import path from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: node build/inline.mjs <buildDir> <out.html>");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const fail = (msg) => {
  console.error(`inline.mjs: ${msg}`);
  process.exit(1);
};
const read = (url) => fs.readFileSync(path.join(dir, url.replace(/^\.?\//, "")), "utf8");

const scripts = [...html.matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)];
const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)];
if (scripts.length !== 1) fail(`expected one module script, found ${scripts.length}`);
if (styles.length > 1) fail(`expected at most one stylesheet, found ${styles.length}`);

let js = read(scripts[0][1]);
// inside <script>, "</script" would end the element and "<!--" can switch the parser into its escaped states
if (js.includes("<!--"))
  fail("the bundle contains <!--, which is unsafe inside an inline <script>");
js = js.replace(/<\/script/gi, "<\\/script");
const css = styles.length ? read(styles[0][1]) : "";
if (/<\/style/i.test(css)) fail("the stylesheet contains </style");

// function replacements, so "$" sequences in the code are not treated as replacement patterns
html = html.replace(scripts[0][0], () => `<script type="module">${js}</script>`);
if (styles.length) html = html.replace(styles[0][0], () => `<style>${css}</style>`);

// nothing may load from outside the page any more
const external = html.match(/<(script|link)\b[^>]*\b(src|href)="(?!data:)[^"]*"/gi);
if (external) fail(`external resources remain: ${external.join(", ")}`);
if (!html.includes('name="viewport"')) fail("viewport meta missing");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
// chunks loaded on demand (the Pages build's Firebase) stay as files beside the page
const entry = path.normalize(scripts[0][1].replace(/^\.?\//, ""));
const extra = fs
  .readdirSync(dir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".js") && path.normalize(f) !== entry);
for (const f of extra) {
  fs.mkdirSync(path.dirname(path.join(path.dirname(out), f)), { recursive: true });
  fs.copyFileSync(path.join(dir, f), path.join(path.dirname(out), f));
}
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(
  `built ${out} (${kb(html.length)})` +
    (extra.length
      ? ` + on demand: ${extra.map((f) => `${f} (${kb(fs.statSync(path.join(dir, f)).size)})`).join(", ")}`
      : ""),
);
