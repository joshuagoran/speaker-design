// The claude.ai artifact host injects `window.claude`; it is absent when the page runs on its own (GitHub Pages, dev).
// Only what the app uses is declared: `use("db")`, which resolves to the artifact's database handle (or nothing).
// The handle's shape is left open here and narrowed where it is read, in useConfigStore.
interface Window {
  claude?: {
    use?: (capability: string) => Promise<unknown>;
  };
}
