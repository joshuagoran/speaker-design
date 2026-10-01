/** Section heading */
export function SectionHeading({ className = "", ...p }) {
  return <h2 {...p} className={`text-xl font-bold ${className}`} />;
}
