import { HOVER_TRANSITION, PRESSED_CLASSES } from "./buttonStyles";

interface Props {
  /** what it does, as screen readers hear it and its tooltip shows it */
  label: string;
  onClick: () => void;
  /** a toggle's state (shown dark while on); absent: a plain action */
  pressed?: boolean;
  /** "sm": a smaller button for a row of settings (a driver's trash icon); default the views' size */
  size?: "sm" | "md";
  /** the icon: a 16 px SVG drawn in `currentColor` */
  children: React.ReactNode;
}

/** A square icon-only button, for the controls laid over a view (the 3D view's full screen and cutaway). */
export function IconButton({ label, onClick, pressed, size = "md", children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`${size === "sm" ? "w-[30px] h-[30px] shrink-0" : "w-9 h-9"} inline-flex items-center justify-center rounded border ${HOVER_TRANSITION} ${pressed ? PRESSED_CLASSES : "border-stone-300 bg-panel/90 hover:border-stone-500"}`}
    >
      {children}
    </button>
  );
}

/** The trash icon: delete the item it sits on. */
export function TrashIcon() {
  return (
    <Icon>
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.75 6.5v4.5M9.25 6.5v4.5" />
    </Icon>
  );
}

/** The share icon: an arrow up out of a box (send a link to what is open). */
export function ShareIcon() {
  return (
    <Icon>
      <path d="M8 10V1.5M5 4.5l3-3 3 3M4.5 7H3v7.5h10V7h-1.5" />
    </Icon>
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
