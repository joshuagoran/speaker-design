import type { MouseEvent } from "react";
import { FONT } from "../../styles/fonts";

interface Props<Id extends string> {
  /** the tabs: page id, label and link */
  tabs: readonly (readonly [Id, string, string])[];
  /** the page showing */
  current: Id;
  /** the navigation's accessible name, e.g. "Speaker pages" */
  label: string;
  /** opens a page (the link's own navigation is the fallback) */
  onNavigate: (id: Id, href: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
  /** the page's own actions, at the row's right end (the Space page's Share) */
  end?: React.ReactNode;
}

/** A project's row of page tabs under the header: every project shows its pages the same way. */
export function PageTabs<Id extends string>({ tabs, current, label, onNavigate, end }: Props<Id>) {
  return (
    <div className="flex items-end gap-4 mt-3 border-b border-stone-300">
      <nav className="flex gap-4" style={{ fontFamily: FONT }} aria-label={label}>
        {tabs.map(([v, text, href]) => (
          <a
            key={v}
            href={href}
            aria-current={current === v ? "page" : undefined}
            onClick={onNavigate(v, href)}
            className={`py-2 -mb-px border-b-2 text-sm ${current === v ? "border-cmy-c font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}
          >
            {text}
          </a>
        ))}
      </nav>
      {end && <div className="ml-auto flex items-center gap-2 pb-1">{end}</div>}
    </div>
  );
}
