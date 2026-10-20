import { useEffect, useState } from "react";
import { DRIVER_ICON_PATH, Icon, IconButton, STRIKE_ICON_PATH } from "../ui/IconButton";
import { UI_TEXT } from "../../constants/uiText";

/** A wedge opening from a point on the left to an edge on the right: a beam (a 16 px icon's path). */
const BEAM_ICON_PATH = "M2.5 8L13.5 3.5M2.5 8l11 4.5M13.5 3.5v9";

/** What the card's buttons set: how the view draws the design. */
export interface ViewerLook {
  /** the cabinet as a ghost, the parts inside showing */
  cutaway: boolean;
  /** the drivers drawn; false leaves their cutouts open (always true where the card has no drivers button) */
  drivers: boolean;
  /** each box's coverage wedge drawn (always true where the card has no beams button) */
  beams: boolean;
}

interface Props {
  /** the card's size and position while it isn't full screen */
  boxClassName: string;
  /** whether it opens in the cutaway (default: finished; the render tool sets it) */
  startCutaway?: boolean;
  /** a button that shows or hides the drivers (the Speaker page's view) */
  driversButton?: boolean;
  /** a button that shows or hides the boxes' beams (the Space page's view) */
  beamsButton?: boolean;
  /** the 3D view, drawn finished or in the cutaway, with or without its drivers */
  children: (cutaway: boolean, look: ViewerLook) => React.ReactNode;
}

/**
 * A 3D view's card, the Speaker page's, the Stack page's and the Space page's alike: the view with its buttons laid over
 * it, the cutaway, the drivers or the beams (where the page asks for them) and full screen. They are how you look at
 * the design, not part of it, so they live here and are never saved.
 */
export function Viewer3DCard({
  boxClassName,
  startCutaway = false,
  driversButton = false,
  beamsButton = false,
  children,
}: Props) {
  const [isFull, setIsFull] = useState(false);
  const [cutaway, setCutaway] = useState(startCutaway);
  const [drivers, setDrivers] = useState(true);
  const [beams, setBeams] = useState(true);
  useEffect(() => {
    if (!isFull) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFull(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [isFull]);
  return (
    <section
      className={
        isFull
          ? "fixed inset-0 z-50 bg-stone-50"
          : `rounded-lg overflow-hidden border border-stone-300 bg-stone-50 ${boxClassName}`
      }
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <IconButton label={UI_TEXT.cutaway} pressed={cutaway} onClick={() => setCutaway((v) => !v)}>
          {/* a box with its front corner cut away */}
          <Icon>
            <path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7z" />
            <path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v3" strokeDasharray="1.5 1.5" />
          </Icon>
        </IconButton>
        {driversButton && (
          <IconButton
            label={drivers ? UI_TEXT.hideDrivers : UI_TEXT.showDrivers}
            onClick={() => setDrivers((v) => !v)}
          >
            {/* a speaker seen from the side, struck through while the drivers are hidden */}
            <Icon>
              <path d={DRIVER_ICON_PATH} />
              {!drivers && <path d={STRIKE_ICON_PATH} />}
            </Icon>
          </IconButton>
        )}
        {beamsButton && (
          <IconButton
            label={beams ? UI_TEXT.hideBeams : UI_TEXT.showBeams}
            onClick={() => setBeams((v) => !v)}
          >
            {/* a wedge opening from a point, struck through while the beams are hidden */}
            <Icon>
              <path d={BEAM_ICON_PATH} />
              {!beams && <path d={STRIKE_ICON_PATH} />}
            </Icon>
          </IconButton>
        )}
        <IconButton
          label={isFull ? UI_TEXT.closeFullScreen : UI_TEXT.fullScreen}
          onClick={() => setIsFull((v) => !v)}
        >
          <Icon>
            {isFull ? (
              <path d="M4 4l8 8M12 4l-8 8" />
            ) : (
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            )}
          </Icon>
        </IconButton>
      </div>
      {children(cutaway, { cutaway, drivers, beams })}
    </section>
  );
}
