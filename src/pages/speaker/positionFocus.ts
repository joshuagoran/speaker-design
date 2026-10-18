// Which driver position field has focus, so the 2D view marks the point that field measures from. The Speaker page
// holds it (`usePositionFocusState`) and shares it with the settings column through `PositionFocusContext`; a position
// field spreads `positionFocusProps(...)` on itself (or on a wrapper round it) to set it while it has focus.
import { createContext, useContext, useState } from "react";
import { POSITION_AXIS, SPEAKER_VIEW, type SpeakerView } from "../../constants/speakerResults";
import type { PositionFocus } from "../../types";

/** The focus and its setter, as the context shares them. */
export interface PositionFocusState {
  focus: PositionFocus | null;
  setFocus: (focus: PositionFocus | null) => void;
}

/** The page's position focus; outside a page that provides it, nothing is marked. */
export const PositionFocusContext = createContext<PositionFocusState>({
  focus: null,
  setFocus: () => {},
});

/** The page's own focus state, to provide through `PositionFocusContext`. */
export function usePositionFocusState(): PositionFocusState {
  const [focus, setFocus] = useState<PositionFocus | null>(null);
  return { focus, setFocus };
}

/** The focus as a field reads it: the context's state. */
export const usePositionFocus = () => useContext(PositionFocusContext);

/**
 * The handlers a position field (or a wrapper round it: React's focus events bubble) takes so the view marks its
 * point while it has focus: `<div {...positionFocusProps(setFocus, { chamber, driver, axis })}>`.
 */
export const positionFocusProps = (
  setFocus: PositionFocusState["setFocus"],
  target: PositionFocus,
) => ({
  onFocus: () => setFocus(target),
  onBlur: () => setFocus(null),
});

/**
 * The 2D view the page shows: the one picked, unless a position field has focus; then the one that shows its point
 * (across and up on the front, back from the front edge on the side).
 */
export const shownView = (picked: SpeakerView, focus: PositionFocus | null): SpeakerView =>
  focus === null
    ? picked
    : focus.axis === POSITION_AXIS.back
      ? SPEAKER_VIEW.side
      : SPEAKER_VIEW.front;
