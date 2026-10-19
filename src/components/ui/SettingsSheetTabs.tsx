import { useRef, useState } from "react";
import { PRESSED_CLASSES } from "./buttonStyles";
import { SectionHeading } from "./SectionHeading";
import { UI_TEXT } from "../../constants/uiText";
import { useStoredState } from "../../hooks/useStoredState";
import { entriesOf } from "../../lib/records";

/** A `SettingsColumn`'s classes that make it the phone settings sheet: pinned to the bottom of the screen below md. */
export const SETTINGS_SHEET_CLASS =
  "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-lg max-md:shadow-sheet";

/** The CSS variable that holds the phone sheet's body height (set on the page, so the sheet and the page's room read it). */
const SHEET_HEIGHT_VAR = "--sheet-h";

/**
 * The phone settings sheet's scrolling body: the height the viewer set (30% of the screen until then; never past 70%,
 * for a height set on a taller screen), the same on every tab; hidden while the sheet is closed.
 */
export const settingsSheetBodyClass = (open: boolean) =>
  `max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:h-[min(var(--sheet-h,30dvh),70dvh)] ${open ? "" : "max-md:hidden"}`;

/**
 * A cap on the phone sheet's body, so the sheet stays under 58% of the screen and a chart at the top of the screen
 * shows above it (the Speaker page's driver comparison, which previews rows on its response chart).
 */
export const SHEET_BELOW_CHART_CLASS = "max-md:max-h-[calc(58dvh-7.5rem)]";

/**
 * The room a page leaves at its bottom on phones for the settings sheet: the bar and the tabs while it is closed; open,
 * also the heading and the body's height (as `settingsSheetBodyClass` sets it).
 */
export const settingsSheetRoomClass = (open: boolean) =>
  open ? "max-md:pb-[calc(min(var(--sheet-h,30dvh),70dvh)+9rem)]" : "max-md:pb-28";

/** The shortest and the tallest the open sheet goes, and its "half" height, as shares of the screen's height. */
export const SHEET_SHARE = { min: 0.18, half: 0.45, max: 0.78 } as const;

/** How far one arrow-key press on the bar moves the sheet's top, px. */
const KEY_STEP_PX = 32;

/** How far the bar must move before a press counts as a drag, not a tap, px. */
const DRAG_START_PX = 4;

/** How far past its shortest height the sheet must be dragged down to close, px. */
const CLOSE_PAST_PX = 32;

/** The open sheet's whole height, px, kept between its shortest and tallest on a screen `screenPx` tall. */
export const clampSheetHeight = (px: number, screenPx: number) =>
  Math.min(SHEET_SHARE.max * screenPx, Math.max(SHEET_SHARE.min * screenPx, px));

/** The sheet's height after a tap on its bar, px: half height from a sheet taller than half the screen, else full. */
export const sheetTapHeight = (px: number, screenPx: number) =>
  (px > screenPx / 2 ? SHEET_SHARE.half : SHEET_SHARE.max) * screenPx;

/** Whether a drag that left the sheet `px` tall closes it: dragged well below its shortest height. */
export const sheetDragCloses = (px: number, screenPx: number) =>
  px < SHEET_SHARE.min * screenPx - CLOSE_PAST_PX;

/** A page's phone settings sheet: open or closed, the tab it shows, and the body height the viewer set. */
export interface SettingsSheet<Id extends string> {
  open: boolean;
  /** the tab showing while it is open */
  tab: Id;
  /** opens the sheet on a tab */
  show: (id: Id) => void;
  close: () => void;
  /** the body's height the viewer set, px; null until then */
  heightPx: number | null;
  setHeightPx: (px: number | null) => void;
  /** the classes that hide a section on phones unless its tab is showing */
  tabClass: (id: Id) => string;
}

/**
 * A page's phone settings sheet, closed at first on tab `first`. The height the viewer sets is remembered per page in
 * this browser (under `key`), so it stays when they come back.
 */
export function useSettingsSheet<Id extends string>(key: string, first: Id): SettingsSheet<Id> {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Id>(first);
  const [heightPx, setHeightPx] = useStoredState<number | null>(`${key}.sheetHeight`, null);
  return {
    open,
    tab,
    show: (id) => {
      setTab(id);
      setOpen(true);
    },
    close: () => setOpen(false),
    heightPx,
    setHeightPx,
    tabClass: (id) => (tab === id ? "" : "max-md:hidden"),
  };
}

/** The page style that carries the sheet's height, for `SettingsLayout` (none until the viewer sets one). */
export const sheetHeightStyle = (px: number | null) =>
  px === null ? {} : { [SHEET_HEIGHT_VAR]: `${Math.round(px)}px` };

interface Props<Id extends string> {
  /** the page's settings sections, by id: their full names head the open sheet, and name the tabs */
  sections: Readonly<Record<Id, string>>;
  /** shorter tab names, where a section's name is too long for its tab */
  labels?: Readonly<Partial<Record<Id, string>>>;
  sheet: SettingsSheet<Id>;
  /** whether the open sheet shows its tab's full name as a heading (false while the body has its own: Compare) */
  heading?: boolean;
  /** called on every tap on a tab, before it opens or closes the sheet */
  onTab?: () => void;
}

