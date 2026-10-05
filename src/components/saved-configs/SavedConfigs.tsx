import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useState } from "react";
import type { ConfigStore } from "./useConfigStore";
import type { SavedConfig, SavedConfigData } from "../../types";
import { FONT } from "../../styles/fonts";
import { PAGE_WIDTH } from "../../styles/layout";

interface Props {
  store: ConfigStore;
  /** what to save; may include a `summary` line */
  snapshot: () => SavedConfigData;
  restore: (config: SavedConfig) => void;
  /** shown beside Sign out */
  extra?: React.ReactNode;
  /** a plain div instead of the page-width section */
  bare?: boolean;
}

/** Name-and-save row plus a menu of saved setups. snapshot() returns what to store (may include a `summary` line); restore(c) loads one. */
export function SavedConfigs({ store, snapshot, restore, extra, bare = false }: Props) {
  const { db, saved, fb, fbUser, cfgMsg, signIn, signOut, save, remove } = store;
  const [name, setName] = useState("");
  const [sel, setSel] = useState("");
  if (saved === null) return null;
  const cur = saved.find((c) => c.id === sel);
  const doSave = async () => {
    if (await save(name.trim(), snapshot())) setName("");
  };
  const Wrap = bare ? "div" : "section";
  const namePrompt = "Name this setup";
  return (
    <Wrap className={bare ? "mb-3" : `${PAGE_WIDTH} pb-2`} style={{ fontFamily: FONT }}>
      <Card pad="lg" tone="tint">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500 mr-1">Saved configurations</span>
          {db ? (
            <>
              <input
                aria-label={namePrompt}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doSave(); // `save` shows its own failure message
                }}
                placeholder={namePrompt}
                maxLength={60}
                className="px-3 py-1.5 rounded border border-stone-300 bg-white text-sm w-56"
              />
              <Button variant="dark" onClick={doSave} disabled={!name.trim()}>
                Save current
              </Button>
              {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
              {fbUser && (
                <span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
                  {extra}
                  <button onClick={signOut} className="hover:underline">
                    Sign out
                  </button>
                </span>
              )}
            </>
          ) : fb ? (
            <>
              <Button
                variant="dark"
                onClick={signIn}
                // start fetching Firebase as soon as the pointer or focus heads here: the sign-in popup must open soon
                // after the click or browsers block it
                onPointerEnter={fb.prefetch}
                onFocus={fb.prefetch}
                onTouchStart={fb.prefetch}
              >
                Sign in with Google to save
              </Button>
              {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
            </>
          ) : (
            <span className="text-xs text-stone-500">
              Saving is unavailable in this view. Everything else works.
            </span>
          )}
        </div>
        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={cur ? cur.id : ""}
              aria-label="Load a saved configuration"
              onChange={(e) => {
                const c = saved.find((x) => x.id === e.target.value);
                setSel(e.target.value);
                if (c) restore(c);
              }}
              className="px-2 py-1.5 rounded border border-stone-300 bg-white text-sm min-w-0 max-w-full flex-1"
            >
              <option value="" disabled>
                Load a saved configuration ({saved.length})…
              </option>
              {saved.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.savedAt
                    ? ` · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : ""}
                </option>
              ))}
            </select>
            {cur && (
              <button
                onClick={() => {
                  void remove(cur.id); // `remove` shows its own failure message
                  setSel("");
                }}
                aria-label={`Delete ${cur.name}`}
                className="text-xs text-stone-500 hover:text-red-700 px-1"
              >
                Delete
              </button>
            )}
            {cur && cur.summary && (
              <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>
            )}
          </div>
        )}
      </Card>
    </Wrap>
  );
}
