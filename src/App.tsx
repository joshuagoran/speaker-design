import { usePaPlanner } from "./pages/pa-stack/hooks/usePaPlanner";
import { PaStackPage } from "./pages/pa-stack/PaStackPage";
import { NotesPage } from "./pages/notes/NotesPage";
import { FillsPage } from "./pages/fills/FillsPage";
import { PaCutlistPage } from "./pages/cutlist/PaCutlistPage";
import { HifiCutlistPage } from "./pages/cutlist/HifiCutlistPage";
import { HifiPage } from "./pages/hifi/HifiPage";
import { CoveragePage } from "./pages/coverage/CoveragePage";
import { useHifiPlanner } from "./pages/hifi/useHifiPlanner";
import { useFillsPlanner } from "./pages/fills/useFillsPlanner";
import { useEffect, useState, type MouseEvent } from "react";
import { FONT } from "./styles/fonts";
import { PAGE_WIDTH } from "./styles/layout";
import { ThemeSwitch } from "./components/ui/ThemeSwitch";
import { PageTabs } from "./components/ui/PageTabs";
import { entriesOf } from "./lib/records";
import {
  PAGE_HASHES,
  PROJECT_NAMES,
  PROJECT_NAV_LABELS,
  PROJECT_PAGES,
  type AppPage,
  type ProjectId,
} from "./constants/pages";

/** The page at the address's hash; the PA Design page for an unknown or empty one. */
const viewOf = (): AppPage =>
  entriesOf(PAGE_HASHES).find(([v, h]) => v !== "planner" && h === window.location.hash)?.[0] ??
  "planner";

/** The project a page belongs to. */
const projectOf = (v: AppPage): ProjectId =>
  entriesOf(PROJECT_PAGES).find(([, pages]) => pages.some(([p]) => p === v))?.[0] ?? "pa";

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
  const project = projectOf(view);
  // two levels: the project (PA stack or hi-fi), then the project's own pages
  const navigateTo = (v: AppPage, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      history.replaceState(null, "", v === "planner" ? " " : href);
    } catch {}
    setView(v);
    window.scrollTo(0, 0);
  };
  return (
    // from md up the shell fills the window and doesn't scroll: the header stays, and the page below scrolls in its own
    // panes (one for Notes; results and settings for the others, see SettingsLayout)
    <div
      className="min-h-screen bg-stone-50 text-stone-900 md:min-h-0 md:h-dvh md:flex md:flex-col md:overflow-hidden"
      style={{ fontFamily: FONT }}
    >
      {/* the same scrollbar space as the page below, so the header lines up with it */}
      <div className="md:flex-none md:overflow-hidden md:[scrollbar-gutter:stable]">
        <header className={`${PAGE_WIDTH} pt-6 md:pt-8 pb-4`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">
              SpeakNow
            </h1>
            <nav className="flex gap-1" style={{ fontFamily: FONT }} aria-label="Projects">
              {entriesOf(PROJECT_NAMES).map(([p, label]) => {
                const home = PROJECT_PAGES[p][0][0],
                  on = p === project;
                return (
                  <a
                    key={p}
                    href={PAGE_HASHES[home]}
                    aria-current={on ? "page" : undefined}
                    onClick={navigateTo(home, PAGE_HASHES[home])}
                    className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
            <div className="ml-auto">
              <ThemeSwitch />
            </div>
          </div>
          <PageTabs
            tabs={PROJECT_PAGES[project].map(([v, label]) => [v, label, PAGE_HASHES[v]] as const)}
            current={view}
            label={PROJECT_NAV_LABELS[project]}
            onNavigate={navigateTo}
          />
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
        ) : view === "hifiCutlist" ? (
          <HifiCutlistPage hifi={hifi} />
        ) : view === "cutlist" ? (
          <PaCutlistPage planner={planner} />
        ) : view === "coverage" ? (
          <CoveragePage planner={planner} />
        ) : (
          <PaStackPage planner={planner} />
        )}
      </div>
    </div>
  );
}
