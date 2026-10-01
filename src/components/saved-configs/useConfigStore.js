const { useEffect, useState } = React;

/** Saved configurations: the claude.ai artifact's database, or Firebase when the page is hosted on GitHub Pages */
export function useConfigStore(collection) {
  const [db, setDb] = useState(null);
  const [saved, setSaved] = useState(null);     // null = still loading
  const [fbUser, setFbUser] = useState(null);
  const [cfgMsg, setCfgMsg] = useState("");
  const fb = !(window.claude && window.claude.use) && window.firebase && window.PLANNER_FIREBASE ? window.firebase : null;
  useEffect(() => {
    let live = true;
    if (fb) {
      if (!fb.apps.length) fb.initializeApp(window.PLANNER_FIREBASE);
      const un = fb.auth().onAuthStateChanged((u) => {
        if (!live) return;
        setFbUser(u);
        if (u) {
          const fs = fb.firestore();
          setDb({ collection: (name) => fs.collection(`users/${u.uid}/${name}`) });
        } else { setDb(null); setSaved([]); }
      });
      return () => { live = false; un(); };
    }
    (async () => {
      try {
        const d = window.claude && window.claude.use ? await window.claude.use("db") : null;
        if (live) { setDb(d); if (!d) setSaved([]); }
      } catch { if (live) { setDb(null); setSaved([]); } }
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!db) return;
    const un = db.collection(collection).orderBy("savedAt", "desc").limit(50).onSnapshot(
      (snap) => setSaved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setSaved([])
    );
    return un;
  }, [db]);
  const flash = (m) => { setCfgMsg(m); setTimeout(() => setCfgMsg(""), 2500); };
  const signIn = () => fb.auth().signInWithPopup(new fb.auth.GoogleAuthProvider()).catch(() => flash("Sign-in failed"));
  const signOut = () => fb.auth().signOut();
  const save = async (name, data) => {
    if (!db || !name) return false;
    setCfgMsg("Saving…");
    try { await db.collection(collection).doc().set({ name, savedAt: Date.now(), ...data }); flash("Saved"); return true; }
    catch (e) { flash(e && (e.code === "invalid_argument" || e.code === "permission-denied") ? "You don't have write access here" : "Couldn't save — try again"); return false; }
  };
  const remove = async (id) => {
    if (!db) return;
    try { await db.collection(collection).doc(id).delete(); } catch { flash("Couldn't delete"); }
  };
  return { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut, save, remove };
}
