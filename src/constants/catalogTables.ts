/** Each catalog table's name, as a lookup's error message names it (`byIdOrThrow`'s `what`). */
export const CATALOG_TABLE_NAMES = {
  subs: "subwoofers",
  mids: "mid drivers",
  compressionDrivers: "compression drivers",
  horns: "horns",
  hifiWoofers: "hi-fi woofers",
  hifiTweeters: "hi-fi tweeters",
  passiveRadiators: "passive radiators",
  formats: "formats",
  cabinets: "cabinets",
  amps: "amps",
  dspUnits: "DSP units",
  mountAdapters: "mount adapters",
} as const;
