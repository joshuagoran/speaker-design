/** "…" whose dots pulse in turn, for text that is still working: "Searching<Ellipsis />". Still under reduced motion. */
export function Ellipsis() {
  return (
    <span className="ellipsis" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}
