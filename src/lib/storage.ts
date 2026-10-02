/** Reads a JSON value from local storage, or returns `fallback` when it is missing or storage is unavailable. */
export const readStoredJson = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T); // boundary cast: the stored text is whatever an earlier run wrote, the caller supplies its shape
  } catch {
    return fallback;
  }
};

/** Writes a JSON value to local storage; does nothing when storage is unavailable. */
export const writeStoredJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
