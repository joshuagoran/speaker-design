/** UI copy more than one page shows the same way. */
export const UI_TEXT = {
  /** the toast when a save to the saved-designs store fails */
  saveFailed: "The save failed. Try again.",
  /** a Stack member's or a Space placement's toggle: its feed turned over (its pressure times −1) */
  invertPolarity: "Invert polarity",
  /** the settings column's title, and its name (and the phone sheet's bar's) for screen readers */
  settings: "Settings",
  /** the settings column's buttons that fold or open every section */
  collapseAll: "Collapse all",
  expandAll: "Expand all",
  /** after a price total when some part has no price, so the real total is higher */
  partialPriceMark: "+",
  /** an optimizer card's line when some part has no price, and its tip */
  partialPrices: "Partial prices",
  partialPricesTip: "Some drivers have no price. The real total is higher.",
  /** the conditions a sensitivity figure is quoted at */
  splConditions: "2.83 V, half space, 1 m",
  /** the PA stack's sub, as its results section and the system response chart name it */
  sub: "Sub",
  /** the PA stack's horn, as its results section and the system response chart name it */
  horn: "Horn",
  /** the PA stack's summary chart of the sub, mid-bass and horn together, and its heading */
  systemResponse: "System response",
  /** the PA stack's mid band, as its section, charts and legends name it */
  midBass: "Mid-bass",
  /** a room with no walls: the optimizer's room choice and the coverage map's */
  outdoors: "Outdoors",
  /** the coverage map's one-frequency slider and field */
  frequency: "Frequency",
  /** the coverage map's band choice that shows one frequency */
  oneFrequency: "One frequency",
  /** a room's width field (indoors) */
  roomWidth: "Width",
  /** the totals tiles: the purchased parts' price, and a Stack's height */
  price: "Price",
  height: "Height",
  /** the summary line of the Details drop-downs (each page's written details) */
  details: "Details",
  /** a chart's button that opens it large (a dialog, or the whole screen on a phone), and the 3D view's */
  expandChart: "Expand chart",
  expand3dView: "Expand 3D view",
  /** a button that closes what it is on: an expanded chart or 3D view, the driver comparison, a shared design */
  close: "Close",
  /** the 3D view's settings menu: its button, and each view option it turns on and off */
  settings3d: "3D settings",
  outlinesOnly: "Outlines only",
  /** the cabinet as a ghost, the parts inside showing */
  cutaway: "Cutaway",
  /** the 3D view's button that puts the camera back where it started */
  resetView: "Reset 3D view",
  /** the Speaker page's 3D view: the option that shows or hides the drivers (their cutouts stay open) */
  showDrivers: "Show the drivers",
  /** the Space's 3D view: the option that shows or hides each driver's aim line and its coverage edge lines */
  showAimCoverage: "Show aim/coverage",
  /** the side ducts' dividers' size, on the Speaker page's side ducts, and its tip */
  ductDividers: "Dividers",
  ductDividersTip: "Two per duct. Thicker dividers make the vent smaller, so it tunes lower.",
  /** under a compression driver's horn when the horn's throat and the driver's exit differ, by their sizes in words */
  hornExitMismatch: (horn: string, driver: string) =>
    `The horn throat (${horn}) and the driver exit (${driver}) are not the same size.`,
} as const;

/** An optimizer lock beside a setting (its screen-reader name), and the optimizer fold's line of what is locked. */
export const LOCK_TEXT = {
  lock: (name: string) => `Lock the ${name}`,
  unlock: (name: string) => `Unlock the ${name}`,
  /** the locked settings' names, in the order of the page */
  locked: (names: readonly string[]) => `Locked: ${names.length ? names.join(", ") : "nothing"}`,
  clear: "Clear locks",
} as const;
