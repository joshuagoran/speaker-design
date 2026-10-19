#!/bin/sh
# Build the app into single self-contained pages: React, three.js, the compiled Tailwind CSS, the font and the
# optimizer worker are all bundled in (no CDN scripts).
#   build/build.sh         -> dist/stack-planner.html (claude.ai artifact)
#   build/build.sh pages   -> also dist/site/ (GitHub Pages; this build also bundles Firebase for saving), with the
#                             same page again at dist/site/notes/index.html
set -e
cd "$(dirname "$0")/.."
VP=node_modules/.bin/vp
[ -x "$VP" ] || { echo "build.sh: Vite+ not installed; run vp install (or pnpm install)" >&2; exit 1; }
"$VP" build --mode artifact --outDir dist/build-artifact --emptyOutDir --logLevel warn
node build/inline.mjs dist/build-artifact dist/stack-planner.html
if [ "$1" = "pages" ]; then
  SPEAKNOW_SPLIT_FIREBASE=1 "$VP" build --mode pages --outDir dist/build-pages --emptyOutDir --logLevel warn
  # the same page also at /notes/ (the Notes page has no tab; the app opens it at that path)
  node build/inline.mjs dist/build-pages dist/site/index.html dist/site/notes/index.html
  cp data/configs-seed.json dist/site/
  cp data/configs-seed.json dist/site/notes/
  touch dist/site/.nojekyll
fi
