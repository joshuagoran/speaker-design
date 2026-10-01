/** Reads a JSON value from local storage, or returns `fallback` when it is missing or storage is unavailable. */
export const readStoredJson = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};

/** Writes a JSON value to local storage; does nothing when storage is unavailable. */
export const writeStoredJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
