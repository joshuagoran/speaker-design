#!/bin/sh
# Local preview: builds the planner and serves it on :8901. The page is self-contained (no CDN scripts), so it also
# works opened straight from disk.
set -e
cd "$(dirname "$0")/.."
build/build.sh pages
echo
echo "artifact page  http://127.0.0.1:8901/stack-planner.html"
echo "pages build    http://127.0.0.1:8901/site/"
cd dist && exec python3 -m http.server 8901
