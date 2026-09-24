#!/bin/sh
# Build the stack planner into a single self-contained page.
set -e
cd "$(dirname "$0")"
npx esbuild stack-planner.app.jsx --loader:.jsx=jsx --jsx=transform --outfile=../dist/app.js
mkdir -p ../dist
{ cat stack-planner.head.html; cat ../dist/app.js; echo "</script>"; } > ../dist/stack-planner.html
echo "built ../dist/stack-planner.html"
