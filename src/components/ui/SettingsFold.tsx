import { AnimatedDetails } from "./AnimatedDetails";
import { HOVER_TRANSITION } from "./buttonStyles";
import { GAP_Y } from "../../styles/layout";

interface Props {
  /** the fold's name, e.g. "Advanced" */
  title: string;
  /** the current values in a few words, after the name */
  summary?: string;
  children: React.ReactNode;
}

/**
 * A boxed fold inside a settings card, closed at first: settings most users leave alone (a horn's steps, a chamber's
 * position). Closed, its fields are hidden.
 */
export function SettingsFold({ title, summary, children }: Props) {
  return (
    <AnimatedDetails
      summary={summary ? `${title} · ${summary}` : title}
      className="text-sm rounded border border-stone-300 px-3 py-2"
      summaryClassName={`cursor-pointer py-1 font-label text-stone-500 hover:text-stone-900 ${HOVER_TRANSITION}`}
    >
      <div className={`pt-2 ${GAP_Y}`}>{children}</div>
    </AnimatedDetails>
  );
}
