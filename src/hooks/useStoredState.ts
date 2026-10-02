import { useState } from "react";
import { readStoredJson, writeStoredJson } from "../lib/storage";

type Updater<T> = T | ((prev: T) => T);

const isUpdater = <T>(v: Updater<T>): v is (prev: T) => T => typeof v === "function";

/**
 * State that starts from what an earlier run stored under `key` (read as the `S` shape, `fallback` when there is
 * none) turned into the `T` the page holds, and is written back whenever it is set.
 */
export function useStoredStateFrom<T, S>(
  key: string,
  fallback: S,
  fromStored: (stored: S) => T,
): [T, (v: Updater<T>) => void] {
  const [value, setValue] = useState(() => fromStored(readStoredJson(key, fallback)));
  const set = (v: Updater<T>) =>
    setValue((prev) => {
      const next = isUpdater(v) ? v(prev) : v;
      writeStoredJson(key, next);
      return next;
    });
  return [value, set];
}

/** `useState` that starts from what an earlier run stored under `key` (`fallback` when there is none) and is written back whenever it is set. */
export const useStoredState = <T>(key: string, fallback: T) =>
  useStoredStateFrom(key, fallback, (stored: T) => stored);
