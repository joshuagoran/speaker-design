// The Speaker page's limit checks, in the chips' style: one list per band (what sets its level, a datasheet driver's
// power) and one per chamber (its cones at the amp's full power against Xmax, the vent's and the radiators' limits and
// the program rating). Built from the spec and its limits (lib/speaker/speakerLimits).
import type {
  BandId,
  Chip,
  ChipId,
  LimitPeak,
  SpeakerChamberLimits,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../../types";
import { formatHz, formatWatts } from "../../lib/format";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { DRIVER_LIMIT_NAMES, LIMIT_NAMES, PER_FREQUENCY_LIMITS } from "../../constants/limits";
import { driverName } from "./speakerParts";
import { keepUpChip, speakerKeepUps } from "../../lib/speaker/keepUp";
import { dispersionChecks } from "../../lib/speaker/dispersionCheck";
import { hfHeadroomChip } from "../../lib/speaker/chips";
import { hfLimitWatts } from "../../lib/acoustics/boxModels";
import { bandLoads } from "../../lib/speaker/speakerLimits";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

/** A Speaker-page check. */
type SpeakerChip = Chip<ChipId<"speaker">>;

/** A peak against its limit: its share, %, rounded. */
const pctOf = (p: LimitPeak) => Math.round((100 * p.peak) / p.limit);

/**
 * Each band's checks, in the spec's order: what sets its level, a datasheet driver's power and, with the response, its
 * keep-up against the band under it at their crossover in the box (lib/speaker/keepUp); then, on the lower band of a
 * crossover, whether its beam matches the band over it (lib/speaker/dispersionCheck).
 */
export function bandChips(
  spec: Pick<SpeakerSpec, "bands" | "input" | "cabinet">,
  limits: SpeakerLimits,
  response?: Pick<SpeakerResponse, "bands">,
): { id: BandId; chips: SpeakerChip[] }[] {
  const keepUps = response ? speakerKeepUps(spec.bands, response, limits) : [];
  const dispersion = dispersionChecks(spec);
  const nameOf = (k: number) => {
    const id = response?.bands[k]?.id;
    return spec.bands.find((b) => b.id === id)?.name ?? id ?? "";
  };
  return limits.bands.map((b) => {
    const band = spec.bands.find((s) => s.id === b.id);
    const amp = band ? ` from the ${formatWatts(band.ampW)} amp` : "";
    // a cone or vent limit is at one frequency; the program rating and the amp hold across the band
    const mechanical = PER_FREQUENCY_LIMITS.has(b.who);
    const where =
      b.whoHz !== null
        ? ` The first limit is at ${formatHz(b.whoHz)}.${band?.highpass || spec.input.highpass ? "" : ` No high-pass or **${SPEAKER_TEXT.inputRange}** protects the cone.`}`
        : "";
    const bandText = `The band plays clean up to ${b.musicDb.toFixed(0)} dB at 1 m, with one drive for the whole band${amp}.${where}`;
    // the band's first datasheet driver (a compression driver, a tweeter, a coaxial's HF section)
    const hf = limits.drivers.find((d) => d.band === b.id);
    const hfChip = ((): SpeakerChip | null => {
      if (!hf) return null;
      const name = driverName(hf.driver);
      const derated =
        hf.derate < 1 && band?.highpass
          ? `, derated ${(-10 * Math.log10(hf.derate)).toFixed(1)} dB for the ${formatHz(band.highpass.hz)} high-pass`
          : "";
      return hf.who === LIMIT_NAMES.amp
        ? [
            "ok",
            "Amp-limited",
            `The ${name} takes ${formatWatts(hf.watts)}${amp}, under its program rating${derated}.`,
            "speakerHfPower",
          ]
        : [
            "ok",
            "Program-limited",
            `Its program rating (2 × AES) limits the ${name} to ${formatWatts(hf.watts)}${derated}.`,
            "speakerHfPower",
          ];
    })();
    // a passive band's HF section behind a pad (its Level below 0) on the amp it shares: where it reaches its rating,
    // no chip without a pad
    const pad = Math.max(0, -(band?.levelDb ?? 0));
    const padChip: SpeakerChip | null =
      hf && band?.drive === HIFI_DRIVE.passive && pad > 0
        ? [
            ...hfHeadroomChip(
              pad,
              hf.programW,
              hfLimitWatts(hf.programW, hf, pad, bandLoads(spec).get(b.id) ?? {}),
              band.ampW,
            ),
            "speakerHfPad",
          ]
        : null;
    // the driver's power check says the same as the band's limit (both the amp, or both the program rating): one chip
    const same = hfChip !== null && hf?.who === b.who;
    const chips: SpeakerChip[] = [
      [
        mechanical ? "warn" : "ok",
        `Limited by ${DRIVER_LIMIT_NAMES[b.who]}`,
        same ? `${bandText} ${hfChip[2]}` : bandText,
        "speakerBandLimit",
      ],
      ...(hfChip && !same ? [hfChip] : []),
      ...(padChip ? [padChip] : []),
      ...keepUps
        .filter((k) => response?.bands[k.upper]?.id === b.id)
        .map((k): SpeakerChip => [
          ...keepUpChip(k, nameOf(k.lower), nameOf(k.upper)),
          "speakerKeepsUp",
        ]),
      ...dispersion
        .filter((k) => k.lower === b.id)
        .map((k): SpeakerChip => [...k.chip, "speakerDispersion"]),
    ];
    return { id: b.id, chips };
  });
}

/** A chamber's checks: its cones at the amp's full power through their band's (named `bandName`) filters. */
export function chamberChips(c: SpeakerChamberLimits, bandName: string): SpeakerChip[] {
  const { excursion, port, radiator, throat } = c;
  const band = `${bandName} band`;
  const chips: SpeakerChip[] = [
    excursion.peak > excursion.limit
      ? [
          "warn",
          "Passes Xmax at full power",
          `With the ${band} at full power the cone reaches ${pctOf(excursion)}% of its ${excursion.limit.toFixed(1)} mm Xmax at ${formatHz(excursion.hz)}.`,
          "speakerExcursion",
        ]
      : [
          "ok",
          "Inside Xmax at full power",
          `At most ${pctOf(excursion)}% of its ${excursion.limit.toFixed(1)} mm Xmax (${formatHz(excursion.hz)}).`,
          "speakerExcursion",
        ],
  ];
  // a drawn horn's vent: its air speed shown, with no limit
  if (port && !Number.isFinite(port.limit))
    chips.push([
      "ok",
      "Vent air speed",
      `At most ${port.peak.toFixed(1)} m/s at full power (${formatHz(port.hz)}).`,
      "speakerPortSpeed",
    ]);
  else if (port)
    chips.push(
      port.peak > port.limit
        ? [
            "warn",
            "Port too fast at full power",
            `${port.peak.toFixed(1)} m/s at ${formatHz(port.hz)}, over the ${port.limit.toFixed(1)} m/s it takes. Use a larger port.`,
            "speakerPortSpeed",
          ]
        : [
            "ok",
            "Port speed inside its limit",
            `At most ${port.peak.toFixed(1)} m/s (${formatHz(port.hz)}), under the ${port.limit.toFixed(1)} m/s it takes.`,
            "speakerPortSpeed",
          ],
    );
  // a horn's throat air speed: shown, with no guide (no common figure for a horn throat)
  if (throat)
    chips.push([
      "ok",
      "Throat air speed",
      `At most ${throat.peak.toFixed(1)} m/s at the horn throat at full power (${formatHz(throat.hz)}).`,
      "speakerThroatSpeed",
    ]);
  if (radiator)
    chips.push(
      radiator.peak > radiator.limit
        ? [
            "warn",
            "Radiators pass Xmax at full power",
            `${pctOf(radiator)}% of their ${radiator.limit.toFixed(1)} mm Xmax at ${formatHz(radiator.hz)}.`,
            "speakerRadiatorTravel",
          ]
        : [
            "ok",
            "Radiators inside Xmax",
            `At most ${pctOf(radiator)}% of their ${radiator.limit.toFixed(1)} mm Xmax (${formatHz(radiator.hz)}).`,
            "speakerRadiatorTravel",
          ],
    );
  const amp = `The amp gives ${formatWatts(c.driveW)}`;
  const rating = `the driver's ${formatWatts(c.programW)} program rating (2 × AES)`;
  chips.push(
    // the same when they read the same (an amp sized to the rating)
    formatWatts(c.driveW) === formatWatts(c.programW)
      ? ["ok", "Amp at the program rating", `${amp}: ${rating}.`, "speakerPower"]
      : c.driveW > c.programW
        ? ["ok", "Program rating limits first", `${amp}, over ${rating}.`, "speakerPower"]
        : ["ok", "Amp under the program rating", `${amp}, under ${rating}.`, "speakerPower"],
  );
  return chips;
}
