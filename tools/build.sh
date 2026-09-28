#!/bin/sh
# Build the stack planner into a single self-contained page.
#   ./build.sh         -> ../dist/stack-planner.html (claude.ai artifact)
#   ./build.sh pages   -> ../dist/site/ (GitHub Pages, with Firebase saving)
set -e
cd "$(dirname "$0")"
npx --yes esbuild@0.28.2 stack-planner.app.jsx --bundle --format=iife --loader:.jsx=jsx --jsx=transform --outfile=../dist/app.js
# the page inlines app.js in a classic <script>: it must be one bundle with no module syntax
if grep -qE '^(import|export) ' ../dist/app.js || grep -q '</script' ../dist/app.js; then echo 'build.sh: dist/app.js is not a clean bundle' >&2; exit 1; fi
mkdir -p ../dist
{ cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"; } > ../dist/stack-planner.html
grep -q 'name="viewport"' ../dist/stack-planner.html || { echo 'build.sh: viewport meta missing' >&2; exit 1; }
echo "built ../dist/stack-planner.html"
if [ "$1" = "pages" ]; then
  mkdir -p ../dist/site
  {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    cat pages.head.html
    echo "<script>"; cat firebase-config.js; echo "</script>"
    cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"
  } > ../dist/site/index.html
  grep -q 'name="viewport"' ../dist/site/index.html || { echo 'build.sh: viewport meta missing' >&2; exit 1; }
  cp ../data/configs-seed.json ../dist/site/
  touch ../dist/site/.nojekyll
  echo "built ../dist/site/"
fi
