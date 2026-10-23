import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon, IconButton } from "../ui/IconButton";
import {
  CloseIcon,
  EXPANDED_PANEL_CLASS,
  ExpandBackdrop,
  ExpandIcon,
  useExpanded,
} from "../ui/ExpandPanel";
import { ToggleMenu, type ToggleMenuItem } from "../ui/ToggleMenu";
import { UI_TEXT } from "../../constants/uiText";
import { ViewResetContext } from "./viewReset";
import { ViewOutlinesContext } from "./outlineScene";

/** A circle open at the top right, its arrowhead at the open end: back to the start (a 16 px icon's path). */
const RESET_ICON_PATH = "M13 8a5 5 0 1 1-1.46-3.54M13 2.5v3h-3";

/** Three sliders, each with its knob: the view's settings (a 16 px icon). */
function SettingsIcon() {
  return (
    <Icon>
      <path d="M2 4h5M10 4h4M2 8h2M7 8h7M2 12h7M12 12h2" />
      <circle cx="8.5" cy="4" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="12" r="1.5" />
    </Icon>
  );
}

/** What the card's buttons set: how the view draws the design. */
export interface ViewerLook {
  /** the cabinet as a ghost, the parts inside showing */
  cutaway: boolean;
  /** the drivers drawn; false leaves their cutouts open (always true where the card has no drivers button) */
  drivers: boolean;
  /** each driver's aim and coverage edge lines drawn (always true where the card has no beams button) */
  beams: boolean;
}

interface Props {
  /** the card's size and position while it isn't expanded */
  boxClassName: string;
  /** whether it opens in the cutaway (default: finished; the render tool sets it) */
  startCutaway?: boolean;
  /** an option that shows or hides the drivers (the Speaker page's view) */
  driversButton?: boolean;
  /** an option that shows or hides the drivers' beams (the Space page's view) */
  beamsButton?: boolean;
  /** the 3D view, drawn finished or in the cutaway, with or without its drivers */
  children: (cutaway: boolean, look: ViewerLook) => React.ReactNode;
}

/**
 * A 3D view's card, the Speaker page's, the Stack page's and the Space page's alike: the view with its buttons laid over
 * it. The settings menu turns on Outlines only, the cutaway, and the drivers or the beams (where the page asks for
 * them); then the camera's reset, and expand (the whole screen on a phone, a large box from md up). They are how you
 * look at the design, not part of it, so they live here and are never saved.
 */
export function Viewer3DCard({
  boxClassName,
  startCutaway = false,
  driversButton = false,
  beamsButton = false,
  children,
}: Props) {
  const [expanded, setExpanded] = useExpanded();
  const [outlines, setOutlines] = useState(false);
  const [cutaway, setCutaway] = useState(startCutaway);
  const [drivers, setDrivers] = useState(true);
  const [beams, setBeams] = useState(true);
  /** how many times the reset button was pressed: each press puts the camera back where it started */
  const [resets, setResets] = useState(0);
  const options: ToggleMenuItem[] = [
    { label: UI_TEXT.outlinesOnly, on: outlines, onToggle: () => setOutlines((v) => !v) },
    { label: UI_TEXT.cutaway, on: cutaway, onToggle: () => setCutaway((v) => !v) },
    ...(driversButton
      ? [{ label: UI_TEXT.showDrivers, on: drivers, onToggle: () => setDrivers((v) => !v) }]
      : []),
    ...(beamsButton
      ? [{ label: UI_TEXT.showAimCoverage, on: beams, onToggle: () => setBeams((v) => !v) }]
      : []),
  ];
  return (
    <>
      {/* the same element on the page and expanded, so the view keeps its renderer and camera */}
      <section
        className={
          expanded
            ? `${EXPANDED_PANEL_CLASS} overflow-hidden bg-stone-50`
            : `rounded-lg overflow-hidden border border-stone-300 bg-stone-50 ${boxClassName}`
        }
      >
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <ToggleMenu label={UI_TEXT.settings3d} icon={<SettingsIcon />} items={options} />
          <IconButton label={UI_TEXT.resetView} onClick={() => setResets((n) => n + 1)}>
            {/* a circular arrow */}
            <Icon>
              <path d={RESET_ICON_PATH} />
            </Icon>
          </IconButton>
          <IconButton
            label={expanded ? UI_TEXT.close : UI_TEXT.expand3dView}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <CloseIcon /> : <ExpandIcon />}
          </IconButton>
        </div>
        <ViewResetContext.Provider value={resets}>
          <ViewOutlinesContext.Provider value={outlines}>
            {children(cutaway, { cutaway, drivers, beams })}
          </ViewOutlinesContext.Provider>
        </ViewResetContext.Provider>
      </section>
      {expanded &&
        createPortal(<ExpandBackdrop onClose={() => setExpanded(false)} />, document.body)}
    </>
  );
}
