import { FONT } from "../../styles/fonts";

interface Props {
  /** the card's label, its place among the cards, and how many there are */
  label: string;
  index: number;
  total: number;
  /** the card's heading */
  title: React.ReactNode;
  /** the card being previewed gets a dark outline */
  previewing?: boolean | null;
  children: React.ReactNode;
}

/** The frame of an optimizer result card: its outline, its label line and its heading; the page puts the rest inside. */
export function CardFrame({ label, index, total, title, previewing, children }: Props) {
  return (
    <div
      className={`bg-panel border rounded-lg p-3.5 flex flex-col gap-2.5 min-w-full md:min-w-0 snap-start ${previewing ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-300"}`}
    >
      <div className="text-xs uppercase tracking-wider font-bold text-stone-500">
        {label} · {index + 1} of {total}
      </div>
      <h3 className="text-lg leading-snug" style={{ fontFamily: FONT, fontWeight: 700 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
