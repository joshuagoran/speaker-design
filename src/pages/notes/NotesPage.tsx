import { PA_SETTINGS_TABS } from "../../constants/paSettingsTabs";
import { Fragment } from "react";
import { PA_PANEL_TARGET_HZ } from "../../lib/pa/bracing";
import { formatHz } from "../../lib/format";
import { Tooltip } from "../../components/ui/Tooltip";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { SignalPath } from "../../components/drawings/SignalPath";
import {
  DSP_UNITS,
  HORN_AMP_SAFETY_HPF_HZ,
  RACK_DSP_IDS,
  RACKS,
  dspUnitById,
  formatPriceRange,
  mainsDsp,
  rackTotal,
} from "../../lib/data";
import { STATS } from "../../components/optimizer/StatRow";
import { GXD4, GXD8, QSC_GXD } from "../../data/catalog/amps";
import { FONT } from "../../styles/fonts";
import { PAGE_WIDTH, READING_WIDTH } from "../../styles/layout";
import type { DspColumn, DspUnit, DspUnitId } from "../../types";
import { DSP_COLUMNS } from "../../constants/dspColumns";
import { entriesOf, keysOf } from "../../lib/records";
import {
  DEFAULT_CD,
  DEFAULT_HORN,
  DEFAULT_SUB,
  DEFAULT_SUB_WEIGHTS,
  DEFAULT_WALL,
  DEFAULT_XO_HI,
} from "../../lib/defaultParts";

// The prose quotes the starting design's parts and the catalog's figures (defaultParts.ts), so a change of default
// part, price or rating shows up here.
const GXD = QSC_GXD.models;
const OHM = "Ω";
/** The mains rack's processor, as the prose names it. */
const DSP = mainsDsp().row.unit;
/** A DSP unit's name from the catalog, for the prose's pick. */
const dspName = (id: DspUnitId) => dspUnitById(id).row.unit;

/** A DSP table cell: the unit the racks use marked "(current)", a settled used price added to the price cell. */
function dspCell(u: DspUnit & { id: DspUnitId }, col: DspColumn): string {
  const text = u.row[col];
  if (col === "unit" && RACK_DSP_IDS.has(u.id)) return `${text} (current)`;
  if (col === "priceUs" && u.usedPrice) return `${text}, ${formatPriceRange(u.usedPrice)} used`;
  return text;
}

/** How far a sensitivity claim may sit from the T/S figure, either way, and still count as agreeing with it, dB. */
const SENS_AGREE_DB = 0.5;

/**
 * The default sub's published sensitivity against what its T/S give: within SENS_AGREE_DB either way it agrees; further
 * above it is flagged (assume the lower figure); further below it is the conservative one; with no claim entered, the
 * T/S figure alone.
 */
