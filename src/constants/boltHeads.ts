// The bolt heads the aluminum horn plate is drawn and sized with, by the driver's thread (`CompressionDriver.body.bolts
// .thread`), in inches. The plate's holes need room for each head's flange (or washer) round them, clear of the slot
// and the plate's edges.
//   M5, M6: flanged button heads, ISO 7380-2 (flange dc 11.2 and 13.0 mm; dome dk 9.5 and 10.5 mm; height k 2.75 and
//   3.3 mm).
//   1/4-20: a button head, ASME B18.3 (head 0.437 in across, 0.132 in high), on a 1/4 in SAE flat washer, ASME B18.22.1
//   type A narrow (0.625 in outside).

const MM = 1 / 25.4;

/** A bolt head on the plate: its flange's (or washer's) radius and thickness, and its dome's radius and height, in. */
export interface PlateBoltHead {
  flangeR: number;
  flange: number;
  domeR: number;
  dome: number;
}

/** Each thread's head on the plate. */
export const PLATE_BOLT_HEADS: Partial<Record<string, PlateBoltHead>> = {
  M5: { flangeR: (11.2 / 2) * MM, flange: 1 * MM, domeR: (9.5 / 2) * MM, dome: 2.75 * MM },
  M6: { flangeR: (13 / 2) * MM, flange: 1.1 * MM, domeR: (10.5 / 2) * MM, dome: 3.3 * MM },
  "1/4-20": { flangeR: 0.625 / 2, flange: 0.065, domeR: 0.437 / 2, dome: 0.132 },
};
