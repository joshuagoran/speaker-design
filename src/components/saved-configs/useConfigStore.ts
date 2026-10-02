import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { ConfigDb, SavedConfig, SavedConfigData } from "../../types";
import type { FirebaseStore } from "./firebaseStore";

/** The GitHub Pages build is `vp build --mode pages`; only that build bundles Firebase (see firebaseStore.ts). */
const PAGES_BUILD = import.meta.env.MODE === "pages";

/** Saved configurations: the claude.ai artifact's database, or Firebase when the page is hosted on GitHub Pages */
export function useConfigStore(collection: string) {
  const [db, setDb] = useState<ConfigDb | null>(null);
  const [saved, setSaved] = useState<SavedConfig[] | null>(null); // null = still loading
  const [fb, setFb] = useState<FirebaseStore | null>(null);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [cfgMsg, setCfgMsg] = useState("");
  useEffect(() => {
    let live = true;
    if (PAGES_BUILD && !(window.claude && window.claude.use)) {
      let un: (() => void) | null = null;
      import("./firebaseStore")
        .then(({ createFirebase }) => {
          if (!live) return;
          const f = createFirebase();
          setFb(f);
          un = f.onAuth((u) => {
            if (!live) return;
            setFbUser(u);
            if (u) setDb(f.userDb(u.uid));
            else {
              setDb(null);
              setSaved([]);
            }
          });
        })
        .catch(() => {
          if (live) setSaved([]);
        });
      return () => {
        live = false;
        if (un) un();
      };
    }
    (async () => {
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
  const signIn = () => fb!.signIn().catch(() => flash("Sign-in failed"));
  const signOut = () => fb!.signOut();
  const save = async (name: string, data: SavedConfigData): Promise<boolean> => {
    if (!db || !name) return false;
    setCfgMsg("Saving…");
    try {
      await db
        .collection(collection)
        .doc()
        .set({ name, savedAt: Date.now(), ...data });
      flash("Saved");
      return true;
    } catch (e) {
      flash(
        // the error is a Firebase or artifact-database error carrying a `code`
        e &&
          ((e as { code?: string }).code === "invalid_argument" ||
            (e as { code?: string }).code === "permission-denied")
          ? "You don't have write access here"
          : "Couldn't save — try again",
      );
      return false;
    }
  };
  const remove = async (id: string) => {
    if (!db) return;
    try {
      await db.collection(collection).doc(id).delete();
    } catch {
      flash("Couldn't delete");
    }
  };
  return { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut, save, remove };
}

/** What `useConfigStore` returns: the saved-config list and the actions on it. */
export type ConfigStore = ReturnType<typeof useConfigStore>;