function sensitivityText(): string {
  const { maker, sens, tsSens } = DEFAULT_SUB;
  const ts = `${tsSens.toFixed(1)} dB/2.83V`;
  if (sens == null)
    return `The catalog has no sensitivity from ${maker}. Their published T/S parameters give ${ts}. Levels and limiter settings depend on it, so measure it.`;
  const gap = sens - tsSens;
  if (gap > SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${gap.toFixed(1)} dB above their own T/S parameters (${ts}). Levels and limiter settings depend on the correct value. Measure it, or use the lower value.`;
  if (gap < -SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${(-gap).toFixed(1)} dB below their own T/S parameters (${ts}). It is the safe value for levels and limiter settings. Measure to find the correct value.`;
  return `${maker}'s ${sens} dB claim agrees with their own T/S parameters (${ts}). Levels and limiter settings can use it. Measure to confirm it.`;
}

/** The plywood thicknesses the planner models other than the default wall, as the heading offers them. */
const OTHER_THICKNESSES = DEFAULT_SUB_WEIGHTS.filter((w) => w.t !== DEFAULT_WALL).map((w) => w.t);
/** The default sub's braces at each plywood size, as the rule puts them in. */
const BRACES_BY_SIZE = DEFAULT_SUB_WEIGHTS.map(
  (w) => `${w.t}: ${w.windows} window brace(s), ${w.ribs} rib(s)`,
).join("; ");

/** Notes page: reference material and parts research behind the design. */
export function NotesPage() {
  return (
    <main className={`${PAGE_WIDTH} pb-16`}>
      <div className={`${READING_WIDTH} flex flex-col gap-2`}>
        <section
          className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{ fontFamily: FONT }}
        >
          {RACKS.map((r) => {
            const total = rackTotal(r);
            return (
              <div key={r.id} className="border border-stone-300 rounded-lg p-4 bg-stone-50">
                <div className="flex justify-between items-baseline mb-1">
                  <SectionHeading>
                    <Tooltip tip={r.note}>{r.name}</Tooltip>
                  </SectionHeading>
                  <span className="text-sm tabular-nums text-stone-500">
                    ≈ {formatPriceRange(total)}
                  </span>
                </div>
                <div className="mb-3" />
                <ul className="text-sm text-stone-900 space-y-1">
                  {r.items.map(({ label, price }) => (
                    <li key={label} className="flex justify-between gap-3">
                      <span>{label}</span>
                      <span className="tabular-nums text-stone-500">{formatPriceRange(price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-2" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-2">Signal path (mains rack)</SectionHeading>
          <div className="max-w-4xl">
            <SignalPath />
          </div>
          <p className="text-sm text-stone-900 max-w-3xl mt-3">
            <Tooltip
              tip={`The ${DSP} does input EQ and master level, then crossovers, delay and driver EQ on each output. Each output feeds one full-range amp channel. Set each amp limiter from the driver's power and impedance, so it uses the real output voltage. A safety highpass at about ${HORN_AMP_SAFETY_HPF_HZ} Hz in the horn amp protects the horn from a wrong preset. A level limiter cannot do this.`}
            >
              How the DSP work is split
            </Tooltip>
          </p>
        </section>
        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">
            {`Amp DSP: ${QSC_GXD.brand} ${GXD.map((m) => m.model).join(" / ")}`}
          </SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "Power per channel",
                `${GXD.map((m) => `${m.model}: ${m.w8} W into 8 ${OHM}, ${m.w4} W into 4 ${OHM}.`).join(" ")} Continuous, both channels driven. Voltage gain ${GXD.map((m) => `${m.gainDb} dB (${m.model})`).join(", ")}.`,
              ],
              ["Filters", QSC_GXD.filters],
              [
                "Limiter",
                `${QSC_GXD.limiterModes}; a speaker power of ${[...GXD]
                  .reverse()
                  .map((m) => `${m.limiterW[0]}\u2013${m.limiterW[1]} W (${m.model})`)
                  .join(
                    " or ",
                  )}; and 4 or 8 ${OHM}. ${QSC_GXD.brand}: set the power to the speaker's continuous rating.`,
              ],
              ["What it can't do", QSC_GXD.limits],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="text-base font-medium mt-5 mb-2">
            Protecting an excursion-limited sub with the amp limiter
          </h3>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "1. Highpass",
                "At or slightly above the tuning, LR24. Set the planner's highpass to LR24 too.",
              ],
              [
                "2. Limiter power",
                `Use the lower value: the power in the sub's \u201c${STATS.firstLimit.label}\u201d row (when Xmax is the first limit), or the driver's rating. Use Medium or Aggressive. On a ${GXD8.model}, the maximum is ${GXD8.limiterW[1]} W, the amp's own limit.`,
              ],
              [
                "3. Check it",
                `Play a sine at the peak-excursion frequency (the sub's \u201c${STATS.peakExcursion.label}\u201d row). Increase the level until the limit indicator comes on. Measure the AC volts at the speaker terminals and compare with \u221a(W \u00d7 8).`,
              ],
              [
                "4. Steeper or in volts",
                `Do it in the ${DSP} before the amps. Keep the amp limiter as a backup. Not yet checked against the ${DSP} manual.`,
              ],
              [
                "Horns",
                `A ${GXD4.model} puts ${GXD4.w8} W on a ${DEFAULT_CD.aes} W AES driver like the ${DEFAULT_CD.name}. Its limiter, set to the driver's rating, gives the protection. Set the planner's HF amp slider to the same power, so its values match.`,
              ],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">
            At Xmax, distortion increases; damage starts later. The mechanical limit is usually 2–3×
            further. After a listening test, 1.2–1.4× the Xmax voltage is a common setting. Sources:{" "}
            {QSC_GXD.src.map((d, i) => (
              <Fragment key={d.url}>
                {i > 0 && ", "}
                <a className="underline" href={d.url}>
                  {d.name}
                </a>
              </Fragment>
            ))}
            .
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Crossover / DSP: PA2 and alternatives</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            Each output needs: a 48 dB/oct highpass, a peak limiter in volts or dBu with attack and
            release, a slower RMS limiter, PEQ and delay. At ~15 ft from the mixer, use balanced
            inputs. Outputs to amps in the same rack are less important.
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-300">
                  {entriesOf(DSP_COLUMNS).map(([col, h]) => (
                    <th
                      key={col}
                      className={`py-1 pr-4 font-normal ${col === "unit" ? "sticky left-0 bg-stone-50" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DSP_UNITS.map((u) => (
                  <tr key={u.id} className="border-b border-stone-300 align-top">
                    {keysOf(DSP_COLUMNS).map((col) => (
                      <td
                        key={col}
                        className={`py-1.5 pr-4 ${col === "unit" ? "font-medium min-w-[8rem] sm:whitespace-nowrap sticky left-0 bg-stone-50" : ""}`}
                      >
                        {dspCell(u, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-stone-900 mt-2 max-w-3xl">
            Pick: a used {dspName("driverack260")} on a budget; new, the {dspName("aqm408")}{" "}
            (limiters in dBu with attack and release, 4×8) or the {dspName("venu360")} (front panel
            plus app). In all cases, keep the amp limiters as a backup.{" "}
            <Tooltip tip="Not used: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (the only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from maker manuals; some prices from search results, Sep 2026.">
              Why not the others?
            </Tooltip>
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Home inputs: Gemini MXR-01BT</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            Turntable, line and phone into the same DSP and amps, with one master volume. A
            2-channel DJ mixer does all of this.
          </p>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "What it has",
                "2 channels, each switchable phono or line, 3-band EQ, Bluetooth input, 1/4″ mic, headphones, all-metal chassis.",
              ],
              [
                "Outputs",
                "Balanced 1/4″ TRS master (to the DSP), RCA master, and an RCA booth out with its own level.",
              ],
              [
                "Hook-up",
                "Master TRS → TRS-to-XLR-male cables → DSP inputs. Turntable ground wire to the mixer's ground post.",
              ],
              [
                "Volume",
                "Use the mixer master. Set the DSP input and amp gains so that full master is your maximum level. The DSP and amp limiters stay as a backup.",
              ],
              [
                "Booth out",
                "Spare RCA with its own level. It can feed a fill or booth monitor through the DSP.",
              ],
              [
                "Turn-on",
                "Turn on the mixer and sources first, the amps last. Turn off the amps first.",
              ],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">
            Source:{" "}
            <a className="underline" href="https://www.geminisound.com/products/mxr-01bt">
              Gemini MXR-01BT
            </a>
            . Without a mixer: a hi-fi preamp with phono, then RCA out through an ART CleanBox Pro
            to balanced.
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Passive crossover: calibrate and build</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            For fills that have no network from the maker (see each fill's note). A 2nd-order 2-way
            has 6–8 parts: woofer coil + cap, HF cap + coil, two pad resistors. Parts cost about
            $40–80 per box. Tune all values, not only the pad.
          </p>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "1. Gear (~$150, once)",
                "UMIK-1 mic, REW (free) to measure, VituixCAD (free) to design, and an impedance jig (Dayton DATS V3, or a resistor + soundcard in REW).",
              ],
              [
                "2. Measure in the finished box",
                "Woofer and HF separately, no crossover: response at 1 m on axis (outdoors or gated), impedance, and a near-field of woofer + port. Keep the mic in the same position for both drivers, so the phase stays valid. Optional: 15/30/45° off axis.",
              ],
              [
                "3. Design",
                "Import into VituixCAD. Start from the textbook network. Tune the values for a flat sum with no dip at the crossover. Round to real part values. Keep the minimum impedance at about 5 Ω or more.",
              ],
              [
                "4. Prototype on DSP (optional)",
                `Copy the target curves into the ${DSP} or the amps. Listen and measure. Then make the passive design match the curves you prefer.`,
              ],
              [
                "5. Test build",
                "Clip leads or a loose board outside the box. Compare the full speaker with the simulation. Change the pad resistors to set the HF level (buy some spare values). Listen at gig level.",
              ],
              [
                "6. Final build",
                "Stripboard is fine for the HF side. Wire the woofer path (~6 A at 300 W) in 14–16 AWG wire, not the strips, or wire point to point on a plywood board. Keep the coils apart or at 90° to each other, away from the woofer magnet. Mount on foam and measure again in the box. Copy for the other boxes and check each one.",
              ],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-stone-900 mt-3 max-w-3xl">
            <Tooltip tip="About a weekend to measure and design, and an evening to build and verify.">
              About 1 weekend
            </Tooltip>
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Materials</SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "Prototype in particleboard",
                "Cheap and flat. Build it to verify the duct tuning. Then use its interior dimensions, not the cutlist, for the real material.",
              ],
              [
                `Consider ${OTHER_THICKNESSES.join(" or ")} for the final boxes`,
                `Sub column drops ${DEFAULT_SUB_WEIGHTS.map((w) => w.lb).join(" \u2192 ")} lb loaded (${DEFAULT_SUB_WEIGHTS.map((w) => w.t).join(" \u2192 ")}). Thinner walls get more braces (${BRACES_BY_SIZE}); the weight includes them. The extra interior volume lowers Fb, so the duct is shorter.`,
              ],
              [
                "MDO for the baffles",
                "Paints much better than birch. No baffle edge shows, so its edges are not a problem.",
              ],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Still to decide</SectionHeading>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "Bracing",
                `The planner adds ribs, window braces or both, clear of the drivers and the vent, until each panel's first resonance is above ${formatHz(PA_PANEL_TARGET_HZ)}. One setting under ${PA_SETTINGS_TABS.build} sets the style for the whole stack. The cutlist, volume, weight and cutaway include the braces. Braces and handle recesses still compete for the same panel area.`,
              ],
              ["Handles", "Recess type, depth and position on the sub. This affects the bracing."],
              [
                "Port edge finish",
                "Paint the slot ducts, or mask them so the plywood edge shows. In both cases, seal the end grain in the mouth.",
              ],
              [
                "Duct tuning",
                "Verify Fb with an impedance sweep on the particleboard prototype. Trim the duct before you cut the birch. End correction is the largest error in the modeled Fb.",
              ],
              ["Sensitivity", sensitivityText()],
              [
                "Driver clearance",
                `Check the ${DEFAULT_SUB.name}'s frame and ${DEFAULT_SUB.depthIn != null ? `${DEFAULT_SUB.depthIn}" ` : ""}mounting depth against the baffle margin and all parts behind the magnet.`,
              ],
              [
                "Compression driver",
                `${DEFAULT_CD.name} at ${DEFAULT_CD.price} is the default. Do a distortion sweep to confirm the ~${DEFAULT_XO_HI} minimum crossover on the ${DEFAULT_HORN.name}.`,
              ],
              [
                "Horn print",
                `${DEFAULT_HORN.name} in one piece needs a ${DEFAULT_HORN.bedMm} mm+ bed; otherwise print it in sections. Options: your own filament, a print service, or a ready-made horn from the catalog.`,
              ],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                <span>
                  <span className="font-medium">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
