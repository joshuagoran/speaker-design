// The Speaker page's chamber fit checks, in the chips' style: a PA port's duct and tubes against its chamber (lib/pa/chips)
// and a chamber's hardware against its braces, drivers, vent and edges (lib/pa/hardware). The page shows them; the
// Speaker optimizer (lib/speaker/optimize) rules out a design that fails one. Pure.
import type { Chip, ChipId, SpeakerCabinet } from "../../types";
import type { CabinetBuild } from "./speakerBuild";
import { ductFitChip, hardwareFitChip, tubeFitChip } from "../pa/chips";
import { baffleInsetIn } from "./chamberAir";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { BRACING_CHIP_TEXT } from "../../constants/speakerResults";
import { NO_BRACING } from "../../constants/bracing";
import { braceShortfalls, strengthShortfalls } from "../bracing";
import { formatHz } from "../format";

/** A Speaker-page check. */
type SpeakerChip = Chip<ChipId<"speaker">>;

/**
 * Each chamber's fit checks, in the spec's order: a PA port's duct and tubes against the chamber, by the PA sub box's
 * rules (lib/pa/chips), and its hardware against its braces, drivers, vent and edges (lib/pa/hardware). Empty for a
 * chamber with neither.
 */
export function chamberFitChips(
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">,
  build: CabinetBuild,
): SpeakerChip[][] {
  const t = cabinet.panel.thicknessIn;
  return build.chambers.map((c, i) => {
    const chips: SpeakerChip[] = [];
    if (c.paSub) {
      const { box, style, vent, sub } = c.paSub;
      const duct = ductFitChip(box, style, vent, t, baffleInsetIn(cabinet), sub);
      if (duct) chips.push([...duct, "speakerDuctFit"]);
      const tubes = tubeFitChip(box, style, vent, t, sub.size);
      if (tubes) chips.push([...tubes, "speakerTubeFit"]);
    }
    if (c.hardware)
      chips.push([
        ...hardwareFitChip(c.hardware, `${SPEAKER_TEXT.chamber} ${i + 1}`),
        "speakerHardwareFit",
      ]);
    return chips;
  });
}

/** Whether chamber `index` has no bracing (`NO_BRACING`): no braces in its cutlist, its weight or its net air. */
export const chamberUnbraced = (cabinet: Pick<SpeakerCabinet, "braceStyle">, _index: number) =>
  cabinet.braceStyle === NO_BRACING;

/**
 * Each chamber's bracing check, in the spec's order: braced to its target, or under it (a panel under the target or over
 * a strength limit: the Details fold lists them). Empty for a chamber with no bracing (`chamberUnbraced`).
 */
export function chamberBraceChips(
  cabinet: Pick<SpeakerCabinet, "braceStyle">,
  build: Pick<CabinetBuild, "chambers">,
): SpeakerChip[][] {
  return build.chambers.map(({ bracing }, i): SpeakerChip[] => {
    if (chamberUnbraced(cabinet, i)) return [];
    const target = formatHz(bracing.targetHz);
    const short = braceShortfalls(bracing).length > 0 || strengthShortfalls(bracing).length > 0;
    return [
      short
        ? ["warn", BRACING_CHIP_TEXT.under, BRACING_CHIP_TEXT.underTip(target), "speakerBracing"]
        : ["ok", BRACING_CHIP_TEXT.meets, BRACING_CHIP_TEXT.meetsTip(target), "speakerBracing"],
    ];
  });
}
