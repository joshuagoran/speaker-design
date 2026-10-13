// The Speaker page's chamber fit checks, in the chips' style: a PA port's duct and tubes against its chamber (lib/pa/chips)
// and a chamber's hardware against its braces, drivers, vent and edges (lib/pa/hardware). The page shows them; the
// Speaker optimizer (lib/speaker/optimize) rules out a design that fails one. Pure.
import type { Chip, ChipId, SpeakerCabinet } from "../../types";
import type { CabinetBuild } from "./speakerBuild";
import { ductFitChip, hardwareFitChip, tubeFitChip } from "../pa/chips";
import { baffleInsetIn } from "./chamberAir";
import { SPEAKER_TEXT } from "../../constants/speakerPage";

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
