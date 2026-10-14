// Which page an address opens. Pure.
import { NOTES_PAGE, PAGE_HASHES, type AppPage } from "../constants/pages";
import { entriesOf } from "./records";

/** Whether a path is the Notes page's: it ends in `/notes` or `/notes/`. */
export const isNotesPath = (pathname: string) => /\/notes\/?$/.test(pathname);

/**
 * The page at an address: the nav page whose hash it carries; else Notes, at the Notes path; else the PA Design page
 * (an empty or unknown hash).
 */
export function pageAt(pathname: string, hash: string): AppPage {
  const nav = entriesOf(PAGE_HASHES).find(([v, h]) => v !== "planner" && h === hash)?.[0];
  if (nav) return nav;
  return isNotesPath(pathname) ? NOTES_PAGE : "planner";
}
