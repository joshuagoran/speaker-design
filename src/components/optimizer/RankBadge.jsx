/** a goal's place in the priority order, floating on the button's corner so the label doesn't move */
export function RankBadge({ n }) {
  return (
    <span
      className="absolute -top-2 -left-2 min-w-[18px] h-[18px] px-1 rounded-full bg-cmy-a text-white text-xs font-bold leading-[18px] text-center"
      aria-label={`priority ${n}`}
    >
      {n}
    </span>
  );
}
