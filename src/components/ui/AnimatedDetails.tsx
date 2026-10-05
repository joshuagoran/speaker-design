import { useState } from "react";
import { useHeightAnimation } from "../../hooks/useHeightAnimation";

interface Props {
  summary: React.ReactNode;
  /** the content; as a function it is told whether the content shows (from the open click to the end of the close) */
  children: React.ReactNode | ((shown: boolean) => React.ReactNode);
  className?: string;
  summaryClassName?: string;
}

/** A `<details>` drop-down whose content slides open and shut, like the fold sections. */
export function AnimatedDetails({
  summary,
  children,
  className = "",
  summaryClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [ref, shown] = useHeightAnimation(open);
  return (
    <details open={shown} className={className}>
      <summary
        className={summaryClassName}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        {summary}
      </summary>
      <div ref={ref}>{typeof children === "function" ? children(shown) : children}</div>
    </details>
  );
}
