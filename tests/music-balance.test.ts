import { expect, test } from "vite-plus/test";
import { musicBalanceToSave, savedMusicBalance } from "../src/lib/pa/musicBalance";

test("the music balance saves under its first keys, so older designs load", () => {
  // a design saved before the rename: `tilt` is the mid below the sub, `hfTilt` the horn below the mid (dB)
  expect(savedMusicBalance({ tilt: 7, hfTilt: 4 })).toEqual({
    midBelowSubDb: 7,
    hornBelowMidDb: 4,
  });
  expect(musicBalanceToSave(7, 4)).toEqual({ tilt: 7, hfTilt: 4 });
  expect(savedMusicBalance(musicBalanceToSave(5, 2))).toEqual({
    midBelowSubDb: 5,
    hornBelowMidDb: 2,
  });
  // a save without them keeps the planner's values
  expect(savedMusicBalance({})).toEqual({ midBelowSubDb: null, hornBelowMidDb: null });
});
