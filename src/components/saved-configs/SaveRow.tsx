import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { RowSelect } from "../ui/RowSelect";
import type { SelectOption } from "../ui/SelectField";
import { SAVE_ROW_TEXT, type SaveRowWords } from "../../constants/saveRow";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import type { ConfigStore } from "./useConfigStore";
import type { SavedConfig, SavedConfigData } from "../../types";

interface Props<T extends SelectOption> {
  store: ConfigStore;
  /** what a save stores */
  snapshot: () => SavedConfigData;
  /** opens a saved design */
  restore: (config: SavedConfig) => void;
  /** the design's name, which a save takes */
  name: string;
  onName: (name: string) => void;
  /** the nouns that name the page's designs */
  words: SaveRowWords;
  /** the starts "New from…" lists, each under its group, and the call that replaces the design with one */
  starts: readonly T[];
  group: (start: T) => string;
  onStart: (start: T) => void;
}

/** The longest name a design takes. */
const NAME_MAX = 60;

/**
 * A results pane's top row (the Speaker page's): the design's name, Save (a new saved design under that name), the saved
 * designs, Open, and "New from…" (a template or a current design, which replaces this one). A picked saved design also
 * takes Save over, Rename, Duplicate and Delete on a second line.
 */
export function SaveRow<T extends SelectOption>({
  store,
  snapshot,
  restore,
  name,
  onName,
  words,
  starts,
  group,
  onStart,
}: Props<T>) {
  const { db, saved, fb, fbUser, cfgMsg, signIn, signOut, remove } = store;
  const [sel, setSel] = useState("");
  /** the new name typed while renaming the picked one; null when not renaming */
  const [newName, setNewName] = useState<string | null>(null);
  /** whether the row asks to confirm Save over (an inline step: a browser dialog can be blocked in the artifact host) */
  const [confirming, setConfirming] = useState(false);
  const list = saved ?? [];
  const cur = list.find((c) => c.id === sel);
  const trimmed = name.trim();
  const reset = () => {
    setNewName(null);
    setConfirming(false);
  };
  const doSave = async () => {
    // the new one is picked, so its own actions (save over, rename) act on it
    const id = await store.create(trimmed, snapshot());
    if (id) setSel(id);
    reset();
  };
  const doRename = async () => {
    if (cur && newName?.trim() && (await store.rename(cur, newName.trim()))) setNewName(null);
  };
  /** each saved speaker as the list shows it: its name and the day it was saved */
  const savedOptions = list.map((c) => ({
    id: c.id,
    name: c.savedAt
      ? `${c.name} · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : c.name,
  }));
  return (
    <div
      role="group"
      aria-label={SAVE_ROW_TEXT.row}
      className={`${RESULT_MAX_WIDTH} flex flex-col gap-2`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TextField
          ariaLabel={words.namePlaceholder}
          placeholder={words.namePlaceholder}
          value={name}
          onChange={onName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && db && trimmed) void doSave(); // `create` shows its own failure message
          }}
          maxLength={NAME_MAX}
          className="py-2 w-56 max-w-full"
        />
        {db ? (
          <>
            <Button variant="primary" onClick={doSave} disabled={!trimmed}>
              {SAVE_ROW_TEXT.save}
            </Button>
            <RowSelect
              ariaLabel={words.savedList}
              options={savedOptions}
              value={cur ? cur.id : ""}
              onChange={(o) => {
                setSel(o.id);
                reset();
              }}
              prompt={list.length ? words.pick(list.length) : words.noSaved}
              disabled={!list.length}
              className="min-w-0 max-w-full w-56"
            />
            <Button
              onClick={() => {
                if (cur) restore(cur);
                reset();
              }}
              disabled={!cur}
            >
              {SAVE_ROW_TEXT.open}
            </Button>
          </>
        ) : fb ? (
          <Button
            variant="primary"
            onClick={signIn}
            // start fetching Firebase as soon as the pointer or focus heads here: the sign-in popup must open soon
            // after the click or browsers block it
            onPointerEnter={fb.prefetch}
            onFocus={fb.prefetch}
            onTouchStart={fb.prefetch}
          >
            {SAVE_ROW_TEXT.signIn}
          </Button>
        ) : (
          saved !== null && (
            <span className="text-xs text-stone-500">{SAVE_ROW_TEXT.unavailable}</span>
          )
        )}
        <RowSelect
          ariaLabel={SAVE_ROW_TEXT.newFrom}
          title={words.newFromTip}
          options={starts}
          value=""
          onChange={onStart}
          group={group}
          prompt={SAVE_ROW_TEXT.newFromPrompt}
          className="min-w-0 max-w-full w-56"
        />
        {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
        {fbUser && (
          <button onClick={signOut} className="ml-auto text-xs text-stone-500 hover:underline">
            {SAVE_ROW_TEXT.signOut}
          </button>
        )}
      </div>
      {cur && db && (
        <div className="flex flex-wrap items-center gap-2">
          {newName === null && confirming && (
            <>
              <span className="text-sm">{SAVE_ROW_TEXT.replace(cur.name)}</span>
              <Button
                size="xs"
                variant="primary"
                onClick={() => {
                  setConfirming(false);
                  void store.overwrite(cur.id, cur.name, snapshot()); // `overwrite` shows its own failure message
                }}
              >
                {SAVE_ROW_TEXT.yes}
              </Button>
              <Button size="xs" onClick={() => setConfirming(false)}>
                {SAVE_ROW_TEXT.cancel}
              </Button>
            </>
          )}
          {newName === null && !confirming && (
            <>
              <Button
                size="xs"
                onClick={() => setConfirming(true)}
                aria-label={SAVE_ROW_TEXT.saveOverLabel(cur.name)}
              >
                {SAVE_ROW_TEXT.saveOver}
              </Button>
              <Button size="xs" onClick={() => setNewName(cur.name)}>
                {SAVE_ROW_TEXT.rename}
              </Button>
              <Button
                size="xs"
                onClick={() => void store.duplicate(cur, SAVE_ROW_TEXT.copyName(cur.name))}
              >
                {SAVE_ROW_TEXT.duplicate}
              </Button>
            </>
          )}
          {newName !== null && (
            <>
              <TextField
                ariaLabel={SAVE_ROW_TEXT.renameLabel(cur.name)}
                value={newName}
                onChange={setNewName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doRename(); // `rename` shows its own failure message
                  if (e.key === "Escape") setNewName(null);
                }}
                maxLength={NAME_MAX}
                className="py-1 w-48 max-w-full"
              />
              <Button size="xs" variant="primary" onClick={doRename} disabled={!newName.trim()}>
                {SAVE_ROW_TEXT.rename}
              </Button>
              <Button size="xs" onClick={() => setNewName(null)}>
                {SAVE_ROW_TEXT.cancel}
              </Button>
            </>
          )}
          <button
            onClick={() => {
              void remove(cur.id); // `remove` shows its own failure message
              setSel("");
              reset();
            }}
            aria-label={SAVE_ROW_TEXT.deleteLabel(cur.name)}
            className="text-xs text-stone-500 hover:text-red-700 px-1"
          >
            {SAVE_ROW_TEXT.delete}
          </button>
          {cur.summary && (
            <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>
          )}
        </div>
      )}
    </div>
  );
}
