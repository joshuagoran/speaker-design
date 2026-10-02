import { useConfigStore } from "../../../components/saved-configs/useConfigStore.ts";

/** Saved configurations, backed by the artifact's document store, plus the one-time import of the seed configs. */
export function useSavedConfigs() {
  const store = useConfigStore("configs");
  const { db, saved, fb, fbUser, cfgMsg, setCfgMsg, signIn, signOut } = store;
  /** One-time copy of the configs saved in the claude.ai artifact (data/configs-seed.json). */
  const importSeed = async () => {
    if (!db) return;
    setCfgMsg("Importing…");
    try {
      const rows = await (await fetch("configs-seed.json")).json();
      const have = new Set((saved || []).map((c) => c.name));
      let n = 0;
      for (const { id, ...c } of rows) {
        if (have.has(c.name)) continue;
        await db.collection("configs").doc(id).set(c);
        n++;
      }
      setCfgMsg(n ? `Imported ${n}` : "Nothing new to import");
    } catch {
      setCfgMsg("Couldn't import");
    }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  return {
    store,
    db,
    saved,
    fb,
    fbUser,
    cfgMsg,
    setCfgMsg,
    signIn,
    signOut,
    importSeed,
  };
}
