import { HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";

interface Props {
  /** what it does, as screen readers hear it and its tooltip shows it */
  label: string;
  onClick: () => void;
  /** a toggle's state (shown dark while on); absent: a plain action */
  pressed?: boolean;
  /** the icon: a 16 px SVG drawn in `currentColor` */
  children: React.ReactNode;
}

/** A square icon-only button, for the controls laid over a view (the 3D view's full screen and cutaway). */
export function IconButton({ label, onClick, pressed, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`w-9 h-9 inline-flex items-center justify-center rounded border ${HOVER_TRANSITION} ${pressed ? PRESSED_CLASSES : "border-stone-300 bg-panel/90 hover:border-stone-500"}`}
    >
      {children}
    </button>
  );
}

/** A driver seen from the side, the magnet behind and the cone opening to the front (a 16 px icon's path). */
export const DRIVER_ICON_PATH = "M2 6h3v4H2zM5 6l8-4v12l-8-4";

/** A line struck through an icon, corner to corner: what it shows is hidden (a 16 px icon's path). */
export const STRIKE_ICON_PATH = "M1.5 14.5l13-13";

/** An icon's SVG: 16 px, stroked in `currentColor`. */
export function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
