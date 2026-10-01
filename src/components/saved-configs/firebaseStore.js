// Firebase for the GitHub Pages build, bundled from npm (the modular SDK) instead of the compat scripts from Google's CDN.
// It exposes the small surface the planner's config store uses, in the shape of the claude.ai artifact database:
// collection(path).orderBy(field, dir).limit(n).onSnapshot(next, error), collection(path).doc(id?).set(data) / .delete().
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection as fsCollection,
  doc as fsDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy as fsOrderBy,
  limit as fsLimit,
  onSnapshot,
} from "firebase/firestore";
import { FIREBASE_CONFIG } from "./firebaseConfig.js";

// one instance per page: both views' config stores share it (Firebase refuses to initialize the same app twice)
let instance = null;
export function createFirebase(config = FIREBASE_CONFIG) {
  if (instance) return instance;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  const collection = (path) => {
    const ref = fsCollection(fs, path);
    // a query built up the way the compat API chains it
    const chain = (constraints) => ({
      orderBy: (field, dir) => chain([...constraints, fsOrderBy(field, dir)]),
      limit: (n) => chain([...constraints, fsLimit(n)]),
      onSnapshot: (next, error) => onSnapshot(query(ref, ...constraints), next, error),
    });
    return {
      ...chain([]),
      doc: (id) => {
        const d = id == null ? fsDoc(ref) : fsDoc(ref, id);
        return { set: (data) => setDoc(d, data), delete: () => deleteDoc(d) };
      },
    };
  };
  instance = {
    onAuth: (cb) => onAuthStateChanged(auth, cb),
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    // the signed-in user's own collections (firestore.rules allows users/{uid}/...)
    userDb: (uid) => ({ collection: (name) => collection(`users/${uid}/${name}`) }),
  };
  return instance;
}
