interface Props {
  label: React.ReactNode;
  htmlFor: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Labeled form row: the label is a real <label> tied to its control, so screen readers name the control */
export function FormField({ label, htmlFor, extra, className = "mb-4", children }: Props) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-sm text-stone-500 mb-1 flex items-center justify-between gap-2"
      >
        <span>{label}</span>
        {extra}
      </label>
      {children}
    </div>
  );
}
