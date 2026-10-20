// Which page an address opens. Pure.
import { DEFAULT_PAGE, NOTES_PAGE, PAGE_HASHES, type AppPage } from "../constants/pages";
import { entriesOf } from "./records";

/** Whether a path is the Notes page's: it ends in `/notes` or `/notes/`. */
export const isNotesPath = (pathname: string) => /\/notes\/?$/.test(pathname);

/**
 * The page at an address: the nav page whose hash it carries (the part before an `&`, so a share link's
 * `#space&s=…` opens the Space page); else Notes, at the Notes path; else the Speaker Design
 * page (an empty or unknown hash, such as an old page's).
 */
export function pageAt(pathname: string, hash: string): AppPage {
  const page = hash.split("&")[0];
  const nav = entriesOf(PAGE_HASHES).find(([, h]) => h === page)?.[0];
  if (nav) return nav;
  return isNotesPath(pathname) ? NOTES_PAGE : DEFAULT_PAGE;
}
