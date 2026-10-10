# Handoff: a custom front end for the PA

A brief for a research session. Explore a "front end" that sits between the sources and the amps: a line mixer,
compression and EQ, crossovers and delay compensation, mostly analog. It can be one custom box, a rack of
commercial units, or a mix. The owner sees it as an analog alternative to the v1 plan, likely paired with class H amps (no DSP). This is
research and a recommendation, not a build. Nothing here is decided.

## Context

- **System.** A stereo 3-way PA: per side, 1 sub, 1 mid (12″) and 1 horn (compression driver). Fills may come
  later. Planner defaults are in `src/lib/defaults.ts` (`DEFAULT_PA`).
- **Amps today.** The v1 plan ([amp-dsp-v1.md](amp-dsp-v1.md)) runs a QSC PLD 4.2 and a QSC GXD4 with their
  built-in DSP. A front end could replace that DSP, or sit before it and leave the amps flat.
- **Analog alternative.** Class H amps with no DSP (for example used QSC RMX or Crest CA series
  _(unverified)_). The front end then does every crossover, delay and limit, horn protection included.
- **Crossovers.** Sub to mid at the planner's sub crossover (default 120 Hz). Mid to horn at about 950 Hz–1 kHz
  (the DIY R-OSSE horn needs 950 Hz or more). Linkwitz-Riley 24 dB/oct. A BW24 subsonic high-pass near 31 Hz.
- **Delays needed.**
  - Mid vs horn: the compression driver sits about 200 mm or more behind the mid cone, so the mid needs about
    0.6 ms.
  - Sub vs top: a few ms at most, set by placement and polarity today.
  - Fills: 10–50 ms. Analog all-pass can't do this; see below.
- **Horn protection.** The N314T is rated 28 V RMS into 8 Ω. Any front end that leaves the amps flat must still
  cap the horn (a limiter with a threshold in volts at the amp's gain).

## What analog delay compensation can do

From the owner's earlier discussion; verify the numbers.

- An analog all-pass section passes every frequency at the same level but delays the low ones. A first-order
  section (one op-amp, R and C) gives a delay of 2·R·C, flat below a corner frequency and falling above it.
- One first-order section gives about 1 ms held within about 10% up to about 100 Hz. That covers the sub-to-top
  offset at an 80–120 Hz crossover. The 0.6 ms mid delay must hold up to about 1 kHz, which needs a much smaller
  RC per section and likely several sections. Work out how many.
- A pot for R makes the delay adjustable (a dual pot for a second-order section). Fixed values suit offsets the
  cabinet sets; a knob suits offsets that change with each setup.
- Chained sections add delay, but parts and noise add up. Long delays (fills) need real delay: digital, or
  historically bucket-brigade (BBD) chips.

## Options to compare

1. **All commercial, analog.** A rack of used units: a line mixer, a stereo compressor or limiter, a stereo
   graphic or parametric EQ, and a stereo 3-way analog crossover. Find out which analog crossovers have a delay or
   phase control and how much (some older ones may; verify each).
2. **One custom box.** Line inputs and a master, a bus compressor, system EQ, LR24 crossovers, all-pass delay on
   the mid and sub outputs, and per-output limiters. Look at proven designs to build from, e.g. Elliott Sound
   Products (sound-au.com) projects and Linkwitz Lab's crossover and all-pass pages.
3. **Hybrid.** Commercial mixer and dynamics, plus a custom crossover and delay box (the part with the fewest
   good commercial options).
4. **Digital baseline, for comparison only.** One DSP in front (e.g. a dbx DriveRack PA2, a Behringer DCX2496 or
   a miniDSP unit). It sets the bar for cost, setup time and features, fills included.

## Questions to answer

- For each option: cost (US vendors, used and new, Parts Express preferred for parts), rack space, noise and
  headroom, setup time, preset recall, and what's missing.
- How many all-pass sections give 0.6 ms flat to about 1 kHz, and the sub-to-top delay flat to about 120 Hz?
  Give part values and the noise each section adds.
- Can the front end protect the horn (a limiter per output whose threshold can be set to the amp's gain), or must
  the PLD's limiter stay on?
- How does each option patch into the PLD 4.2 and the GXD4? Can both amps then run flat?
- What do fills need, and which options can feed them?
- Which class H amps fit (power per band at 8 Ω, channel count, weight, US used prices), and what does the
  analog rig cost and weigh against the v1 plan?

## Constraints

- US vendor prices only. Mark anything not confirmed from a manual or a datasheet as _(unverified)_. Don't drop a
  candidate because some specs are missing; mark the gap.
- Balanced line level (XLR) in and out; enough headroom for the amps' full input sensitivity.
- Keep the PA's current crossover points and slopes as the target response.

## Open questions for the owner

1. Why analog: sound, hands-on control, reliability, or the fun of building it?
2. How many sources: stereo line inputs, any mic inputs?
3. Budget and rack size (portable or fixed)?
4. Fills now or later?
5. Who runs it at a show: preset recall, or knobs set by hand?

## Deliverable

`docs/front-end-options.md`: an options table, a block diagram per option, a parts list with US prices, the
all-pass delay math with part values, a patch plan into the current amps, and a recommendation. Later, the
system page ([speaker-designer-plan.md](speaker-designer-plan.md), L4) could model the front end with the amps.
