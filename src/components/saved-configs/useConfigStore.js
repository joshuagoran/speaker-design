import { useEffect, useState } from "react";

/** The GitHub Pages build is `vp build --mode pages`; only that build bundles Firebase (see firebaseStore.js). */
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
const rememberSignedIn = (yes) => {
  try {
    if (yes) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // storage unavailable (private mode): Firebase then loads on the next sign-in click instead
  }
};

/** Saved configurations: the claude.ai artifact's database, or Firebase when the page is hosted on GitHub Pages */
export function useConfigStore(collection) {
  const [db, setDb] = useState(null);
  const [saved, setSaved] = useState(null); // null = still loading
  const [fb, setFb] = useState(null);
  const [fbUser, setFbUser] = useState(null);
  const [cfgMsg, setCfgMsg] = useState("");
  useEffect(() => {
    let live = true;
    if (PAGES_BUILD && !(window.claude && window.claude.use)) {
      // Firebase is a separate file, fetched on demand: at startup only for someone who signed in before (to restore the
      // session), otherwise when they head for the sign-in button. Until then `fb` is a stand-in with the same calls.
      let un = null;
      let loading = null;
      const load = () =>
        (loading ??= import("./firebaseStore.js").then(({ createFirebase }) => {
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
      if (wasSignedIn()) load().catch(() => live && setSaved([]));
      else setSaved([]);
      return () => {
        live = false;
        if (un) un();
      };
    }
    (async () => {
      try {
        const d = window.claude && window.claude.use ? await window.claude.use("db") : null;
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
        (snap) => setSaved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setSaved([]),
      );
    return un;
  }, [db]);
  const flash = (m) => {
    setCfgMsg(m);
    setTimeout(() => setCfgMsg(""), 2500);
  };
  const signIn = () => fb.signIn().catch(() => flash("Sign-in failed"));
  const signOut = () => fb.signOut();
  const save = async (name, data) => {
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
        e && (e.code === "invalid_argument" || e.code === "permission-denied")
          ? "You don't have write access here"
          : "Couldn't save — try again",
      );
      return false;
    }
  };
  const remove = async (id) => {
    if (!db) return;
    try {
      await db.collection(collection).doc(id).delete();
    } catch {
      flash("Couldn't delete");
    }
  };
  return { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut, save, remove };
}
