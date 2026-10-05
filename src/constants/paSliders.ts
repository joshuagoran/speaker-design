import type { SliderSpec } from "../types";
import { PORT_TUBES } from "../data/catalog/port-tubes";

// the tube sliders run over the stock tube sets the catalogue holds
const tubeCounts = PORT_TUBES.map((p) => p.nt),
  tubeDias = PORT_TUBES.map((p) => p.dia);

/**
 * The PA planner's sliders for the fields the optimizer sets: their ranges and steps. The settings panel draws its
 * sliders from these, and the optimizer rounds its cards to them, so every card is a design the planner can show.
 */
export const PA_SLIDERS = {
  subW: { min: 18, max: 40, step: 0.5 },
  subH: { min: 18, max: 42, step: 0.5 },
  subD: { min: 14, max: 32, step: 0.5 },
  midW: { min: 10, max: 24, step: 0.5 },
  midH: { min: 10, max: 24, step: 0.5 },
  midD: { min: 8, max: 24, step: 0.5 },
  slotH: { min: 1.5, max: 9, step: 0.25 },
  /** the duct throat; a single vertical slot (vslot1) goes up to `PA_THROAT_MAX_VSLOT1` */
  throat: { min: 1, max: 7, step: 0.25 },
  tubes: { min: Math.min(...tubeCounts), max: Math.max(...tubeCounts), step: 1 },
  tubeDia: { min: Math.min(...tubeDias), max: Math.max(...tubeDias), step: 0.25 },
  ductLen: { min: 3, max: 30, step: 0.5 },
  hpf: { min: 20, max: 50, step: 1 },
  xoLo: { min: 60, max: 250, step: 5 },
  xoHi: { min: 500, max: 2000, step: 50 },
} as const satisfies Record<string, SliderSpec>;

/** A single vertical slot's widest throat, in. */
export const PA_THROAT_MAX_VSLOT1 = 10;
