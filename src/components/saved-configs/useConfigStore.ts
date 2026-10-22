import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { ConfigDb, SavedConfig, SavedConfigData } from "../../types";
import type { FirebaseStore } from "./firebaseStore";
import { UI_TEXT } from "../../constants/uiText";
import { WRITE_DENIED_CODES } from "../../constants/firebaseErrors";

/** The GitHub Pages build is `vp build --mode pages`; only that build bundles Firebase (see firebaseStore.ts). */
const PAGES_BUILD = import.meta.env.MODE === "pages";

/** Whether this browser signed in before: then Firebase loads at startup to restore the session. */
const SIGNED_IN_KEY = "speaknow.firebase.signedIn";
const wasSignedIn = () => {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
};
const rememberSignedIn = (yes: boolean) => {
  try {
    if (yes) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // storage unavailable (private mode): Firebase then loads on the next sign-in click instead
  }
};

/** The characters and length of a new document id, as Firestore's own auto ids. */
const DOC_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DOC_ID_LENGTH = 20;
/** A new document id, random as Firestore's auto ids (both stores take any id). */
export const newDocId = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(DOC_ID_LENGTH)),
    (b) => DOC_ID_CHARS[b % DOC_ID_CHARS.length],
  ).join("");

/** What the UI holds before Firebase is fetched: the same sign-in calls, plus a prefetch for the sign-in button. */
export interface FirebaseLoader {
  prefetch: () => void;
  signIn: () => Promise<unknown>;
  signOut: () => Promise<unknown>;
}

/** Saved configurations: the claude.ai artifact's database, or Firebase when the page is hosted on GitHub Pages */
export function useConfigStore(collection: string) {
  const [db, setDb] = useState<ConfigDb | null>(null);
  const [saved, setSaved] = useState<SavedConfig[] | null>(null); // null = still loading
  const [fb, setFb] = useState<FirebaseLoader | null>(null);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [cfgMsg, setCfgMsg] = useState("");
  useEffect(() => {
    let live = true;
    if (PAGES_BUILD && !(window.claude && window.claude.use)) {
      // Firebase is a separate file, fetched on demand: at startup only for someone who signed in before (to restore the
      // session), otherwise when they head for the sign-in button. Until then `fb` is a stand-in with the same calls.
      let un: (() => void) | null = null;
      let loading: Promise<FirebaseStore> | null = null;
      const load = () =>
        (loading ??= import("./firebaseStore").then(({ createFirebase }) => {
          const f = createFirebase();
          if (live) {
            un = f.onAuth((u) => {
              if (!live) return;
              setFbUser(u);
              rememberSignedIn(!!u);
              if (u) setDb(f.userDb(u.uid));
              else {
                setDb(null);
                setSaved([]);
              }
            });
          }
          return f;
        }));
      setFb({
        prefetch: () => void load().catch(() => {}),
        signIn: () => load().then((f) => f.signIn()),
        signOut: () => load().then((f) => f.signOut()),
      });
      if (wasSignedIn())
        load().catch(() => {
          if (live) setSaved([]);
        });
      else setSaved([]);
      return () => {
        live = false;
        if (un) un();
      };
    }
    void (async () => {
      try {
        // boundary: the artifact host's `use("db")` resolves to the database handle (typed `unknown` in env.d.ts)
        const d = (
          window.claude && window.claude.use ? await window.claude.use("db") : null
        ) as ConfigDb | null;
        if (live) {
          setDb(d);
          if (!d) setSaved([]);
        }
      } catch {
        if (live) {
          setDb(null);
          setSaved([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!db) return;
    const un = db
      .collection(collection)
      .orderBy("savedAt", "desc")
      .limit(50)
      .onSnapshot(
        (snap) =>
          setSaved(
            snap.docs.map(
              // boundary: stored documents come from `save` below, so they carry a `name`
              (d) => ({ id: d.id, ...d.data() }) as SavedConfig,
            ),
          ),
        () => setSaved([]),
      );
    return un;
  }, [db]);
  const flash = (m: string) => {
    setCfgMsg(m);
    setTimeout(() => setCfgMsg(""), 2500);
  };
  // `fb` is the loader stand-in on the Pages build (it fetches Firebase on demand) and null elsewhere
  const signIn = async () => {
    if (!fb) return;
    try {
      await fb.signIn();
    } catch {
      flash("Sign-in failed");
    }
  };
  const signOut = async () => {
    if (fb) await fb.signOut();
  };
  /** writes `data` under `name` to the document `id`; false (and a message) when it fails */
  const write = async (
    id: string,
    name: string,
    data: SavedConfigData,
    done: string,
  ): Promise<boolean> => {
    if (!db || !name) return false;
    setCfgMsg("Saving…");
    try {
      await db
        .collection(collection)
        .doc(id)
        .set({ name, savedAt: Date.now(), ...data });
      flash(done);
      return true;
    } catch (e) {
      flash(
        // the error is a Firebase or artifact-database error carrying a `code`
        e && WRITE_DENIED_CODES.has((e as { code?: string }).code ?? "")
          ? "You do not have write access here"
          : UI_TEXT.saveFailed,
      );
      return false;
    }
  };
  /** a new saved configuration under an id made here, so the caller can pick it: that id, or null when it fails */
  const create = async (name: string, data: SavedConfigData) => {
    const id = newDocId();
    return (await write(id, name, data, "Saved")) ? id : null;
  };
  /** a saved configuration's data replaced by `data`, under `name` (a new document when `id` is one nothing has) */
  const overwrite = (id: string, name: string, data: SavedConfigData) =>
    write(id, name, data, "Saved");
  /** whether the saved configuration `id` exists (it may be past the list); null (and a message) when the read fails */
  const exists = async (id: string): Promise<boolean | null> => {
    if (!db) return null;
    try {
      return (await db.collection(collection).doc(id).get()).exists;
    } catch {
      flash(UI_TEXT.saveFailed);
      return null;
    }
  };
  /** deletes a saved configuration; false (and a message) when it fails */
  const remove = async (id: string): Promise<boolean> => {
    if (!db) return false;
    try {
      await db.collection(collection).doc(id).delete();
      return true;
    } catch {
      flash("The delete failed");
      return false;
    }
  };
  return {
    db,
    saved,
    fb,
    fbUser,
    cfgMsg,
    setCfgMsg,
    flash,
    signIn,
    signOut,
    create,
    overwrite,
    exists,
    remove,
  };
}

/** What `useConfigStore` returns: the saved-config list and the actions on it. */
export type ConfigStore = ReturnType<typeof useConfigStore>;
