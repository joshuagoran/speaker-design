import { HEADING_GROUP } from "../../styles/layout";

interface Props<C> {
  cards: readonly C[];
  /** draws one card; give each a `key` */
  render: (card: C, index: number) => React.ReactNode;
}

/** Grid of optimizer result cards. */
export function ResultCards<C>({ cards, render }: Props<C>) {
  if (!cards.length) return null;
  return (
    <div className={HEADING_GROUP}>
      <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
        {cards.map(render)}
      </div>
      {cards.length > 1 && (
        <div className="md:hidden text-xs text-stone-500 text-center">
          Swipe for {cards.length - 1} more
        </div>
      )}
    </div>
  );
}
