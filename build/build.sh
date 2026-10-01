#!/bin/sh
# Build the stack planner into a single self-contained page.
#   ./build.sh         -> ../dist/stack-planner.html (claude.ai artifact)
#   ./build.sh pages   -> ../dist/site/ (GitHub Pages, with Firebase saving)
set -e
cd "$(dirname "$0")"
npx --yes esbuild@0.28.2 ../src/app.jsx --bundle --format=iife --loader:.jsx=jsx --jsx=transform --outfile=../dist/app.js
# the page inlines app.js in a classic <script>: it must be one bundle with no module syntax
npx --yes esbuild@0.28.2 ../src/lib/pa/optimize.worker.js --bundle --format=iife --outfile=../dist/worker.js
# the page inlines both in <script> tags: each must be one bundle with no module syntax and no "</script"
for f in ../dist/app.js ../dist/worker.js; do
  if grep -qE '^(import|export) ' "$f" || grep -q '</script' "$f"; then echo "build.sh: $f is not a clean bundle" >&2; exit 1; fi
done
mkdir -p ../dist
# the worker goes in as text (type="text/plain"); the page starts it from a Blob URL when needed
worker() { echo '<script type="text/plain" id="opt-worker">'; cat ../dist/worker.js; echo "</script>"; }
{ cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"; worker; } > ../dist/stack-planner.html
grep -q 'name="viewport"' ../dist/stack-planner.html || { echo 'build.sh: viewport meta missing' >&2; exit 1; }
echo "built ../dist/stack-planner.html"
if [ "$1" = "pages" ]; then
  mkdir -p ../dist/site
  {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    cat pages.head.html
    echo "<script>"; cat firebase-config.js; echo "</script>"
    cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"; worker
  } > ../dist/site/index.html
  grep -q 'name="viewport"' ../dist/site/index.html || { echo 'build.sh: viewport meta missing' >&2; exit 1; }
  cp ../data/configs-seed.json ../dist/site/
  touch ../dist/site/.nojekyll
  echo "built ../dist/site/"
fi
