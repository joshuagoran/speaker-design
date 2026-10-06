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
    return `No catalog sensitivity from ${maker}; their T/S parameters give ${ts}. Measure it.`;
  const gap = sens - tsSens;
  if (gap > SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${gap.toFixed(1)} dB above their T/S parameters (${ts}). Measure it, or use the lower value.`;
  if (gap < -SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${(-gap).toFixed(1)} dB below their T/S parameters (${ts}): the safe value.`;
  return `${maker}'s ${sens} dB claim agrees with their T/S parameters (${ts}).`;
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
              tip={`${DSP}: EQ, crossovers, delay. Amp limiters; ${HORN_AMP_SAFETY_HPF_HZ} Hz horn safety highpass.`}
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
                  )}; and 4 or 8 ${OHM}. ${QSC_GXD.brand}: use the speaker's continuous rating.`,
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
              ["1. Highpass", "LR24 at or slightly above the tuning. Match it in the planner."],
              [
                "2. Limiter power",
                `The lower of the sub's \u201c${STATS.firstLimit.label}\u201d power (when Xmax limits first) and the driver's rating; Medium or Aggressive. ${GXD8.model} maximum: ${GXD8.limiterW[1]} W.`,
              ],
              [
                "3. Check it",
                `Play a sine at the sub's \u201c${STATS.peakExcursion.label}\u201d frequency until the limit lights. The terminal AC volts should be \u221a(W \u00d7 8).`,
              ],
              [
                "4. Steeper or in volts",
                `Use the ${DSP}; keep the amp limiter as a backup. Not yet checked against its manual.`,
              ],
              [
                "Horns",
                `A ${GXD4.model} puts ${GXD4.w8} W on a ${DEFAULT_CD.aes} W AES driver like the ${DEFAULT_CD.name}. Set its limiter to the driver's rating, and the planner's HF amp slider to match.`,
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
            Xmax marks distortion, not damage (usually 2–3× further). After listening, 1.2–1.4× the
            Xmax voltage is common. Sources:{" "}
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
            Each output: 48 dB/oct highpass, peak limiter in volts or dBu with attack and release,
            slower RMS limiter, PEQ, delay. Balanced inputs at ~15 ft from the mixer.
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
            plus app). Keep the amp limiters as a backup.{" "}
            <Tooltip tip="Dayton DSP-408: RCA only, no limiter, 24 dB/oct max. miniDSP: balanced 8-out end of life; Flex 2×4. Xilica XP, Ashly Protea, BSS FDS-366T: discontinued. Symetrix: over budget. Maker manuals, search results, Sep 2026.">
              Why not the others?
            </Tooltip>
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Home inputs: Gemini MXR-01BT</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            Turntable, line and phone into one DSP and amps, with one master volume: a 2-channel DJ
            mixer.
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
                "The mixer master. Set the DSP and amp gains so full master is your maximum.",
              ],
              [
                "Booth out",
                "Spare RCA with its own level, for a fill or booth monitor through the DSP.",
              ],
              ["Turn-on", "Amps on last, off first."],
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
            . Without a mixer: a phono preamp, then an ART CleanBox Pro to balanced.
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Passive crossover: calibrate and build</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            For fills with no maker network (see each fill's note). 2nd-order 2-way: 6–8 parts,
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
                "Woofer and HF separately, no crossover: 1 m on-axis response (outdoors or gated), impedance, woofer + port near-field. Do not move the mic between drivers. Optional: 15/30/45° off axis.",
              ],
              [
                "3. Design",
                "In VituixCAD, tune the textbook network for a flat sum with no crossover dip. Use real part values; keep the impedance at 5 Ω or more.",
              ],
              [
                "4. Prototype on DSP (optional)",
                `Try the curves in the ${DSP} or amps. Match the passive design to the one you prefer.`,
              ],
              [
                "5. Test build",
                "Clip leads or a loose board outside the box. Compare with the simulation; set the HF level with spare pad resistors. Listen at gig level.",
              ],
              [
                "6. Final build",
                "Stripboard for the HF side; 14–16 AWG wire for the woofer path (~6 A at 300 W). Coils apart or at 90°, away from the magnet. Mount on foam, measure again in the box, then copy and check each.",
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
            <Tooltip tip="A weekend to measure and design, an evening to build.">
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
                "Cheap and flat. Verify the duct tuning, then copy its interior dimensions, not the cutlist.",
              ],
              [
                `Consider ${OTHER_THICKNESSES.join(" or ")} for the final boxes`,
                `Sub column drops ${DEFAULT_SUB_WEIGHTS.map((w) => w.lb).join(" \u2192 ")} lb loaded (${DEFAULT_SUB_WEIGHTS.map((w) => w.t).join(" \u2192 ")}), braces (${BRACES_BY_SIZE}) included. The extra volume shortens the duct.`,
              ],
              ["MDO for the baffles", "Paints much better than birch; no baffle edge shows."],
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
                `Ribs, window braces or both (one setting, under ${PA_SETTINGS_TABS.build}) until each panel's first resonance is above ${formatHz(PA_PANEL_TARGET_HZ)}. Handle recesses compete for the same area.`,
              ],
              ["Handles", "Recess type, depth and position on the sub; affects bracing."],
              [
                "Port edge finish",
                "Paint the slot ducts or mask the plywood edge. Seal the end grain in the mouth.",
              ],
              [
                "Duct tuning",
                "Verify Fb with an impedance sweep on the prototype; trim the duct before cutting birch. End correction is the largest error.",
              ],
              ["Sensitivity", sensitivityText()],
              [
                "Driver clearance",
                `Check the ${DEFAULT_SUB.name}'s frame and ${DEFAULT_SUB.depthIn != null ? `${DEFAULT_SUB.depthIn}" ` : ""}mounting depth against the baffle margin and all parts behind the magnet.`,
              ],
              [
                "Compression driver",
                `${DEFAULT_CD.name} at ${DEFAULT_CD.price} is the default. Confirm ~${DEFAULT_XO_HI} on the ${DEFAULT_HORN.name} with a distortion sweep.`,
              ],
              [
                "Horn print",
                `${DEFAULT_HORN.name} in one piece needs a ${DEFAULT_HORN.bedMm} mm+ bed, or print in sections. Or use a print service or a catalog horn.`,
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
