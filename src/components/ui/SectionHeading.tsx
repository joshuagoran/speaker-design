type Props = React.HTMLAttributes<HTMLHeadingElement>;

/** Section heading, with a short bar in brand yellow (the accent color) before it */
export function SectionHeading({ className = "", ...p }: Props) {
  return <h2 {...p} className={`text-xl font-bold border-l-4 border-cmy-y pl-2 ${className}`} />;
}
