interface Props<Id extends string> {
  id: Id;
  title: React.ReactNode;
  /** whether each section is open, by id */
  folds: Record<Id, boolean>;
  toggle: (id: Id) => void;
  className?: string;
}

/** Section heading that folds its section on phones (always open from md up). */
export function FoldHeading<Id extends string>({
  id,
  title,
  folds,
  toggle,
  className = "",
}: Props<Id>) {
  return (
    <h2
      className={`text-xl ${className} ${folds[id] ? "" : "max-md:mb-0"}`}
      style={{ fontFamily: "var(--font)", fontWeight: 700 }}
    >
      <button
        onClick={() => toggle(id)}
        aria-expanded={!!folds[id]}
        className="w-full flex justify-between items-center text-left md:pointer-events-none md:cursor-default"
      >
        <span>{title}</span>
        <span className="md:hidden text-stone-500 text-base" aria-hidden="true">
          {folds[id] ? "\u2212" : "+"}
        </span>
      </button>
    </h2>
  );
}