/**
 * The phone settings sheet's top (the `top` of a `SettingsColumn` on phones): a bar, then the tab row, then the open
 * tab's full name. Tapping a tab opens the sheet on it; tapping the open tab again closes it. Dragging the bar sets the
 * sheet's height (dragging it well below its shortest closes it); a tap on the bar opens a closed sheet, or switches
 * an open one between half and full height. Hidden from md up, where the column shows everything.
 */
export function SettingsSheetTabs<Id extends string>({
  sections,
  labels,
  sheet,
  heading = true,
  onTab,
}: Props<Id>) {
  const bar = useRef<HTMLDivElement>(null);
  /** the pointer on the bar: where it went down, how far below the sheet's top, and whether it has moved */
  const drag = useRef<{ id: number; y: number; grab: number; moved: boolean; px: number } | null>(
    null,
  );
  /**
   * The sheet as drawn: the page that carries the height (`SettingsLayout`'s main), the sheet's whole height and the
   * part of it that is not the body (a `SettingsColumn`'s scrolling body is its last child), px.
   */
  const drawn = () => {
    const aside = bar.current?.closest("aside");
    const page = aside?.closest("main");
    const body = aside?.lastElementChild;
    if (!aside || !page || !body) return null;
    const total = aside.getBoundingClientRect().height;
    return {
      page,
      total,
      top: aside.getBoundingClientRect().top,
      chrome: total - body.getBoundingClientRect().height,
    };
  };
  /** draws the sheet `px` tall in all (no re-render per pointer move), and gives back the body's height for it */
  const draw = (px: number) => {
    const d = drawn();
    if (!d) return null;
    const body = Math.max(0, clampSheetHeight(px, innerHeight) - d.chrome);
    d.page.style.setProperty(SHEET_HEIGHT_VAR, `${Math.round(body)}px`);
    return body;
  };
  /** back to the stored height (after a cancelled drag, or a drag that closes the sheet) */
  const undraw = () => {
    const page = bar.current?.closest("main");
    if (sheet.heightPx === null) page?.style.removeProperty(SHEET_HEIGHT_VAR);
    else page?.style.setProperty(SHEET_HEIGHT_VAR, `${Math.round(sheet.heightPx)}px`);
  };
  const tap = () => {
    if (!sheet.open) return sheet.show(sheet.tab);
    const d = drawn();
    if (d) sheet.setHeightPx(draw(sheetTapHeight(d.total, innerHeight)));
  };
  return (
    <div className="md:hidden flex flex-col">
      <div
        ref={bar}
        role="separator"
        aria-orientation="horizontal"
        aria-label={UI_TEXT.settings}
        tabIndex={0}
        className="h-7 flex items-center justify-center cursor-ns-resize touch-none select-none rounded-t-lg"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const d = drawn();
          drag.current = {
            id: e.pointerId,
            y: e.clientY,
            grab: e.clientY - (d?.top ?? e.clientY),
            moved: false,
            px: d?.total ?? 0,
          };
        }}
        onPointerMove={(e) => {
          const p = drag.current;
          if (p?.id !== e.pointerId) return;
          if (!p.moved && Math.abs(e.clientY - p.y) < DRAG_START_PX) return;
          p.moved = true;
          if (!sheet.open) sheet.show(sheet.tab);
          // the sheet's top follows the finger
          p.px = innerHeight - e.clientY + p.grab;
          draw(p.px);
        }}
        onPointerUp={(e) => {
          const p = drag.current;
          if (p?.id !== e.pointerId) return;
          drag.current = null;
          if (!p.moved) return tap();
          if (sheetDragCloses(p.px, innerHeight)) {
            undraw();
            sheet.close();
          } else sheet.setHeightPx(draw(p.px));
        }}
        onPointerCancel={() => {
          drag.current = null;
          undraw();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            return tap();
          }
          const step = e.key === "ArrowUp" ? KEY_STEP_PX : e.key === "ArrowDown" ? -KEY_STEP_PX : 0;
          const d = drawn();
          if (!step || !sheet.open || !d) return;
          e.preventDefault();
          sheet.setHeightPx(draw(d.total + step));
        }}
      >
        <span className="block w-9 h-1 rounded-full bg-stone-300" />
      </div>
      <div className="flex gap-1 px-3 pb-2" role="tablist">
        {entriesOf(sections).map(([t, name]) => {
          const on = sheet.open && sheet.tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={on}
              onClick={() => {
                onTab?.();
                if (on) sheet.close();
                else sheet.show(t);
              }}
              className={`flex-1 basis-0 min-w-0 min-h-12 px-0.5 py-2 rounded border text-sm whitespace-nowrap overflow-hidden text-ellipsis ${on ? PRESSED_CLASSES : "border-stone-300 bg-stone-50"}`}
            >
              {labels?.[t] ?? name}
            </button>
          );
        })}
      </div>
      {sheet.open && heading && (
        <div className="px-4 pb-2">
          <SectionHeading>{sections[sheet.tab]}</SectionHeading>
        </div>
      )}
    </div>
  );
}
