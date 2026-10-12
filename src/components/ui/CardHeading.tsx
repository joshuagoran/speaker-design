interface Props {
  children: React.ReactNode;
  /** a control at the heading's right end (a Remove button) */
  action?: React.ReactNode;
  /** a sub-heading inside a card (smaller, the same weight) */
  sub?: boolean;
  className?: string;
}

/**
 * A card's title, in the title weight: heavier than a field's label, which is heavier than its value. A sub-heading
 * names a group of fields inside the card.
 */
export function CardHeading({ children, action, sub = false, className = "" }: Props) {
  const Tag = sub ? "h5" : "h4";
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <Tag className={`font-title ${sub ? "text-sm" : "text-base"}`}>{children}</Tag>
      {action}
    </div>
  );
}
