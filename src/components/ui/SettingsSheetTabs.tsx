import { UI_TEXT } from "../../constants/uiText";

/** A `SettingsColumn`'s classes that make it the phone settings sheet: pinned to the bottom of the screen below md. */
export const SETTINGS_SHEET_CLASS =
  "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-lg max-md:shadow-sheet";

/** The phone settings sheet's scrolling body: under half the screen, and hidden while the sheet is closed. */
export const settingsSheetBodyClass = (open: boolean) =>
  `max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${open ? "" : "max-md:hidden"}`;

/** The room a page leaves at its bottom on phones for the settings sheet, open or closed. */
export const settingsSheetRoomClass = (open: boolean) =>
  open ? "max-md:pb-[52dvh]" : "max-md:pb-24";

interface Props<Id extends string> {
  /** the tabs: id and label */
  tabs: readonly (readonly [Id, string])[];
  /** whether the sheet is open */
  open: boolean;
  /** the tab showing while it is open */
  active: Id;
  /** opens the sheet on a tab */
  onOpen: (id: Id) => void;
  onClose: () => void;
}

/**
 * The phone settings sheet's tab row (the `top` of a `SettingsColumn` on phones): tapping a tab opens the sheet on it,
 * tapping the open tab again (or the close button) closes it. Hidden from md up, where the column shows everything.
 */
export function SettingsSheetTabs<Id extends string>({
  tabs,
  open,
  active,
  onOpen,
  onClose,
}: Props<Id>) {
  return (
    <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
      {tabs.map(([t, label]) => (
        <button
          key={t}
          role="tab"
          aria-selected={open && active === t}
          onClick={() => (open && active === t ? onClose() : onOpen(t))}
          className={`flex-1 px-2 py-2 rounded border text-sm ${open && active === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}
        >
          {label}
        </button>
      ))}
      {open && (
        <button
          onClick={onClose}
          aria-label={UI_TEXT.closeSettings}
          className="px-3 rounded border border-stone-300 bg-stone-50 text-sm"
        >
          ✕
        </button>
      )}
    </div>
  );
}
