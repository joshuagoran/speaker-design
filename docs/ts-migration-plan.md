# Plan: convert to strict TypeScript

Goal: every file in `src/` and `tests/` is TypeScript under `strict`, with no change to what the page does or how it is
built. Three PRs, bottom-up: data and calculations, then hooks and components, then pages and cleanup.

Starting point: about 15k lines in `src/` (34 `.js`, 56 `.jsx`); `src/lib/data.js` alone is 3.7k lines of driver tables.
There is no `tsconfig.json` yet. `vp check` type-checks through tsgolint (TypeScript 7) and fails on errors; the baseline
is clean (0 errors, 74 warnings).

## What was checked before writing this

- Two builds of the same tree give a byte-identical `dist/stack-planner.html`, and adding the `tsconfig.json` below
  on its own leaves it byte-identical. So the gate below is sound.
- Every relative import in `src/` and `tests/` carries an explicit `.js` / `.jsx` extension (250 of them). Vite+
  resolves `./units.js` to `units.ts` even from a `.jsx` importer, and `vp test` still passes, so a bare `git mv`
  builds. The extensions are dropped in the rename commit (see below), so no specifier names a file that doesn't exist.
- `src/styles/palette.js` renamed to `.ts`, with the import in `tailwind.config.js` updated, builds byte-identical:
  Tailwind 3.4 loads its config through jiti, which handles the `.ts` import. So the palette goes first, not last.
