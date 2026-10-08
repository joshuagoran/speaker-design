import { useEffect, useState } from "react";
import { Icon, IconButton } from "../ui/IconButton";
import { UI_TEXT } from "../../constants/uiText";

interface Props {
  /** the card's size and position while it isn't full screen */
  boxClassName: string;
  /** whether it opens in the cutaway (default: finished; the render tool sets it) */
  startCutaway?: boolean;
  /** the 3D view, drawn finished or in the cutaway */
  children: (cutaway: boolean) => React.ReactNode;
}

/**
 * A 3D view's card, the PA stack's and the Hi-fi speaker's alike: the view with its buttons laid over it, the cutaway
 * and full screen. Both are how you look at the design, not part of it, so they live here and are never saved.
 */
export function Viewer3DCard({ boxClassName, startCutaway = false, children }: Props) {
  const [isFull, setIsFull] = useState(false);
  const [cutaway, setCutaway] = useState(startCutaway);
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
      {children(cutaway)}
    </section>
  );
}
