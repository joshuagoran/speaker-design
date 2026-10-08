/**
 * Where a Hi-fi speaker's vent and passive radiators sit, inches: the 2D front drawing (drawings/HifiFront) and the 3D
 * view (stack-view/buildHifiScene) both place them from these (lib/hifi/boxLayout), so the two always agree.
 */
export const HIFI_BOX_LAYOUT = {
  /** round ports: side by side across the baffle's center line, this far apart edge to edge */
  portGapIn: 0.6,
  /** and their centers this far above the box bottom plus their radius */
  portLiftIn: 1,
  /** passive radiators: stacked up their panel from this far inside its wall, */
  radiatorMarginIn: 0.25,
  /** each its height plus this apart */
  radiatorGapIn: 0.5,
} as const;
