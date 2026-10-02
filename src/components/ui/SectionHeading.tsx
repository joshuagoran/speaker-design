type Props = React.HTMLAttributes<HTMLHeadingElement>;

/** Section heading */
export function SectionHeading({ className = "", ...p }: Props) {
  return <h2 {...p} className={`text-xl font-bold ${className}`} />;
}
