import type { MouseEvent } from "react";
import { FONT } from "../../styles/fonts";

interface Props<Id extends string> {
  /** the tabs: page id, label and link */
  tabs: readonly (readonly [Id, string, string])[];
  /** the page showing */
  current: Id;
  /** the navigation's accessible name, e.g. "PA stack pages" */
  label: string;
  /** opens a page (the link's own navigation is the fallback) */
  onNavigate: (id: Id, href: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
}

/** A project's row of page tabs under the header: every project shows its pages the same way. */
export function PageTabs<Id extends string>({ tabs, current, label, onNavigate }: Props<Id>) {
  return (
    <nav
      className="flex gap-4 mt-3 border-b border-stone-300"
      style={{ fontFamily: FONT }}
      aria-label={label}
    >
      {tabs.map(([v, text, href]) => (
        <a
          key={v}
          href={href}
          aria-current={current === v ? "page" : undefined}
          onClick={onNavigate(v, href)}
          className={`py-2 -mb-px border-b-2 text-sm ${current === v ? "border-stone-900 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}
        >
          {text}
        </a>
      ))}
    </nav>
  );
}
