#!/bin/sh
# Gate for the TypeScript migration: build the artifact page from this tree and from a ref (origin/main by default), and
# check that the two dist/stack-planner.html files are byte-identical. Renames and type annotations don't change the
# emitted JS or CSS, so any difference means runtime code (or the CSS) changed.
#   build/compare-main.sh          -> compare against origin/main (fetched first; local main if the fetch fails)
#   build/compare-main.sh <ref>    -> compare against another ref
# The other ref is checked out into a temporary git worktree (COMPARE_MAIN_DIR, default $TMPDIR/speaker-design-compare-main,
# removed again at the end) that borrows this tree's node_modules through a symlink, so nothing is installed.
# Exit 0 and "identical" when the pages match; otherwise exit 1 with the first differing byte offset.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
VP=node_modules/.bin/vp
[ -x "$VP" ] || { echo "compare-main.sh: Vite+ not installed; run vp install (or pnpm install)" >&2; exit 1; }
WT=${COMPARE_MAIN_DIR:-${TMPDIR:-/tmp}/speaker-design-compare-main}

build() { # build the artifact page of the tree in the current directory
  "$ROOT/$VP" build --mode artifact --outDir dist/build-artifact --emptyOutDir --logLevel warn
  node build/inline.mjs dist/build-artifact dist/stack-planner.html
}

cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
  git -C "$ROOT" worktree prune
}

echo "building this tree"
build

if [ -n "$1" ]; then
  REF=$1
elif git fetch --quiet origin main; then
  REF=origin/main
else
  echo "compare-main.sh: fetch failed; comparing against local main" >&2
  REF=main
fi

cleanup
rm -rf "$WT"
trap cleanup EXIT
git worktree add --detach --force "$WT" "$REF" >/dev/null
ln -s "$ROOT/node_modules" "$WT/node_modules"

echo "building $REF"
(cd "$WT" && build)

if cmp "$ROOT/dist/stack-planner.html" "$WT/dist/stack-planner.html"; then
  echo "identical"
else
  echo "differ: first differing byte is shown above (this tree: dist/stack-planner.html, $REF: $WT/dist/stack-planner.html)." >&2
  echo "hint: a diff means runtime code or CSS changed (or an import/asset path changed); rebuild both and diff the pages to see where." >&2
  exit 1
fi
