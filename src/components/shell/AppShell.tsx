import { useState } from "react";
import { SHELL_TEXT } from "../../constants/shell";
import { Button } from "../ui/Button";

/** A side panel (library, inspector): set back from the drawing in the sunken gray, scrolling on its own from md up. */
const SIDE_PANEL_CLASS = "md:min-h-0 md:overflow-y-auto rounded-lg bg-sunken p-3";

interface Props {
  /** the top bar: where you are, and the four answers */
  top: React.ReactNode;
  /** the left panel: what you can add */
  library: React.ReactNode;
  /** the middle: the drawing, always in view */
  canvas: React.ReactNode;
  /** the right panel: the selected item's settings */
  inspector: React.ReactNode;
  /** the bottom panel: charts and checks, opened and closed with its button */
  results: React.ReactNode;
}

/**
 * One layout for every level (Stack today; Speaker and Space next): the drawing stays in the middle, with the library on
 * the left, the inspector on the right, and the results under them. From md up it fills the window and each panel
 * scrolls on its own; on a phone the panels stack, the drawing first.
 */
export function AppShell({ top, library, canvas, inspector, results }: Props) {
  const [resultsOpen, setResultsOpen] = useState(true);
  return (
    <div className="flex flex-col gap-3 px-4 md:px-8 pb-4 md:h-full md:min-h-0">
      <div className="md:flex-none">{top}</div>
      <div className="flex flex-col gap-3 md:flex-1 md:min-h-0 md:grid md:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className={`order-3 md:order-none ${SIDE_PANEL_CLASS}`}>{library}</aside>
        <main className="order-1 md:order-none min-h-[320px] md:min-h-0 overflow-hidden rounded-lg border border-stone-300 bg-panel p-3 flex flex-col">
          {canvas}
        </main>
        <aside className={`order-2 md:order-none ${SIDE_PANEL_CLASS}`}>{inspector}</aside>
      </div>
      <section
        aria-label={SHELL_TEXT.results}
        className={`rounded-lg border border-stone-300 bg-panel flex flex-col ${resultsOpen ? "md:h-[40%] md:min-h-0" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-stone-300">
          <h2 className="font-semibold">{SHELL_TEXT.results}</h2>
          <Button size="xs" onClick={() => setResultsOpen((open) => !open)}>
            {resultsOpen ? SHELL_TEXT.hideResults : SHELL_TEXT.showResults}
          </Button>
        </div>
        {resultsOpen && (
          <div className="p-3 md:flex-1 md:min-h-0 md:overflow-y-auto">{results}</div>
        )}
      </section>
    </div>
  );
}
