/**
 * The Notes page's DSP comparison table: each column's cell name (a field of every unit's row, `DspUnitRow`) and its
 * header, in the order the table shows them. Code reads a cell by its name, never by its position.
 */
export const DSP_COLUMNS = {
  unit: "Unit",
  io: "I/O",
  slopes: "Slopes",
  limiter: "Limiter",
  peqPerOutput: "PEQ / out",
  priceUs: "Price (US)",
  notes: "Notes",
} as const;
