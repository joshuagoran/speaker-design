interface TileProps {
  label: string;
  value: React.ReactNode;
  /** the change from your design (a `Delta`) */
  delta?: React.ReactNode;
}

/** One number of an optimizer result card, with its change from your design under it. */
export function CardTile({ label, value, delta }: TileProps) {
  return (
    <div className="bg-stone-50 border border-stone-300 rounded px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{label}</div>
      <div className="tabular-nums">{value}</div>
      {delta}
    </div>
  );
}

interface TilesProps {
  children: React.ReactNode;
}

/** A result card's tiles, two to a row; an odd last tile takes the whole row. */
export function CardTiles({ children }: TilesProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 [&>*:last-child:nth-child(odd)]:col-span-2">
      {children}
    </div>
  );
}