- Renaming one `.jsx` to `.tsx` without widening Tailwind's `content` glob builds and passes every check, but the CSS
  silently shrinks (the file's classes are dropped). The gate catches it; the glob change is in PR 1.
- A bare rename of a `.js` to `.ts` fails `vp check` under `strict` at once, so rename commits need `--no-verify`.

## Rules

- **Gate, before each push:** `vp check`, `vp test`, `vp run build` and `node tests/mobile-check.mjs` pass, **and**
  both builds, the artifact page `dist/stack-planner.html` and the Pages page `dist/site/index.html`, are byte-identical (`cmp`) to the same builds of `main` (only the Pages build bundles Firebase). Renames and type annotations don't change
  the emitted JS or CSS, so any diff means runtime code changed and needs a look. The golden test alone isn't enough:
  it compares about 780 rounded numbers within a tolerance and doesn't cover the optimizers, Hi-fi, chips, dispersion
  or the UI. PR 1 adds `build/compare-main.sh` for this: it builds both pages of this tree, checks `origin/main` out into a temp worktree (or another ref, given as the first argument), builds both there, and `cmp`s each pair (prints `identical`, or exits 1 saying which page differs and the first differing byte).
- **Rename and edit in separate commits.** Per group of files: first a `git mv` commit with `--no-verify` (the pre-commit
  `vp check --fix` rejects a renamed file that doesn't type-check yet) that also drops the extension from the import
  specifiers that point at the renamed files (`./foo.js` → `./foo`, `./Bar.jsx` → `./Bar`), then the typing commit. Git
  keeps the rename even for heavily edited files like `StackView3D` and `HifiPage`. Merge the PRs with merge commits,
  not squash.
- **Imports carry no file extension.** Relative imports in `src/` and `tests/` are written `./foo`, never `./foo.ts`:
  Vite resolves them, and a `.ts` in a specifier is a Vite-only dialect (`allowImportingTsExtensions` is not set).
  Exceptions: the `?worker&inline` imports keep the file and its query (Vite needs the file for `?worker`), CSS imports
  keep theirs, and files loaded by Node (`tailwind.config.js`, `build/*.mjs`, `tests/mobile-check.mjs`,
  `vite.config.ts`) keep theirs too.
- **Type-only fixes.** Because of the gate, a type error is fixed with annotations, type narrowing that already exists
  in the code, or a non-null assertion; never with a new guard, a default (`?? 0`) or a restructured loop. If a type
  error reveals a real bug, note it and fix it in a separate PR after the migration.
- **Narrowest type, shared definition.** A parameter or prop is typed to exactly the fields the code reads, and that
  shape is derived from an existing type with `Pick`, `Omit`, `Partial` or an indexed access (`PaOptimizerResult["stats"]`),
  never written out again. A type used by more than one module lives in `src/types.ts`; React helper types that several
  hooks need (`Setter<T>`) live there too. Before declaring any interface, grep `src/types.ts` and the neighbouring
  modules for the same fields under another name; if it exists, import it. A full domain object (`SubDriver`,
  `HifiConfig`) is only the right type where the code passes the object on whole.
- **No `any`, no `@ts-ignore`.** `as` only as `as const`, or as a commented cast at a boundary: the driver tables,
  `JSON.parse` in `lib/storage`, the `window.claude` call in `useConfigStore`, three.js in `StackView3D`, and the
  worker's `self`.
- **Annotate the data tables, don't `satisfies` them** (`export const SUB_OPTIONS: readonly SubDriver[] = [...]`).
  `satisfies` keeps the inferred union of literal shapes, which gives errors such as `domeIn` missing on the union.
- **Not in this migration:** `noUncheckedIndexedAccess`. `pa/optimize` alone has about 120 index accesses, and under
  the gate every one would become a `!`, which is noise rather than safety. Turn it on afterwards as its own change,
  when runtime guards are allowed.

## PR 1: setup, data model, calculations, tests

Setup:

- `tsconfig.json`: `strict`, `noImplicitOverride`, `isolatedModules` (Vite transpiles one file at a time; without
  it, type re-exports and `const enum` pass the checker and break the build), `allowJs` (files still `.js` aren't
  checked, so `strict` applies to each file as it becomes `.ts`), `jsx: "react-jsx"`, `module` and `target`
  `"esnext"`, `moduleResolution: "bundler"`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `types: ["vite-plus/client"]`
  (`vite` is a catalog alias that isn't hoisted, so `vite/client` doesn't resolve), `noEmit`, `skipLibCheck`;
  `include: ["src", "tests", "vite.config.ts"]`. `tests/mobile-check.mjs`, `build/*.mjs` and `tailwind.config.js`
  stay plain Node scripts outside it.
- Dev dependencies: `@types/react` and `@types/react-dom` 19.3.0, `@types/three` 0.140.0 (three 0.140 ships no
  types), and `typescript` so an editor's checker matches the version `vp check` uses. Firebase ships its own types.
- `src/env.d.ts`: declare `window.claude` only. The Vite client types already cover the `?worker&inline` import.
- `tailwind.config.js`: `content` becomes `./src/**/*.{js,jsx,ts,tsx}`, and the palette import becomes
  `./src/styles/palette.ts`.
- `vite.config.ts`: the test include becomes `tests/**/*.test.{js,ts}`.
- `tests/make-golden.js` goes away; `golden.test.ts` rewrites `golden.json` when `UPDATE_GOLDEN=1` is set. As a plain
  `node` script it would fail once `data.js` is `.ts`, because Node's type stripping doesn't map a `.js` import to a
  `.ts` file.
- `build/compare-main.sh` (the gate).

Conversions, in this order (each group's imports are typed before it is converted):

1. `styles/palette`, `constants/*`, `lib/format`, `lib/storage`, `ui/buttonStyles`, `pages/hifi/hifiDriverLists`.
2. `src/types.ts`: driver kinds (sub, mid, compression driver, fill, Hi-fi woofer, tweeter, passive radiator), horn,
   rack, cabinet, format, design config. Specs that can be missing are optional (`?`), so no driver is dropped for
   lacking one (per `CLAUDE.md`). Then `lib/data` with annotated tables.
3. `lib/hifi/*` first (`lib/pa/dispersion` imports `lib/hifi/hifi`), then `lib/pa/*` and
   `components/stack-view/geometry`. The worker: type the request and response messages as a union, and type the
   handler's event as `MessageEvent<OptimizerRequest>`. Under the DOM lib `self` is a `Window`, whose `onmessage` and
   one-argument `postMessage` match what the worker does, so no WebWorker lib is needed; if that turns out not to
   type-check, one commented cast of `self` is the boundary.
4. `components/saved-configs/{firebaseConfig,firebaseStore,useConfigStore}`, `hooks/useElementWidth`.
5. `tests/*.test.js`, `helpers.js`, `golden-configs.js` → `.ts`. They import only `lib/*`, so they type-check here and
   exercise the new types straight away.

## PR 2: hooks and components (`.jsx` → `.tsx`)

Each component gets a `Props` type (no `React.FC`). With React 19 types, `useRef(null)` needs an explicit type,
e.g. `useRef<HTMLDivElement>(null)` (4 sites).

1. `ui/*`, `stats/*`, `optimizer/StatRow` (imported by `stats/StatTile` and `StatRowGrid`), `lock/*`, `chips/*`.
2. `charts/*`, `drawings/*`.
3. `pages/hifi/useHifiPlanner`; `pages/pa-stack/hooks/*`, including `usePaOptimizer`, which imports `lock/*` and so
   comes after step 1.
4. `optimizer/*`, `saved-configs/SavedConfigs`.
5. `stack-view/StackView3D` last: 790 lines of three.js, and the 0.140 types may have gaps. Work around a gap at the
   boundary with a commented cast; don't upgrade three in this migration.

## PR 3: pages and cleanup

1. `pages/pa-stack/sections/*`, `PaStackPage`.
2. `pages/hifi/*` (`HifiPage` is 1k lines), `pages/fills`, `pages/cutlist`, `pages/notes`.
3. `App`, `main`; `index.html` points at `/src/main.tsx`.
4. Remove `allowJs`; confirm no `.js` or `.jsx` is left under `src/` or `tests/`.
5. Lint: ban `any`; require a reason on `@ts-expect-error`.
6. Update file paths in `CLAUDE.md` and `README.md`.

## Known risks

- `vp check` runs tsgolint (TypeScript 7); the pinned `typescript` dev dependency keeps the editor on the same
  version, but the two can still differ on edge cases. `vp check` is the one that counts.
- Bundle size: types are stripped, so it shouldn't change. The byte-identical build gate checks this.
