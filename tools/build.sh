#!/bin/sh
# Build the stack planner into a single self-contained page.
#   ./build.sh         -> ../dist/stack-planner.html (claude.ai artifact)
#   ./build.sh pages   -> ../dist/site/ (GitHub Pages, with Firebase saving)
set -e
cd "$(dirname "$0")"
npx --yes esbuild@0.28.2 stack-planner.app.jsx --loader:.jsx=jsx --jsx=transform --outfile=../dist/app.js
mkdir -p ../dist
{ cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"; } > ../dist/stack-planner.html
echo "built ../dist/stack-planner.html"
if [ "$1" = "pages" ]; then
  mkdir -p ../dist/site
  {
    cat pages.head.html
    echo "<script>"; cat firebase-config.js; echo "</script>"
    cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"
  } > ../dist/site/index.html
  cp ../data/configs-seed.json ../dist/site/
  touch ../dist/site/.nojekyll
  echo "built ../dist/site/"
fi
