import { Tooltip } from "../../components/ui/Tooltip.tsx";
import { SectionHeading } from "../../components/ui/SectionHeading.tsx";
import { SignalPath } from "../../components/drawings/SignalPath.tsx";
import { RACKS } from "../../lib/data.ts";

/** Notes page: reference material and parts research behind the design. */
export function NotesPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16 flex flex-col gap-2">
      <section
        className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6"
        style={{ fontFamily: "var(--font)" }}
      >
        {RACKS.map((r) => {
          const total = r.items.reduce((a, [, c]) => a + c, 0);
          return (
            <div key={r.id} className="border border-stone-300 rounded-lg p-4 bg-stone-50">
              <div className="flex justify-between items-baseline mb-1">
                <SectionHeading>
                  <Tooltip tip={r.note}>{r.name}</Tooltip>
                </SectionHeading>
                <span className="text-sm tabular-nums text-stone-500">
                  ≈ ${total.toLocaleString()}
                </span>
              </div>
              <div className="mb-3" />
              <ul className="text-sm text-stone-900 space-y-1">
                {r.items.map(([label, cost]) => (
                  <li key={label} className="flex justify-between gap-3">
                    <span>{label}</span>
                    <span className="tabular-nums text-stone-500">${cost}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-2">Signal path (mains rack)</SectionHeading>
        <div className="max-w-4xl">
          <SignalPath />
        </div>
        <p className="text-sm text-stone-900 max-w-3xl mt-3">
          <Tooltip tip="the PA2 holds input EQ and master level, then crossovers, delay and driver EQ on six outputs. Each output feeds one amp channel, set full-range, with the amp's own limiter configured from the driver's power and impedance so it references real output voltage. A safety high-pass around 500 Hz in the horn amp catches a mis-recalled preset, which a level limiter cannot.">
            How the DSP work is split
          </Tooltip>
        </p>
      </section>
      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Amp DSP: QSC GXD4 / GXD8</SectionHeading>
        <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
          {[
            [
              "Power per channel",
              "GXD4: 400 W into 8 \u03a9, 600 W into 4 \u03a9. GXD8: 800 W into 8 \u03a9, 1200 W into 4 \u03a9. Continuous, both channels driven. Voltage gain 33.5 dB (GXD4), 36.5 dB (GXD8).",
            ],
            [
              "Filters",
              "Linkwitz-Riley 24 dB/oct only. Highpass 20 Hz\u20134 kHz, lowpass 60 Hz\u20134 kHz. No Butterworth and nothing steeper. Plus a 4-band PEQ (\u00b112 dB, 0.1\u20133 oct) and 50 ms of delay.",
            ],
            [
              "Limiter",
              "\u201cSmart Speaker Protection\u201d: Mild, Medium or Aggressive; a speaker power of 5\u2013800 W (GXD8) or 5\u2013400 W (GXD4); and 4 or 8 \u03a9. QSC say to set the power to the speaker's continuous rating.",
            ],
            [
              "What it can't do",
              "No threshold in volts, no attack or release settings, no limiting confined to one band. QSC don't say how the power setting maps to a threshold (the spec sheet calls it a peak limiter, the manual an RMS limiter).",
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
              "The lower of the planner's \u201ccone reaches Xmax at X W\u201d and the driver's rating; Medium or Aggressive. On a GXD8 the ceiling is 800 W, which is just the amp's own limit.",
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
              "A GXD4 puts 400 W on a 35 W AES driver like the DE360. Its limiter, set to the driver's rating, is the protection; set the planner's HF amp slider to the same power so its numbers match.",
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
          Xmax is where distortion climbs, not where damage starts; the mechanical limit is usually
          2–3× further, so 1.2–1.4× the Xmax voltage is a common setting once you've listened.
          Sources:{" "}
          <a
            className="underline"
            href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_usermanual.pdf"
          >
            GXD user manual
          </a>
          ,{" "}
          <a
            className="underline"
            href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_specsheet.pdf"
          >
            GXD spec sheet
          </a>
          .
        </p>
      </section>

      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Crossover / DSP: PA2 and alternatives</SectionHeading>
        <p className="text-sm text-stone-900 mb-3 max-w-3xl">
          What the planner's protection needs per output: 48 dB/oct highpass, a peak limiter set in
          volts or dBu with attack and release, a slower RMS limiter, PEQ and delay. At ~15 ft from
          the mixer keep the inputs balanced; outputs to amps in the same rack matter less.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-stone-500 text-left border-b border-stone-300">
                {["Unit", "I/O", "Slopes", "Limiter", "PEQ / out", "Price (US)", "Notes"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`py-1 pr-4 font-normal ${i === 0 ? "sticky left-0 bg-stone-50" : ""}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "dbx DriveRack 260",
                  "2×6 XLR",
                  "LR to 48 (BW to 24)",
                  "dBu threshold; attack, hold, release",
                  "4",
                  "$995 new, ~$390 used",
                  "Best value: limits set straight from the amp's gain. Only 4 PEQ bands per output.",
                ],
                [
                  "dbx DriveRack VENU360",
                  "3×6 XLR",
                  "BW / LR to 48",
                  "Attack, hold, release; threshold vs full scale",
                  "8",
                  "$1,149 new, ~$750 used",
                  "Best overall: independent outputs, up to 1 s delay, app control.",
                ],
                [
                  "Behringer DCX2496",
                  "3×6 XLR (+AES)",
                  "BW / LR to 48",
                  "Per output, release only; units unclear",
                  "Shared pool",
                  "~$339",
                  "Budget pick. Steep slopes use up EQ filters. PC control over RS-232/485.",
                ],
                [
                  "Behringer DCX2496LE",
                  "2×6 XLR",
                  "BW / LR to 48",
                  "Same as DCX2496",
                  "Shared pool",
                  "~$289",
                  "Same DSP, but no third input, no digital I/O and no PC port: front panel only.",
                ],
                [
                  "Ashly AQM408",
                  "4×8 XLR",
                  "BW / LR / Bessel to 48; FIR (512 taps)",
                  "Brick-wall, peak detect, −20 to +20 dBu, attack & release; plus compressor (peak or average) for an RMS stage",
                  "PEQ blocks (count unconfirmed)",
                  "$999 new (Sweetwater, Full Compass, B&H), ~$800 used",
                  "Current. Meets every requirement; 2 spare outputs. Control is browser-only over Ethernet (no front-panel editing), so bring a phone or tablet on the rack's network.",
                ],
                [
                  "t.racks DSP 408",
                  "4×8 XLR",
                  "up to 48 (unconfirmed)",
                  "Attack, release; units unclear",
                  "9",
                  "$439",
                  "Thomann only in the US.",
                ],
                [
                  "dbx DriveRack PA2 (current)",
                  "2×6 XLR",
                  "BW / LR to 48",
                  "No attack or release; up to 3 dB overshoot",
                  "8, linked L/R",
                  "~$599, ~$366 used",
                  "Left and right share EQ and delay per band; 10 ms output delay.",
                ],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-stone-300 align-top">
                  {r.map((c, i) => (
                    <td
                      key={i}
                      className={`py-1.5 pr-4 ${i === 0 ? "font-medium min-w-[8rem] sm:whitespace-nowrap sticky left-0 bg-stone-50" : ""}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-stone-900 mt-2 max-w-3xl">
          Pick: a used DriveRack 260 on a budget; new, the Ashly AQM408 (limiters in dBu with attack
          and release, 4×8) or the VENU360 (front panel plus app). Keep the GXD limiters as a
          backstop either way.{" "}
          <Tooltip tip="Ruled out: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from manufacturer manuals; some prices from search snippets, Sep 2026.">
            Why not the others?
          </Tooltip>
        </p>
      </section>

      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Home inputs: Gemini MXR-01BT</SectionHeading>
        <p className="text-sm text-stone-900 mb-3 max-w-3xl">
          Turntable, line and phone into the same DSP and amps, with one master volume. A 2-channel
          DJ mixer does it all in one box.
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
          . Alternative without a mixer: a hi-fi preamp with phono, RCA out through an ART CleanBox
          Pro to balanced.
        </p>
      </section>

      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Passive crossover: calibrate and build</SectionHeading>
        <p className="text-sm text-stone-900 mb-3 max-w-3xl">
          For fills without a maker's network (FaitalPRO, Ciare, B&C 8″). A 2nd-order 2-way is 6–8
          parts: woofer coil + cap, HF cap + coil, two pad resistors. About $40–80 per box in parts.
          All values get tuned, not just the pad.
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

      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Materials</SectionHeading>
        <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
          {[
            [
              "Prototype in particleboard",
              "Cheap and flat. Build it to verify duct tuning, then transfer interior dimensions \u2014 not the cut list \u2014 to the real material.",
            ],
            [
              'Consider 5/8" or 1/2" for the final boxes',
              "Sub column drops 119 \u2192 107 \u2192 95 lb loaded. Needs more bracing, and the extra interior volume lowers Fb, so the duct gets shorter.",
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

      <section className="mt-8" style={{ fontFamily: "var(--font)" }}>
        <SectionHeading className="mb-3">Still to decide</SectionHeading>
        <ul className="text-sm text-stone-900 space-y-2 max-w-3xl">
          {[
            [
              "Baffle mounting",
              'Cleats (forgiving, costs 3/4" of interior on each side) or a stopped rabbet in the frame panels (tighter, squares the box, needs a dado). Baffle size changes with the choice.',
            ],
            [
              "Bracing",
              "Not drawn. Volume and weight allow for two braces. Center ribs, slat ladder or windowed shelves — decide once handle recesses are placed, since they compete for the same panel area.",
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
            [
              "Sensitivity",
              "SB's 99 dB claim is 3 dB above what their own published T/S parameters give (95.9 dB/2.83V). Everything about levels and limiter settings depends on which is right. Measure it, or assume the lower figure.",
            ],
            [
              "Driver clearance",
              "Check the Nero's frame and 8.4\" mounting depth against the baffle margin and anything that ends up behind the magnet.",
            ],
            [
              "Compression driver",
              "DE360 at $117 is the default; crossover floor on the A400G2 needs a distortion sweep to confirm ~1.1 kHz.",
            ],
            [
              "Horn print",
              "A400G2 in one piece needs a 400 mm+ bed; otherwise sectioned. Filament, print service, or buy the RX-28 instead.",
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
    </main>
  );
}
