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
  formatPriceRange,
  rackTotal,
} from "../../lib/data";
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

// The prose quotes the starting design's parts and the catalogue's figures (defaultParts.ts), so a change of default
// part, price or rating shows up here.
const GXD = QSC_GXD.models;
const OHM = "Ω";

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
    return `${maker}'s sensitivity isn't in the catalogue; their published T/S parameters give ${ts}. Levels and limiter settings depend on it, so measure it.`;
  const gap = sens - tsSens;
  if (gap > SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${gap.toFixed(1)} dB above what their own published T/S parameters give (${ts}). Everything about levels and limiter settings depends on which is right. Measure it, or assume the lower figure.`;
  if (gap < -SENS_AGREE_DB)
    return `${maker}'s ${sens} dB claim is ${(-gap).toFixed(1)} dB below what their own published T/S parameters give (${ts}), so it is the conservative figure for levels and limiter settings; a measurement would tell which is right.`;
  return `${maker}'s ${sens} dB claim agrees with what their own published T/S parameters give (${ts}), so levels and limiter settings can rest on it; a measurement would confirm it.`;
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
              tip={`the PA2 holds input EQ and master level, then crossovers, delay and driver EQ on six outputs. Each output feeds one amp channel, set full-range, with the amp's own limiter configured from the driver's power and impedance so it references real output voltage. A safety high-pass around ${HORN_AMP_SAFETY_HPF_HZ} Hz in the horn amp catches a mis-recalled preset, which a level limiter cannot.`}
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
                  )}; and 4 or 8 ${OHM}. ${QSC_GXD.brand} say to set the power to the speaker's continuous rating.`,
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
            Protecting an excursion-limited sub with a GXD
          </h3>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "1. Highpass",
                "At or a little above tuning, LR24. Set the planner's highpass to LR24 to match.",
              ],
              [
                "2. Limiter power",
                `The lower of the planner's \u201ccone reaches Xmax at X W\u201d and the driver's rating; Medium or Aggressive. On a ${GXD8.model} the ceiling is ${GXD8.limiterW[1]} W, which is just the amp's own limit.`,
              ],
              [
                "3. Check it",
                "Play a sine at the frequency where excursion peaks (the planner's port-velocity row, just above tuning), raise it until the limit indicator lights, and measure AC volts at the speaker terminals. Compare with \u221a(W \u00d7 8).",
              ],
              [
                "4. Steeper or in volts",
                "Do it in the PA2 ahead of the amps and keep the GXD limiter as a backstop. Not yet checked against the PA2 manual.",
              ],
              [
                "Horns",
                `A ${GXD4.model} puts ${GXD4.w8} W on a ${DEFAULT_CD.aes} W AES driver like the ${DEFAULT_CD.name}. Its limiter, set to the driver's rating, is the protection; set the planner's HF amp slider to the same power so its numbers match.`,
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
            Xmax is where distortion climbs, not where damage starts; the mechanical limit is
            usually 2–3× further, so 1.2–1.4× the Xmax voltage is a common setting once you've
            listened. Sources:{" "}
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
            What the planner's protection needs per output: 48 dB/oct highpass, a peak limiter set
            in volts or dBu with attack and release, a slower RMS limiter, PEQ and delay. At ~15 ft
            from the mixer keep the inputs balanced; outputs to amps in the same rack matter less.
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
            Pick: a used DriveRack 260 on a budget; new, the Ashly AQM408 (limiters in dBu with
            attack and release, 4×8) or the VENU360 (front panel plus app). Keep the GXD limiters as
            a backstop either way.{" "}
            <Tooltip tip="Ruled out: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from manufacturer manuals; some prices from search snippets, Sep 2026.">
              Why not the others?
            </Tooltip>
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Home inputs: Gemini MXR-01BT</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            Turntable, line and phone into the same DSP and amps, with one master volume. A
            2-channel DJ mixer does it all in one box.
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
                "Use the mixer master. Set DSP input and amp gains so the master at full is the loudest you'll want; the DSP and amp limiters stay as a backstop.",
              ],
              [
                "Booth out",
                "Spare RCA with its own level: could feed a fill or booth monitor through the DSP.",
              ],
              ["Turn-on", "Mixer and sources first, amps last; amps off first."],
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
            . Alternative without a mixer: a hi-fi preamp with phono, RCA out through an ART
            CleanBox Pro to balanced.
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: FONT }}>
          <SectionHeading className="mb-3">Passive crossover: calibrate and build</SectionHeading>
          <p className="text-sm text-stone-900 mb-3 max-w-3xl">
            For fills without a maker's network (FaitalPRO, Ciare, B&C 8″). A 2nd-order 2-way is 6–8
            parts: woofer coil + cap, HF cap + coil, two pad resistors. About $40–80 per box in
            parts. All values get tuned, not just the pad.
          </p>
          <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
            {[
              [
                "1. Gear (~$150, once)",
                "UMIK-1 mic, REW (free) to measure, VituixCAD (free) to design, and an impedance jig (Dayton DATS V3, or a resistor + soundcard in REW).",
              ],
              [
                "2. Measure in the finished box",
                "Woofer and HF separately, no crossover: response at 1 m on axis (outdoors or gated), impedance, and a near-field of woofer + port. Don't move the mic between drivers, so the phase stays valid. Optional: 15/30/45° off axis.",
              ],
              [
                "3. Design",
                "Import into VituixCAD, start from the textbook network, tune values for a flat sum with no dip at the crossover. Round to real part values; keep the minimum impedance at about 5 Ω or above.",
              ],
              [
                "4. Prototype on DSP (optional)",
                "Copy the target curves into the PA2 or GXD, listen and measure, then match the passive design to what you liked.",
              ],
              [
                "5. Test build",
                "Clip leads or a loose board outside the box. Measure the whole speaker against the simulation; swap pad resistors to set the HF level (buy a few spare values). Listen at gig level.",
              ],
              [
                "6. Final build",
                "Stripboard is fine for the HF side; run the woofer path (~6 A at 300 W) in 14–16 AWG wire, not the strips, or wire point to point on a ply board. Space the coils or turn them 90° apart, away from the woofer magnet. Mount on foam, re-measure installed, copy for the other boxes and spot-check each.",
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
            <Tooltip tip="Roughly a weekend to measure and design, plus an evening to build and verify.">
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
                "Cheap and flat. Build it to verify duct tuning, then transfer interior dimensions \u2014 not the cut list \u2014 to the real material.",
              ],
              [
                `Consider ${OTHER_THICKNESSES.join(" or ")} for the final boxes`,
                `Sub column drops ${DEFAULT_SUB_WEIGHTS.map((w) => w.lb).join(" \u2192 ")} lb loaded (${DEFAULT_SUB_WEIGHTS.map((w) => w.t).join(" \u2192 ")}). Thinner walls take more bracing by rule (${BRACES_BY_SIZE}), counted in that weight, and the extra interior volume lowers Fb, so the duct gets shorter.`,
              ],
              [
                "MDO for the baffles",
                "Paints far better than birch, no edge penalty since no baffle edge is exposed.",
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
                "Baffle mounting",
                'Cleats (forgiving, costs 3/4" of interior on each side) or a stopped rabbet in the frame panels (tighter, squares the box, needs a dado). Baffle size changes with the choice.',
              ],
              [
                "Bracing",
                `By rule: ribs, window braces or both (set for each cabinet in its section of the planner) go in, clear of the drivers and the vent, until every panel's first resonance clears ${formatHz(PA_PANEL_TARGET_HZ)}; they are in the cutlist, the volume, the weight and the cutaway, where the drivers show too. Where they sit still competes with handle recesses for the same panel area.`,
              ],
              ["Handles", "Recess type, depth and position on the sub. Interacts with bracing."],
              [
                "Driver margins",
                "Currently equal at top and sides. One recommendation is to offset deliberately so baffle modes and diffraction paths don't coincide — likely inaudible below 100 Hz, so mostly a visual decision.",
              ],
              [
                "Port edge finish",
                "The letterbox mouths are cut in the shell's nose band, so this is a shell-material question, not a baffle one. Paint carried into the ducts, or masked so the ply edge shows — end grain in the mouth needs sealing either way.",
              ],
              [
                "Duct tuning",
                "Verify Fb by impedance sweep on the particleboard prototype and trim the duct before cutting birch. End correction is the largest source of error in the modelled Fb.",
              ],
              ["Sensitivity", sensitivityText()],
              [
                "Driver clearance",
                `Check the ${DEFAULT_SUB.name}'s frame and ${DEFAULT_SUB.depthIn != null ? `${DEFAULT_SUB.depthIn}" ` : ""}mounting depth against the baffle margin and anything that ends up behind the magnet.`,
              ],
              [
                "Compression driver",
                `${DEFAULT_CD.name} at ${DEFAULT_CD.price} is the default; crossover floor on the ${DEFAULT_HORN.name} needs a distortion sweep to confirm ~${DEFAULT_XO_HI}.`,
              ],
              [
                "Horn print",
                `${DEFAULT_HORN.name} in one piece needs a ${DEFAULT_HORN.bedMm} mm+ bed; otherwise sectioned. Filament, print service, or buy the RX-28 instead.`,
              ],
              [
                "Prototype material",
                '3/4" particleboard for the first sub, then transfer verified interior dimensions to birch.',
              ],
              [
                "Final panel thickness",
                '3/4" or braced 1/2" birch (switch it under Plywood in the planner). 1/2" needs bracing on roughly 12" centers and a doubler at the driver cutout. Decide before the prototype, since wall thickness changes the interior volume and therefore the duct length.',
              ],
              [
                "Baffle material",
                "MDO if the baffles are painted — no baffle edge is exposed in any of the current configurations, so there is no reason not to. Birch only if the baffle is ever meant to be clear-finished.",
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
