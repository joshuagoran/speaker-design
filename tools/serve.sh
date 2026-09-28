#!/bin/sh
# Local preview. Builds the planner, vendors the four CDN libraries next to it,
# rewrites the CDN URLs to local paths and serves on :8901.
#
# The published artifact loads these from cdnjs; only local preview needs copies,
# because the artifact sandbox and most offline setups will not reach a CDN.
set -e
cd "$(dirname "$0")/.."
mkdir -p dist/preview

fetch() {  # fetch <url> <dest>
  [ -s "$2" ] && return 0
  echo "fetching $(basename "$2")"
  curl -fsSL "$1" -o "$2" || { echo "could not fetch $1 — download it by hand to $2"; return 1; }
}

fetch https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js      dist/preview/react.js
fetch https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js dist/preview/react-dom.js
fetch https://cdnjs.cloudflare.com/ajax/libs/three.js/0.140.0/three.min.js                 dist/preview/three.js
# Tailwind's play CDN is a script that generates CSS at runtime; for preview a
# prebuilt stylesheet is enough. Any Tailwind 3 build works here.
[ -s dist/preview/tw.css ] || echo "note: put a Tailwind 3 stylesheet at dist/preview/tw.css (the page renders unstyled without it)"

tools/build.sh

sed -e 's|https://cdn.tailwindcss.com/3.4.16|tw.css|' \
    -e 's|https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js|react.js|' \
    -e 's|https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js|react-dom.js|' \
    -e 's|https://cdnjs.cloudflare.com/ajax/libs/three.js/0.140.0/three.min.js|three.js|' \
    dist/stack-planner.html > dist/preview/index.html
sed -i.bak 's|<script src="tw.css"></script>|<link rel="stylesheet" href="tw.css">|' dist/preview/index.html
rm -f dist/preview/index.html.bak

echo
echo "planner  http://127.0.0.1:8901/index.html"
cd dist/preview && exec python3 -m http.server 8901
