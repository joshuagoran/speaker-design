import { PAGE_WIDTH } from "../../styles/layout";
import { FONT } from "../../styles/fonts";

interface Props {
  /** the results pane: charts, totals and anything above them */
  results: React.ReactNode;
  /** the settings column (a `SettingsColumn`) */
  settings: React.ReactNode;
  /** extra classes on the page (the room a phone settings sheet needs at the bottom) */
  className?: string;
}

/**
 * A page with a settings column. From md up the page itself doesn't scroll: the results and the settings are two panes
 * below the header, each with its own scrollbar at its own right edge. On phones, one column that scrolls as a page.
 */
export function SettingsLayout({ results, settings, className = "" }: Props) {
  return (
    <main
      className={`${PAGE_WIDTH} pb-16 grid grid-cols-1 gap-8 md:h-full md:pb-0 md:gap-6 md:grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,1fr)_26rem] ${className}`}
      style={{ fontFamily: FONT }}
    >
      <div className="min-w-0 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable] md:pr-2 md:pb-16">
        {results}
      </div>
      {settings}
    </main>
  );
}
