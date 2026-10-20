// Which page an address opens. Pure.
import { DEFAULT_PAGE, PAGE_HASHES, type AppPage } from "../constants/pages";
import { entriesOf } from "./records";

/**
 * The page at an address: the nav page whose hash it carries; else the Speaker Design page (an empty or unknown hash,
 * such as an old page's).
 */
export function pageAt(hash: string): AppPage {
  const nav = entriesOf(PAGE_HASHES).find(([, h]) => h === hash)?.[0];
  return nav ?? DEFAULT_PAGE;
}
