import { Button } from "./Button";
import { FoldBody, FoldHeading } from "./FoldHeading";
import type { FoldsAt } from "./FoldHeading";
import type { Folds } from "../../hooks/useFolds";
import { FONT } from "../../styles/fonts";
import { UI_TEXT } from "../../constants/uiText";

interface Props<Id extends string> {
  /** the column's name for screen readers */
  label?: string;
  /** the fold sections, for Collapse all / Expand all in the column's header; absent when the column has no folds */
  folds?: Folds<Id>;
  /** the widths the sections fold at; the header shows only there */
  foldsAt?: FoldsAt;
  /** shown above the scrolling part (the phone settings sheet's tabs) */
  top?: React.ReactNode;
  /** extra classes on the column (the phone settings sheet) */
  className?: string;
  /** extra classes on the scrolling part */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * A page's settings column, the right-hand pane of a `SettingsLayout`. From md up it scrolls on its own when taller than
 * the screen, so a setting can be changed beside the chart it affects.
 */
export function SettingsColumn<Id extends string>({
  label = UI_TEXT.settings,
  folds,
  foldsAt = "always",
  top,
  className = "",
  bodyClassName = "",
  children,
}: Props<Id>) {
  return (
    <aside
      aria-label={label}
      style={{ fontFamily: FONT }}
      className={`min-w-0 md:self-start md:flex md:flex-col md:max-h-[calc(100%-1rem)] md:border md:border-stone-300 md:rounded-lg ${className}`}
    >
      {top}
      {folds && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pb-2 md:px-4 md:py-2 ${foldsAt === "desktop" ? "max-md:hidden" : ""}`}
        >
          <h2 className="text-xl font-bold">{UI_TEXT.settings}</h2>
          <div className="flex gap-1">
            <Button size="xs" onClick={() => folds.setAll(false)}>
              {UI_TEXT.collapseAll}
            </Button>
            <Button size="xs" onClick={() => folds.setAll(true)}>
              {UI_TEXT.expandAll}
            </Button>
          </div>
        </div>
      )}
      <div
        className={`md:min-h-0 md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable] md:px-4 ${folds ? "" : "md:pt-3"} ${bodyClassName}`}
      >
        {children}
      </div>
    </aside>
  );
}

interface SectionProps<Id extends string> {
  id: Id;
  title: React.ReactNode;
  folds: Folds<Id>;
  /** the widths it folds at; on PA phones the heading hides, as the sheet's tabs group the settings there */
  foldsAt?: FoldsAt;
  /** one line of the section's current values, shown while it is folded */
  summary: React.ReactNode;
  children: React.ReactNode;
}

/** One named fold section of a settings column: a `FoldHeading` and the settings under it. */
export function SettingsSection<Id extends string>({
  id,
  title,
  folds,
  foldsAt = "always",
  summary,
  children,
}: SectionProps<Id>) {
  return (
    <section className={`mb-4 last:mb-0 ${foldsAt === "desktop" ? "max-md:mb-0" : ""}`}>
      <FoldHeading
        id={id}
        title={title}
        folds={folds.open}
        toggle={folds.toggle}
        foldsAt={foldsAt}
        summary={summary}
        level={3}
        // a light grey bar across the panel under a black rule, so each section starts clearly
        className={`mb-3 md:-mx-4 bg-stone-300 border-t-2 border-stone-900 ${foldsAt === "desktop" ? "max-md:hidden" : ""}`}
        buttonClassName="px-3 md:px-4"
      />
      <FoldBody open={folds.open[id]} foldsAt={foldsAt} className="pb-1">
        {children}
      </FoldBody>
    </section>
  );
}
