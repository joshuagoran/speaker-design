// Firebase for the GitHub Pages build, bundled from npm (the modular SDK) instead of the compat scripts from Google's CDN.
// It exposes the small surface the planner's config store uses, in the shape of the claude.ai artifact database:
// collection(path).orderBy(field, dir).limit(n).onSnapshot(next, error), collection(path).doc(id?).set(data) / .delete().
import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
  type UserCredential,
  type Unsubscribe,
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
  type QueryConstraint,
  type OrderByDirection,
} from "firebase/firestore";
import { FIREBASE_CONFIG } from "./firebaseConfig";
import type { ConfigDb, ConfigQuery, ConfigSnapshot } from "../../types";

/** What the config store gets: sign-in and the signed-in user's own database handle. */
export interface FirebaseStore {
  onAuth: (cb: (user: User | null) => void) => Unsubscribe;
  signIn: () => Promise<UserCredential>;
  signOut: () => Promise<void>;
  userDb: (uid: string) => ConfigDb;
}

// one instance per page: both views' config stores share it (Firebase refuses to initialize the same app twice)
let instance: FirebaseStore | null = null;
export function createFirebase(config: FirebaseOptions = FIREBASE_CONFIG): FirebaseStore {
  if (instance) return instance;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  const collection = (path: string) => {
    const ref = fsCollection(fs, path);
    // a query built up the way the compat API chains it
    const chain = (constraints: QueryConstraint[]): ConfigQuery => ({
      orderBy: (field: string, dir?: OrderByDirection) =>
        chain([...constraints, fsOrderBy(field, dir)]),
      limit: (n: number) => chain([...constraints, fsLimit(n)]),
      onSnapshot: (next: (snap: ConfigSnapshot) => void, error: (e: Error) => void) =>
        onSnapshot(query(ref, ...constraints), next, error),
    });
    return {
      ...chain([]),
      doc: (id?: string) => {
        const d = id == null ? fsDoc(ref) : fsDoc(ref, id);
        return {
          set: (data: Record<string, unknown>) => setDoc(d, data),
          delete: () => deleteDoc(d),
        };
      },
    };
  };
  instance = {
    onAuth: (cb) => onAuthStateChanged(auth, cb),
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    // the signed-in user's own collections (firestore.rules allows users/{uid}/...)
    userDb: (uid: string) => ({ collection: (name) => collection(`users/${uid}/${name}`) }),
  };
  return instance;
}
