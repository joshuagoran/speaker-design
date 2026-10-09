import type { ChipId } from "../types";

/**
 * Every check's id, by the section whose chips carry it: one id per check, whatever its title says (a title may
 * carry a number, e.g. "Qtc 0.72"), so code decides on the id and never on the words. A check that names what sets
 * the level has one id per limit, since the optimizers treat those differently.
 */
export const CHIP_IDS = {
  sub: [
    "subDriverFit",
    "subDuctFit",
    "subTubeFit",
    "subWeight",
    "subPortLimited",
    "subExcursionLimited",
    "subAmpLimited",
    "subThermalLimited",
  ],
  mid: [
    "midDriverFit",
    "midQtc",
    "midRollOff",
    "midExcursionLimited",
    "midThermalLimited",
    "midAmpLimited",
    "midKeepsUp",
  ],
  horn: [
    "hornDriverMinXo",
    "hornMinXo",
    "hornLoading",
    "hornAmpLimited",
    "hornProgramLimited",
    "hornKeepsUp",
    "hornMidNarrower",
    "hornWiderThanRated",
    "hornMidWider",
  ],
  fill: [
    "fillDriverFit",
    "fillTuning",
    "fillPortLimited",
    "fillQtc",
    "fillKick",
    "fillHfHeadroom",
    "fillHfUnmodeled",
  ],
  hifi: [
    "hifiDispersion",
    "hifiTweeterMinXo",
    "hifiGuidePattern",
    "hifiGuideMount",
    "hifiTweeterResonance",
    "hifiCoaxGaps",
    "hifiWooferRange",
    "hifiQtc",
    "hifiSlotFit",
    "hifiPortFit",
    "hifiPortElbows",
    "hifiRadiatorSize",
    "hifiRadiatorMass",
    "hifiRoundover",
    "hifiTweeterOffsetIgnored",
    "hifiTweeterOffsetEdge",
    "hifiTweeterLevel",
    "hifiWooferLimit",
  ],
  hardware: ["subHardwareFit", "midHardwareFit"],
} as const;

/** The checks that name what sets a section's level; a result card says that in its "Limited by" line instead. */
export const LIMIT_CHIP_IDS: ReadonlySet<ChipId> = new Set<ChipId>([
  "subPortLimited",
  "subExcursionLimited",
  "subAmpLimited",
  "subThermalLimited",
  "midExcursionLimited",
  "midThermalLimited",
  "midAmpLimited",
  "hornAmpLimited",
  "hornProgramLimited",
  "hifiWooferLimit",
]);
