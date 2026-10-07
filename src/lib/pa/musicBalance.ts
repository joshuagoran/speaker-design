// The music balance: how far each band's level sits below the band under it, in dB (a level, not an angle). A saved
// design keeps the first key names, `tilt` (mid below sub) and `hfTilt` (horn below mid), so every older save loads.
import type { PaDesignConfig } from "../../types";

/** The keys a design saves the music balance under. */
export const musicBalanceToSave = (
  midBelowSubDb: number,
  hornBelowMidDb: number,
): Pick<PaDesignConfig, "tilt" | "hfTilt"> => ({ tilt: midBelowSubDb, hfTilt: hornBelowMidDb });

/** The music balance a saved design holds; null where it has none (the planner keeps its current value). */
export const savedMusicBalance = (c: Partial<Pick<PaDesignConfig, "tilt" | "hfTilt">>) => ({
  midBelowSubDb: typeof c.tilt === "number" ? c.tilt : null,
  hornBelowMidDb: typeof c.hfTilt === "number" ? c.hfTilt : null,
});
