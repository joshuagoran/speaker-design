import { FONT } from "../../styles/fonts";

/**
 * The widths a section folds at: phones only (the result sections, always open from md up), md and up only (the PA
 * settings, which use tabs on phones), or every width (the Hi-fi settings).
 */
export type FoldsAt = "phone" | "desktop" | "always";

/** Tailwind classes that apply a class only at the widths a section folds at. */
const AT: Record<
  FoldsAt,
  { hidden: string; mb0: string; minH: string; only: string; inert: string }
> = {
  phone: {
    hidden: "max-md:hidden",
    mb0: "max-md:mb-0",
    minH: "max-md:min-h-11",
    only: "md:hidden",
    inert: "md:pointer-events-none md:cursor-default",
  },
  desktop: {
    hidden: "md:hidden",
    mb0: "md:mb-0",
    minH: "md:min-h-11",
    only: "max-md:hidden",
    inert: "max-md:pointer-events-none max-md:cursor-default",
  },
  always: { hidden: "hidden", mb0: "mb-0", minH: "min-h-11", only: "", inert: "" },
};

/** The class that hides a section's body while it is folded, at the widths it folds at. */
export const foldClass = (open: boolean, at: FoldsAt = "phone") => (open ? "" : AT[at].hidden);

interface Props<Id extends string> {
  id: Id;
  title: React.ReactNode;
  /** whether each section is open, by id */
  folds: Record<Id, boolean>;
  toggle: (id: Id) => void;
  className?: string;
  /** the widths it folds at (default: phones only) */
  foldsAt?: FoldsAt;
  /** one line of the section's current values, shown while it is folded */
  summary?: React.ReactNode;
  /** heading level: 2 for a page section, 3 for a section inside a panel */
  level?: 2 | 3;
}

/** Section heading that folds its section, at the widths `foldsAt` names; while folded it can show a one-line summary. */
export function FoldHeading<Id extends string>({
  id,
  title,
  folds,
  toggle,
  className = "",
  foldsAt = "phone",
  summary,
  level = 2,
}: Props<Id>) {
  const open = !!folds[id];
  const at = AT[foldsAt];
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag
      className={`${level === 2 ? "text-xl" : "text-base"} ${className} ${open ? "" : at.mb0}`}
      style={{ fontFamily: FONT, fontWeight: 700 }}
    >
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={open}
        className={`w-full flex justify-between items-center gap-3 text-left ${at.minH} ${at.inert}`}
      >
        <span className="min-w-0 flex-1 flex flex-col">
          <span>{title}</span>
          {summary != null && !open && (
            <span className={`text-sm font-normal text-stone-500 truncate ${at.only}`}>
              {summary}
            </span>
          )}
        </span>
        <span className={`${at.only} text-stone-500 text-base`} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
    </Tag>
  );
}
