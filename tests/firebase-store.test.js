// The Pages build's Firebase adapter, against a mocked modular SDK: the planner's config store must get the same
// calls the compat SDK used to make (user collection path, orderBy savedAt desc, limit 50, set / delete, auth).
import { test, vi } from "vite-plus/test";
import assert from "node:assert";

const calls = [];
const log =
  (name) =>
  (...args) => (calls.push([name, ...args]), { name, args });
vi.mock("firebase/app", () => ({ initializeApp: log("initializeApp") }));
vi.mock("firebase/auth", () => ({
  getAuth: log("getAuth"),
  GoogleAuthProvider: class {
    constructor() {
      calls.push(["GoogleAuthProvider"]);
    }
  },
  onAuthStateChanged: (auth, cb) => (
    calls.push(["onAuthStateChanged"]),
    cb({ uid: "u1" }),
    () => calls.push(["unsubscribeAuth"])
  ),
  signInWithPopup: (auth, provider) => (
    calls.push(["signInWithPopup", provider.constructor.name]),
    Promise.resolve()
  ),
  signOut: () => (calls.push(["signOut"]), Promise.resolve()),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: log("getFirestore"),
  collection: (fs, path) => (calls.push(["collection", path]), { path }),
  doc: (ref, id) => (calls.push(["doc", ref.path, id ?? "(new)"]), { ref, id }),
  setDoc: (d, data) => (calls.push(["setDoc", d.id ?? "(new)", data]), Promise.resolve()),
  deleteDoc: (d) => (calls.push(["deleteDoc", d.id]), Promise.resolve()),
  query: (ref, ...constraints) => ({ ref, constraints }),
  orderBy: (field, dir) => ["orderBy", field, dir],
  limit: (n) => ["limit", n],
  onSnapshot: (q, next) => (
    calls.push(["onSnapshot", q.ref.path, q.constraints]),
    next({ docs: [] }),
    () => calls.push(["unsubscribeSnap"])
  ),
}));

test("firebase adapter: the config store's calls map onto the modular SDK", async () => {
  const { createFirebase } = await import("../tools/firebase-store.js");
  const fb = createFirebase();
  assert.equal(
    createFirebase(),
    fb,
    "one instance per page (Firebase can't initialize the same app twice)",
  );
  assert.equal(calls.filter(([n]) => n === "initializeApp").length, 1);
  assert.equal(
    calls.find(([n]) => n === "initializeApp")[1].projectId,
    "speaker-planner",
    "the project's config",
  );

  let user = null;
  const unAuth = fb.onAuth((u) => (user = u));
  assert.deepEqual(user, { uid: "u1" });
  const db = fb.userDb(user.uid);

  const seen = [];
  const unSnap = db
    .collection("configs")
    .orderBy("savedAt", "desc")
    .limit(50)
    .onSnapshot((snap) => seen.push(snap));
  assert.deepEqual(
    calls.find(([n]) => n === "onSnapshot"),
    [
      "onSnapshot",
      "users/u1/configs",
      [
        ["orderBy", "savedAt", "desc"],
        ["limit", 50],
      ],
    ],
  );
  assert.equal(seen.length, 1);

  await db.collection("configs").doc().set({ name: "a" });
  await db.collection("configs").doc("seed1").set({ name: "b" });
  await db.collection("configs").doc("x").delete();
  assert.deepEqual(
    calls.filter(([n]) => n === "setDoc").map(([, id, data]) => [id, data.name]),
    [
      ["(new)", "a"],
      ["seed1", "b"],
    ],
  );
  assert.deepEqual(
    calls.filter(([n]) => n === "deleteDoc").map(([, id]) => id),
    ["x"],
  );

  await fb.signIn();
  assert.deepEqual(
    calls.find(([n]) => n === "signInWithPopup"),
    ["signInWithPopup", "GoogleAuthProvider"],
  );
  await fb.signOut();
  unSnap();
  unAuth();
  assert.ok(
    calls.some(([n]) => n === "unsubscribeSnap") && calls.some(([n]) => n === "unsubscribeAuth"),
  );
});
