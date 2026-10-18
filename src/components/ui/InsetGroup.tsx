import { GAP_Y } from "../../styles/layout";

interface Props {
  /** the group's small heading ("Size", "Drivers") */
  title: React.ReactNode;
  /**
   * whether its settings sit in a light inset box (default); false lists its children under the heading as they are
   * (boxes that fold, each its own box)
   */
  boxed?: boolean;
  children: React.ReactNode;
}

/** A sub-section of a settings card: a small heading over a light inset box of settings, or over a list of boxes. */
export function InsetGroup({ title, boxed = true, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-title text-stone-500">{title}</div>
      {boxed ? (
        <div className={`rounded border border-stone-300 p-2 ${GAP_Y}`}>{children}</div>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}
