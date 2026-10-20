/** UI copy more than one page shows the same way. */
export const UI_TEXT = {
  /** the toast when a save to the saved-designs store fails */
  saveFailed: "Couldn't save — try again",
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
  partialPricesTip: "Some drivers have no price; the real total is higher.",
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
  /** the summary line of the Details drop-downs (each page's written details, the optimizer's goal notes) */
  details: "Details",
  /** the 3D view's buttons: full screen and back, and the cutaway (the cabinet as a ghost, the parts inside showing) */
  fullScreen: "Full screen",
  closeFullScreen: "Close full screen",
  cutaway: "Cutaway",
  /** the Speaker page's 3D view: its button that shows or hides the drivers (their cutouts stay open) */
  showDrivers: "Show the drivers",
  hideDrivers: "Hide the drivers",
  /** the Space's 3D view: its button that shows or hides each box's coverage wedge */
  showBeams: "Show the beams",
  hideBeams: "Hide the beams",
  /** the side ducts' dividers' size, on the Speaker page's side ducts, and its tip */
  ductDividers: "Dividers",
  ductDividersTip: "Two per duct. Thicker dividers make the vent smaller, so it tunes lower.",
  /** under a compression driver's horn when the horn's throat and the driver's exit differ, by their sizes in words */
  hornExitMismatch: (horn: string, driver: string) =>
    `The horn throat (${horn}) and the driver exit (${driver}) are not the same size.`,
} as const;
