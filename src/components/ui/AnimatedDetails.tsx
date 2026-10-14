import { useState } from "react";
import { useHeightAnimation } from "../../hooks/useHeightAnimation";

interface Props {
  summary: React.ReactNode;
  /** the content; as a function it is told whether the content shows (from the open click to the end of the close) */
  children: React.ReactNode | ((shown: boolean) => React.ReactNode);
  className?: string;
  summaryClassName?: string;
  /** whether it is open, when the parent decides (with `onOpenChange`); absent, it keeps its own state, closed at first */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** A `<details>` drop-down whose content slides open and shut, like the fold sections. */
export function AnimatedDetails({
  summary,
  children,
  className = "",
  summaryClassName = "",
  open: openProp,
  onOpenChange,
}: Props) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const [ref, shown] = useHeightAnimation(open);
  return (
    <details open={shown} className={className}>
      <summary
        className={summaryClassName}
        onClick={(e) => {
          e.preventDefault();
          setOwnOpen(!open);
          onOpenChange?.(!open);
        }}
      >
        {summary}
      </summary>
      <div ref={ref}>{typeof children === "function" ? children(shown) : children}</div>
    </details>
  );
}
