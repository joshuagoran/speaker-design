import { PRESSED_CLASSES } from "./components/ui/buttonStyles";
import { NotesPage } from "./pages/notes/NotesPage";
import { SpeakerCutlistPage } from "./pages/cutlist/SpeakerCutlistPage";
import { StackCutlistPage } from "./pages/cutlist/StackCutlistPage";
import { SpeakerPage } from "./pages/speaker/SpeakerPage";
import { useSpeakerPage } from "./pages/speaker/useSpeakerPage";
import { StackPage } from "./pages/stack/StackPage";
import { useStack } from "./pages/stack/useStack";
import { SpacePage } from "./pages/space/SpacePage";
import { useSpace } from "./pages/space/useSpace";
import { useEffect, useState, type MouseEvent } from "react";
import { FONT } from "./styles/fonts";
import { PAGE_WIDTH } from "./styles/layout";
import { Notice } from "./components/ui/Notice";
import { DRAFT_FAILED_TEXT } from "./constants/pageDrafts";
import { ThemeSwitch } from "./components/ui/ThemeSwitch";
import { PageTabs } from "./components/ui/PageTabs";
import { IconButton, ShareIcon } from "./components/ui/IconButton";
import { useShareLink } from "./pages/space/useShareLink";
import { SHARE_TEXT } from "./constants/share";
import { entriesOf } from "./lib/records";
import { pageAt } from "./lib/pageRoute";
import {
  NOTES_PAGE,
  PAGE_HASHES,
  PROJECT_NAMES,
  PROJECT_NAV_LABELS,
  PROJECT_PAGES,
  type AppPage,
  type ProjectId,
} from "./constants/pages";

/** The page at the address (`pageAt`). */
const viewOf = (): AppPage => pageAt(window.location.pathname, window.location.hash);

/** The project a page belongs to (Notes, outside the nav, shows the Speaker project's tabs). */
const projectOf = (v: AppPage): ProjectId =>
  entriesOf(PROJECT_PAGES).find(([, pages]) => pages.some(([p]) => p === v))?.[0] ?? "speaker";

/** The page shell: hash routing, the header navigation, and the design state of every page (held here so it survives switching tabs). */
export function App({ draftFailed = false }: { draftFailed?: boolean }) {
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const speakerPage = useSpeakerPage();
  const stack = useStack();
  const space = useSpace();
  // a shared link opens on the Space page; the header shares the open Space from there
  const sharing = useShareLink(space.design, space.replaceDesign);
  const project = projectOf(view);
  // two levels: the project (Speaker, Stack, or Space), then its own pages
  const navigateTo = (v: AppPage, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      history.replaceState(null, "", href);
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
            <nav
              className="flex flex-wrap gap-1"
              style={{ fontFamily: FONT }}
              aria-label="Projects"
            >
              {entriesOf(PROJECT_NAMES).map(([p, label]) => {
                const home = PROJECT_PAGES[p][0][0],
                  on = p === project;
                return (
                  <a
                    key={p}
                    href={PAGE_HASHES[home]}
                    aria-current={on ? "page" : undefined}
                    onClick={navigateTo(home, PAGE_HASHES[home])}
                    className={`px-4 max-sm:px-2.5 py-2 whitespace-nowrap rounded border-2 text-base font-semibold ${on ? PRESSED_CLASSES : "border-stone-300 hover:border-stone-500"}`}
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
            end={
              view === "space" && (
                <>
                  {sharing.notice &&
                    (sharing.notice.problem ? (
                      <Notice>{sharing.notice.text}</Notice>
                    ) : (
                      <span className="text-xs text-green-700">{sharing.notice.text}</span>
                    ))}
                  <IconButton label={SHARE_TEXT.button} onClick={() => void sharing.share()}>
                    <ShareIcon />
                  </IconButton>
                </>
              )
            }
          />
        </header>
      </div>
      <div
        key={view}
        className="md:flex-1 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable]"
      >
        {draftFailed && (
          <div className={PAGE_WIDTH}>
            <Notice>{DRAFT_FAILED_TEXT}</Notice>
          </div>
        )}
        {/* Notes has no tab: it opens only at the path /notes */}
        {view === NOTES_PAGE ? (
          <NotesPage />
        ) : view === "speakerCutlist" ? (
          <SpeakerCutlistPage speakerPage={speakerPage} />
        ) : view === "stack" ? (
          <StackPage stack={stack} speakerPage={speakerPage} />
        ) : view === "stackCutlist" ? (
          <StackCutlistPage stack={stack} />
        ) : view === "space" ? (
          <SpacePage space={space} stack={stack} speakerPage={speakerPage} />
        ) : (
          <SpeakerPage speakerPage={speakerPage} />
        )}
      </div>
    </div>
  );
}
