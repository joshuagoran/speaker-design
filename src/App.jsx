import { usePaPlanner } from "./pages/pa-stack/hooks/usePaPlanner.js";
import { PaStackPage } from "./pages/pa-stack/PaStackPage.jsx";
import { NotesPage } from "./pages/notes/NotesPage.jsx";
import { FillsPage } from "./pages/fills/FillsPage.jsx";
import { CutlistPage } from "./pages/cutlist/CutlistPage.jsx";
import { HifiPage } from "./pages/hifi/HifiPage.jsx";
const { useEffect, useState } = React;

/** Hash of each page, and the page shown for an unknown or empty hash. */
const viewOf = () => (window.location.hash === "#notes" ? "notes" : window.location.hash === "#fills" ? "fills" : window.location.hash === "#hifi" ? "hifi" : window.location.hash === "#cutlist" ? "cutlist" : "planner");

/** The page shell: hash routing, the header navigation, and the planner state shared by the PA pages. */
export function App() {
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const planner = usePaPlanner();
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "var(--font)" }}>
      <header className="px-4 md:px-8 pt-6 md:pt-8 pb-4 max-w-6xl mx-auto">
        {(() => {
          // two levels: the project (PA stack or hi-fi), then the PA stack's own pages
          const navigateTo = (v, href) => (e) => { e.preventDefault(); try { history.replaceState(null, "", v === "planner" ? " " : href); } catch {} setView(v); window.scrollTo(0, 0); };
          const isPaProject = view !== "hifi";
          const projectLinks = [["planner", "PA Stack", "#", isPaProject], ["hifi", "Hi-fi", "#hifi", !isPaProject]];
          const paPageLinks = [["planner", "Design", "#"], ["cutlist", "Cutlist", "#cutlist"], ["fills", "Fills", "#fills"], ["notes", "Notes", "#notes"]];
          return (<>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h1 className="text-3xl md:text-4xl leading-tight font-extrabold tracking-tight">SpeakNow</h1>
            <nav className="flex gap-1" style={{ fontFamily: "var(--font)" }} aria-label="Projects">
              {projectLinks.map(([v, label, href, on]) => (
                <a key={v} href={href} aria-current={on ? "page" : undefined} onClick={navigateTo(v, href)}
                  className={`px-4 py-2 rounded border-2 text-base font-semibold ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</a>
              ))}
            </nav>
            </div>
            {isPaProject && (
              <nav className="flex gap-4 mt-3 border-b border-stone-300" style={{ fontFamily: "var(--font)" }} aria-label="PA stack pages">
                {paPageLinks.map(([v, label, href]) => (
                  <a key={v} href={href} aria-current={view === v ? "page" : undefined} onClick={navigateTo(v, href)}
                    className={`py-2 -mb-px border-b-2 text-sm ${view === v ? "border-stone-900 font-semibold" : "border-transparent text-stone-500 hover:text-stone-900"}`}>{label}</a>
                ))}
              </nav>
            )}
          </>);
        })()}
      </header>
      {view === "notes" ? <NotesPage /> : view === "fills" ? <FillsPage /> : view === "hifi" ? <HifiPage /> : view === "cutlist" ? <CutlistPage planner={planner} /> : <PaStackPage planner={planner} />}
    </div>
  );
}
