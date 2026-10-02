# Plan: convert to strict TypeScript

Goal: every file in `src/` and `tests/` is TypeScript under `strict` + `noUncheckedIndexedAccess`, with no change to
what the page does or how it is built.

Starting point: about 15k lines in `src/` (34 `.js`, 56 `.jsx`); `src/lib/data.js` alone is 3.7k lines of driver tables.
There is no `tsconfig.json` yet. `vite.config.ts` already has lint `typeCheck: true`, so `vp check` type-checks `.ts`
files through tsgo (TS 7) and fails on errors. The baseline is clean (0 errors, 74 warnings).

## How the move stays incremental

- `allowJs` without `checkJs`: files that are still `.js` aren't type-checked, so `strict` and
  `noUncheckedIndexedAccess` are on from day one and apply to each file as it becomes `.ts`. A file is converted and
  made strict in one go, never touched twice.
- Bottom-up order: a file's imports are already typed when it is converted.

## Rules for every PR

- Gate: `vp check`, `vp test`, `vp run build` and `tests/mobile-check.mjs` pass, **and** `dist/stack-planner.html` is
  byte-identical to the build from `main` (`cmp`). Renames and type annotations shouldn't change the emitted JS or
  CSS, so any diff means the runtime code changed and needs a look. The golden test alone isn't enough: it compares
  about 780 rounded numbers within a tolerance and doesn't cover the optimizers, Hi-fi, chips, dispersion or the UI.
- Rename and edit in separate commits: first a `git mv` commit (with `--no-verify`, since the pre-commit
  `vp check --fix` rejects a bare rename that doesn't type-check yet), then the typing commit. That way git keeps the
  rename, even for heavily edited files like `StackView3D` and `HifiPage`. Merge PRs with merge commits, not squash.
- No `any`, no `as` and no `@ts-ignore`, except at the data and three.js boundaries, each with a comment saying why.
- Never `satisfies` on the data tables. Annotate them instead (`export const SUB_OPTIONS: readonly SubDriver[] = [...]`):
  `satisfies` keeps the inferred union of literal shapes, which gives errors such as `domeIn` missing on the union.

## Phase 0: setup (1 PR)

- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `allowJs`, `jsx: "react-jsx"`,
  `moduleResolution: "bundler"`, `types: ["vite-plus/client"]`. Use `vite-plus/client` here, not `vite/client`: `vite`
  is a catalog alias that isn't hoisted, so `vite/client` doesn't resolve.
- Dev dependencies: `@types/react` and `@types/react-dom` 19.3.0, and `@types/three` 0.140.0 (three 0.140 ships no
  types of its own). Firebase ships its own types.
- `src/env.d.ts`: declare `window.claude` only. The Vite client types already cover the `?worker&inline` import.
- `tailwind.config.js`: change `content` to `./src/**/*.{js,jsx,ts,tsx}`. Without this, Tailwind drops the classes
  used in `.tsx` files without any error. One renamed page lost 12 classes while build, check and tests all passed.
- `vite.config.ts`: change the test include to `tests/**/*.test.{js,ts}`.
- `tests/make-golden.js`: run it through vitest instead (for example an `UPDATE_GOLDEN=1` env flag in
  `golden.test.js`). As a plain `node` script it fails once `data.js` becomes `.ts`, because Node's type stripping
  doesn't resolve a `.js` import to a `.ts` file.
- Add a script or CI step that builds `main` and `cmp`s the two `stack-planner.html` files (see the gate above).

## Phase 1: data model (1 PR)

- `src/types.ts`: driver kinds (sub, mid, compression driver, fill, Hi-fi woofer, tweeter, passive radiator), horn,
  rack, cabinet, format, design config. Specs that can be missing are optional (`?`), so no driver is dropped for
  lacking one (per `CLAUDE.md`).
- `lib/data.js` → `.ts` with annotated tables.
- Leaf modules: `constants/*`, `lib/format`, `lib/storage`, `ui/buttonStyles`, `pages/hifi/hifiDriverLists`.
- `styles/palette.js` stays `.js` for now: `tailwind.config.js` loads it outside Vite. Convert it in Phase 6, or keep
  it plain `.js` and give it a `.d.ts` file if Tailwind can't load `.ts`.

## Phase 2: calculations (2 PRs)

1. `lib/pa/*`: `calc`, `chips`, `dispersion`, `optimize`, `optimize.worker`, `runOptimizer`. Give the worker's messages
   a typed union, and give `self` an explicit type in the worker (under the DOM lib it's typed as `Window`).
   `pa/optimize` has about 107 index accesses that `noUncheckedIndexedAccess` will flag.
2. `lib/hifi/*` and `components/stack-view/geometry`.

## Phase 3: hooks and state (2 PRs)

1. `hooks/useElementWidth`, `components/saved-configs/{firebaseConfig,firebaseStore,useConfigStore}`,
   `pages/hifi/useHifiPlanner`.
2. All of `pages/pa-stack/hooks/*`: `useCabinetStyle`, `useCrossovers`, `useCutlistOptions`, `useHornDesign`,
   `useMidDesign`, `usePaDesign`, `usePaPlanner`, `usePhoneLayout`, `useSavedConfigs`, `useStackViewOptions`,
   `useSubwooferDesign`, and `usePaOptimizer`, which becomes `.tsx` because it contains JSX.

## Phase 4: components `.jsx` → `.tsx` (4 PRs)

Each component gets a `Props` type (no `React.FC`). With React 19 types, `useRef(null)` needs an explicit type,
e.g. `useRef<HTMLDivElement>(null)`.

1. `ui/*`, `stats/*`, `lock/*`, `chips/*`
2. `charts/*`, `drawings/*`
3. `optimizer/*`, `saved-configs/SavedConfigs`
4. `stack-view/StackView3D` on its own (790 lines of three.js; riskiest, and the 0.140 types may have gaps)

## Phase 5: pages (5 PRs)

1. `pages/pa-stack/sections/*` and `PaStackPage`
2. `pages/hifi/*` (`HifiPage` is 1k lines)
3. `pages/fills`, `pages/cutlist`
4. `pages/notes`
5. `App`, `main` (and update `index.html` to point at `/src/main.tsx`)

## Phase 6: tests and cleanup (1–2 PRs)

- `tests/*.test.js`, `helpers.js`, `golden-configs.js` → `.ts`. `tests/mobile-check.mjs` and `build/*.mjs` stay plain
  Node scripts.
- `styles/palette.js` (see Phase 1).
- Remove `allowJs`, then confirm no `.js` or `.jsx` is left under `src/`.
- Lint: ban `any` and require a reason on `@ts-expect-error`.
- Update file paths in `CLAUDE.md` and `README.md`.

## Known risks

- `vp check` uses tsgo (TS 7), while an editor may run another TypeScript version and show different errors.
  Consider adding `typescript` as a dev dependency so the editor's version is pinned.
- Gaps in the three.js 0.140 types: work around them at the boundary with a commented cast. Don't upgrade three in
  this migration.
- Bundle size: types are stripped, so it shouldn't change. The byte-identical build gate checks this.
