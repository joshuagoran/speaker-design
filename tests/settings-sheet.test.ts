import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  SHEET_SHARE,
  clampSheetHeight,
  sheetDragCloses,
  sheetTapHeight,
} from "../src/components/ui/SettingsSheetTabs";

/** A phone screen's height, px. */
const SCREEN_PX = 800;

test("settings sheet: a drag keeps the sheet between its shortest and tallest heights", () => {
  assert.equal(clampSheetHeight(400, SCREEN_PX), 400);
  assert.equal(clampSheetHeight(10, SCREEN_PX), SHEET_SHARE.min * SCREEN_PX);
  assert.equal(clampSheetHeight(900, SCREEN_PX), SHEET_SHARE.max * SCREEN_PX);
});

test("settings sheet: a tap on the bar switches between half and full height", () => {
  assert.equal(sheetTapHeight(300, SCREEN_PX), SHEET_SHARE.max * SCREEN_PX);
  assert.equal(sheetTapHeight(600, SCREEN_PX), SHEET_SHARE.half * SCREEN_PX);
  // from either, the next tap goes to the other
  assert.equal(
    sheetTapHeight(sheetTapHeight(300, SCREEN_PX), SCREEN_PX),
    SHEET_SHARE.half * SCREEN_PX,
  );
});

test("settings sheet: only a drag well below the shortest height closes it", () => {
  const min = SHEET_SHARE.min * SCREEN_PX;
  assert.equal(sheetDragCloses(min, SCREEN_PX), false);
  assert.equal(sheetDragCloses(min - 10, SCREEN_PX), false);
  assert.equal(sheetDragCloses(min - 60, SCREEN_PX), true);
});
