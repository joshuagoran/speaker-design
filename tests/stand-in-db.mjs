// The artifact host's stand-in for the browser checks (tests/save-row-check.mjs, tests/stack-edit-check.mjs):
// `window.claude.use("db")`, a database held in the browser's storage. Nothing of it ships in the app.

/** The storage key the stand-in database keeps its documents under. */
export const DB_KEY = "saveRowCheck.db";

/**
 * The artifact host's stand-in, run in the page before its own code: `window.claude.use("db")` resolves to a database
 * with the calls the config store makes, its documents kept in local storage so a reload keeps them.
 */
export function installDb(key) {
  const read = () => JSON.parse(localStorage.getItem(key) || "{}");
  const listeners = new Set();
  const changed = () => listeners.forEach((l) => l());
  let made = 0;
  const collection = (name) => {
    const docsOf = () =>
      Object.entries(read()[name] || {})
        .map(([id, data]) => ({ id, data: () => data }))
        .sort((a, b) => b.data().savedAt - a.data().savedAt);
    const query = {
      orderBy: () => query,
      limit: () => query,
      onSnapshot: (next) => {
        const l = () => next({ docs: docsOf() });
        listeners.add(l);
        l();
        return () => listeners.delete(l);
      },
    };
    const write = (edit) => {
      const all = read();
      all[name] = all[name] || {};
      edit(all[name]);
      localStorage.setItem(key, JSON.stringify(all));
      changed();
      return Promise.resolve();
    };
    return {
      ...query,
      doc: (id = `auto${Date.now()}${made++}`) => ({
        get: () => Promise.resolve({ exists: id in (read()[name] || {}) }),
        // a write takes a moment, as the real stores' do, so a double click lands while one runs
        set: (data) =>
          new Promise((done) => setTimeout(done, 150)).then(() =>
            write((docs) => (docs[id] = data)),
          ),
        delete: () => write((docs) => delete docs[id]),
      }),
    };
  };
  const db = { collection };
  window.claude = { use: async (capability) => (capability === "db" ? db : null) };
}
