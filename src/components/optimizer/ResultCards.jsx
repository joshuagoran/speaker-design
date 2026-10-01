/** Grid of optimizer result cards. */
export function ResultCards({ cards, render }) {
  if (!cards.length) return null;
  return (<>
    <div className="mt-4 flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-1">{cards.map(render)}</div>
    {cards.length > 1 && <div className="md:hidden text-xs text-stone-500 text-center mt-1">Swipe for {cards.length - 1} more</div>}
  </>);
}
