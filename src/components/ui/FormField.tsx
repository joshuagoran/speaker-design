interface Props {
  label: React.ReactNode;
  htmlFor: string;
  extra?: React.ReactNode;
  /** the label at the left of its control on one short row (a filter that is off), not above it */
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Labeled form row: the label is a real <label> tied to its control, so screen readers name the control */
export function FormField({
  label,
  htmlFor,
  extra,
  inline = false,
  className = "",
  children,
}: Props) {
  if (inline)
    return (
      <div className={`grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 ${className}`}>
        <label htmlFor={htmlFor} className="text-sm font-label text-stone-500">
          {label}
        </label>
        {children}
      </div>
    );
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-label text-stone-500 mb-1 flex items-center justify-between gap-2"
      >
        <span>{label}</span>
        {extra}
      </label>
      {children}
    </div>
  );
}
