import { usePaPlanner } from "./pages/pa-stack/hooks/usePaPlanner";
import { PaStackPage } from "./pages/pa-stack/PaStackPage";
import { NotesPage } from "./pages/notes/NotesPage";
import { FillsPage } from "./pages/fills/FillsPage";
import { CutlistPage } from "./pages/cutlist/CutlistPage";
import { HifiPage } from "./pages/hifi/HifiPage";
import { CoveragePage } from "./pages/coverage/CoveragePage";
import { useHifiPlanner } from "./pages/hifi/useHifiPlanner";
import { useFillsPlanner } from "./pages/fills/useFillsPlanner";
import { useEffect, useState, type MouseEvent } from "react";
import { FONT } from "./styles/fonts";
import { PAGE_WIDTH } from "./styles/layout";
import { ThemeSwitch } from "./components/ui/ThemeSwitch";

/** The pages: the PA stack's five ("planner" is Design) and Hi-fi. */
type AppTab = "planner" | "coverage" | "cutlist" | "fills" | "notes" | "hifi";

/** Hash of each page, and the page shown for an unknown or empty hash. */
const viewOf = (): AppTab =>
  window.location.hash === "#notes"
    ? "notes"
    : window.location.hash === "#fills"
      ? "fills"
      : window.location.hash === "#hifi"
        ? "hifi"
        : window.location.hash === "#cutlist"
          ? "cutlist"
          : window.location.hash === "#coverage"
            ? "coverage"
            : "planner";

/** The page shell: hash routing, the header navigation, and the design state of every page (held here so it survives switching tabs). */
export function App() {
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const planner = usePaPlanner();
  const hifi = useHifiPlanner();
  const fills = useFillsPlanner();
  return (
    // from md up the shell fills the window and doesn't scroll: the header stays, and the page below scrolls in its own
    // panes (one for Cutlist and Notes; results and settings for the others, see SettingsLayout)
    <div
      className="min-h-screen bg-stone-50 text-stone-900 md:min-h-0 md:h-dvh md:flex md:flex-col md:overflow-hidden"
      style={{ fontFamily: FONT }}
    >
      {/* the same scrollbar space as the page below, so the header lines up with it */}
      <div className="md:flex-none md:overflow-hidden md:[scrollbar-gutter:stable]">
        <header className={`${PAGE_WIDTH} pt-6 md:pt-8 pb-4`}>
          {(() => {
            // two levels: the project (PA stack or hi-fi), then the PA stack's own pages
            const navigateTo = (v: AppTab, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              try {
                history.replaceState(null, "", v === "planner" ? " " : href);
              } catch {}
              setView(v);
              window.scrollTo(0, 0);
            };
            const isPaProject = view !== "hifi";
            const projectLinks: [AppTab, string, string, boolean][] = [
              ["planner", "PA Stack", "#", isPaProject],
              ["hifi", "Hi-fi", "#hifi", !isPaProject],
            ];
            const paPageLinks: [AppTab, string, string][] = [
              ["planner", "Design", "#"],
              ["coverage", "Coverage", "#coverage"],
              ["cutlist", "Cutlist", "#cutlist"],
              ["fills", "Fills", "#fills"],
              ["notes", "Notes", "#notes"],
            ];
            return (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">
                    SpeakNow
                  </h1>
                  <nav className="flex gap-1" style={{ fontFamily: FONT }} aria-label="Projects">
                    {projectLinks.map(([v, label, href, on]) => (
                      <a
                        key={v}
                        href={href}
                        aria-current={on ? "page" : undefined}
                        onClick={navigateTo(v, href)}
                        className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                  <div className="ml-auto">
                    <ThemeSwitch />
                  </div>
                </div>
                {isPaProject && (
                  <nav
                    className="flex gap-4 mt-3 border-b border-stone-300"
                    style={{ fontFamily: FONT }}
                    aria-label="PA stack pages"
                  >
                    {paPageLinks.map(([v, label, href]) => (
                      <a
                        key={v}
                        href={href}
                        aria-current={view === v ? "page" : undefined}
                        onClick={navigateTo(v, href)}
                        className={`py-2 -mb-px border-b-2 text-sm ${view === v ? "border-stone-900 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                )}
              </>
            );
          })()}
        </header>
      </div>
      <div
        key={view}
        className="md:flex-1 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable]"
      >
        {view === "notes" ? (
          <NotesPage />
        ) : view === "fills" ? (
          <FillsPage fills={fills} />
        ) : view === "hifi" ? (
          <HifiPage hifi={hifi} />
        ) : view === "cutlist" ? (
          <CutlistPage planner={planner} />
        ) : view === "coverage" ? (
          <CoveragePage planner={planner} />
        ) : (
          <PaStackPage planner={planner} />
        )}
      </div>
    </div>
  );
}
