#!/bin/sh
# Build the planner into single self-contained pages: React, three.js, the compiled Tailwind CSS, the font and the
# optimizer worker are all bundled in (no CDN scripts).
#   tools/build.sh         -> dist/stack-planner.html (claude.ai artifact)
#   tools/build.sh pages   -> also dist/site/ (GitHub Pages; this build also bundles Firebase for saving)
set -e
cd "$(dirname "$0")/.."
VP=node_modules/.bin/vp
[ -x "$VP" ] || { echo "build.sh: Vite+ not installed; run vp install (or pnpm install)" >&2; exit 1; }
"$VP" build --mode artifact --outDir dist/build-artifact --emptyOutDir --logLevel warn
node tools/inline.mjs dist/build-artifact dist/stack-planner.html
if [ "$1" = "pages" ]; then
  "$VP" build --mode pages --outDir dist/build-pages --emptyOutDir --logLevel warn
  node tools/inline.mjs dist/build-pages dist/site/index.html
  cp data/configs-seed.json dist/site/
  touch dist/site/.nojekyll
fi
