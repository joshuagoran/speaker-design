# PA v2: a modular horn stack with a fixed analog front end

The owner's plan for v2 of the whole PA, Oct 2026: boxes, drivers, amps and front end. Nothing is decided. It builds
on [amp-dsp-v1.md](amp-dsp-v1.md) and [front-end-handoff.md](front-end-handoff.md).

Levels are rough hand estimates: maximum SPL at 1 m, half space, no horn gain, no power compression (often −3 dB).
Use them to compare options only. _(unverified)_ marks a fact from a listing, a photo or general knowledge.

## Goals

- **Sound.** A small version of the club horn stacks the owner likes: the SBS Slammer stack at Analog BKNY and the
  Sunflower Sound System stacks.
- **Fixed, not flexible.** No DSP. Tune once, then fix the values for these cabinets.
- **Drivers.** 18″ subs, 10″ or 12″ mids, the 1.4″ N314T compression driver.
- **Modular.** The same box types make a small stack or a big one. One analog front end drives either.

## What the reference stacks share

- **A horn for each band.** Bass bins, horn-loaded mids, an HF horn, sometimes a super tweeter.
- **Front-loaded 1-D mid horns.** The cone sits deep at the back. The side walls flare. The top and bottom stay flat
  or flare a little. The flare sets the horizontal pattern. Stacked boxes set the vertical pattern.
- **A throat about as wide as the cone.** Little or no compression, no visible phase plug _(unverified)_.
- **Ports on the front sides.** Vertical slots vent the rear chamber _(unverified)_.
- **Mids stacked under the HF horn.** Stacked mouths act as one taller mouth.

Why they sound good:

- **Low distortion when loud.** The horn loads the cone, so the cone moves less.
- **Punch.** The horn-loaded band from about 150 to 400 Hz.
- **Direct sound.** The flare sends less sound to the side walls.

## Lead option: front-loaded, vented modules

The simplest system and the closest match to the Sunflower stacks. It is 3-way. Each box is a front-loaded 1-D horn
with a vented rear chamber. The ports exit as slots on the front sides. The sub bin covers sub and kick.

```
          [ N314T + DIY R-OSSE 110×50 ]      950 Hz and up
          [ mid box: 2 × 10″, 1-D horn ]     sub/mid crossover → 950 Hz
   [ sub bin: 1 or 2 × 18″, 1-D horn ]       ~35 Hz → sub/mid crossover
```

### Modules

| Module  | Contents                                                  | Port tuning | Horn loads from                     |
| ------- | --------------------------------------------------------- | ----------- | ----------------------------------- |
| Sub bin | 1 or 2 × 18″ (18NBX100 or 4018LF), front-loaded 1-D flare | ~40–45 Hz   | ~140 Hz (1 × 18″), ~99 Hz (2 × 18″) |
| Mid box | 2 × 10″ (10MB600 or 10PR320) in one throat, ~280 mm apart | ~90–100 Hz  | ~176 Hz (one box)                   |
| HF      | N314T on the DIY R-OSSE                                   | —           | —                                   |

A 2 × 12″ mid box (3012HO) needs its cones at least ~330 mm apart: a 12″ frame is ~310–320 mm wide. Its box is
taller, and its loading and lobing figures differ from the 2 × 10″ figures below.

### How the hybrid works

- **Above the loading point,** the flare works: gain, horizontal control, less excursion.
- **Near the port tuning,** the box works as a vented box. The ports give the output. The cone moves less.
- **Ports beside the mouth** sum cleanly with it. The box can stand against a wall.
- **The mid ports** add output from 100 to 130 Hz. One mid box can then cross near 120 Hz, not 150 Hz.

### Pairing subs and mids

A mid box has 2 cones. Pick the mid count for the sub count, then set the sub/mid crossover where the mids keep up.

| Per side                       | Sub/mid crossover | System level (rough)      |
| ------------------------------ | ----------------- | ------------------------- |
| 1 × 18″ + 1 mid box + 1 HF     | ~120 Hz           | ~125 dB, balanced         |
| 2 × 18″ + 1 mid box + 1 HF     | ~150 Hz           | ~130 dB, mids and HF full |
| 2 × 18″ + 2 mid boxes + 1–2 HF | ~110–120 Hz       | ~130 dB, with headroom    |
| 4 × 18″ + 3 mid boxes + 2–3 HF | ~110–140 Hz       | ~137 dB, bass-heavy       |

- Add a third mid box only with 4 × 18″. With fewer subs, the mids out-run the subs.
- Grow a stack in this order: a second mid box, then subs, then HF.
- The front end steps the sub/mid crossover with the stack size (see [Scaling](#scaling)).

### Inside the mid box

| Setup                                                  | HF to mid center | First null at 950 Hz |
| ------------------------------------------------------ | ---------------- | -------------------- |
| Both cones to the crossover (one channel, 4 Ω)         | ~435 mm          | ~25°                 |
| Upper cone to the crossover, lower cone to ~400–500 Hz | ~300 mm          | ~37°                 |

The second setup is cleaner at the crossover. It needs its own channel for the lower cone, or a coil (see
[Amps and wiring](#amps-and-wiring)).

### Build notes

- **Ports.** The mid ports move much air at 90–110 Hz. Make them large. Flare their ends.
- **Front chamber.** Start the flare at the cone. Leave no cavity in front of it.
- **Drivers.** The 18NBX100, 4018LF and 3012HO suit vented chambers. The 10MB600 (Qts 0.22) suits sealed or horn
  loading. Vented, it gives a small chamber and a bump near tuning. A fixed shelf flattens the bump.
- **Simulate first.** Model the chamber, ports and flare (Hornresp, or the planner's horn engine). Check the sum.
- **Alignment.** All mouths are flush at the front. The acoustic centers sit at similar depths.

## Alternative: 4-way with folded horn subs

A folded or tapped horn gives real horn bass from one box. Fold resonances usually stop it near 100–120 Hz
_(unverified per design)_. One 2 × 10″ mid box keeps up only from about 150 Hz. Add a band or bring the mids down:

- **Kick band.** Sub horn ~35–90 Hz, kick bin ~90–250 Hz (for example 1 × B&C 15NDL76), mid box ~250–950 Hz, HF. One
  more box type, channel, front-end card and alignment step per side.
- **Lower mids, still 3-way.** Two vented mid boxes per side, crossed at ~110–120 Hz.
- **Delay.** A 2–3 m folded path delays the sub by ~6–9 ms. Put an all-pass on the full-range top feed. It must hold
  only near the sub crossover:

| Top-feed delay | 2 second-order stages       | 3 stages  |
| -------------- | --------------------------- | --------- |
| 5 ms           | 0° at 100 Hz, 1° at 150 Hz  | 0°        |
| 8 ms           | 2° at 100 Hz, 26° at 150 Hz | 0.2° / 6° |

## Alternative: 12″ small stack

```
          [ N314T + DIY R-OSSE 110×50 ]   950 Hz and up
          [ 12″ 1-D horn, upper ]         120 Hz → 950 Hz
          [ 12″ 1-D horn, lower ]         120 Hz → ~300 Hz (2.5-way)
   [ 18″ bin ][ 18″ bin ]                 side by side, up to 120 Hz
```

- **Subs.** Two 24 × 32 × 18″ boxes side by side: a base 48″ wide, 32″ tall. Do not stack them: too tall.
- **Mids.** Two 1-D horn boxes, one 12″ each, as a 2.5-way (see [Mid layout](#mid-layout)).
- **HF.** Set back to line up with the upper mid's cone. Its center sits ~1.8 m up.

## Mid horn

### Loading

Mouth size sets how low a horn loads. Loading starts where the mouth's circumference is about one wavelength.

| Mid section, 500 mm wide | Mouth area | Loads from |
| ------------------------ | ---------- | ---------- |
| 1 box, 400 mm tall       | 0.20 m²    | ~216 Hz    |
| 2 × 10″ boxes, 660 mm    | 0.33 m²    | ~168 Hz    |
| 2 × 12″ boxes, 800 mm    | 0.40 m²    | ~153 Hz    |
| 3 boxes, ~1 m            | 0.50 m²    | ~137 Hz    |

Below the loading point the cone works as a direct radiator. This rule is rough. Stacking also changes the mouth's
match and its ripple. Check each design with the horn engine.

### Horn types

| Type                                    | Flare      | Depth   | Compression    | Verdict                          |
| --------------------------------------- | ---------- | ------- | -------------- | -------------------------------- |
| Shallow OS waveguide, lip over surround | Both       | ~150 mm | None           | Compact; pattern match, low gain |
| **Front-loaded 1-D horn**               | Sides only | Deep    | None or little | **v2 pick**: plywood-friendly    |
| Compression horn with a phase plug      | Both       | Medium  | 1.5–3:1        | Most gain; hardest to design     |

A compression horn needs a phase plug at this crossover. The air between the cone and a narrow throat is a low-pass,
f ≈ c·S_throat / (2π·V_chamber). For a 12″ at 2:1, the cone's dish (~1.5 L) puts it near 890 Hz. A plug that cuts the
chamber to 0.5 L moves it to ~2.7 kHz.

### Build

- Flat top and bottom, two curved side walls (kerfed or bent ply).
- Mount the driver from behind on a sub-baffle. The surround meets the throat with no step.
- Roll back the mouth's lip, as on the R-OSSE.
- Put the ports on the outer sides. (The planner models only a sealed mid today.)
- A 12″ box is ~20″ wide and 24″ or more deep.

## Mid layout

### Options

| Layout                         | Coupling, 150–300 Hz | Lobing at the crossover   | Channels per side    |
| ------------------------------ | -------------------- | ------------------------- | -------------------- |
| 10–horn–10 (HF between mids)   | Partial              | None (symmetric)          | 3                    |
| **Stacked mids, 2.5-way**      | **Full**             | **As v1 (~325 mm)**       | **4, or 3 + a coil** |
| Tapered column, 3 mid boxes    | Full, lowest loading | As v1                     | 4–5                  |
| Shared mouth, HF in its middle | Full                 | None                      | 3; hard to build     |
| 2 × 10″ in one box (Sunflower) | Full, one mouth      | Set by the cones' spacing | 3–4                  |

Coupling of two mid mouths (load factor 1 + sin(kd)/kd; 2.0 is full coupling):

| Frequency | Stacked, 330 mm apart | Split by the HF, 650 mm apart |
| --------- | --------------------- | ----------------------------- |
| 120 Hz    | 1.91 (+2.8 dB)        | 1.69 (+2.3 dB)                |
| 170 Hz    | 1.83 (+2.6 dB)        | 1.44 (+1.6 dB)                |
| 216 Hz    | 1.74 (+2.4 dB)        | 1.21 (+0.8 dB)                |
| 300 Hz    | 1.54 (+1.9 dB)        | 0.88 (−0.6 dB)                |

### Pick: stacked mids as a 2.5-way

- **Upper mid:** sub/mid crossover to 950 Hz. Only this mid meets the HF, ~325 mm away.
- **Lower mid:** sub/mid crossover to ~300–350 Hz. Below that both mids run, with full coupling.
- Below the roll-off the level steps up ~6 dB. Keep some as tilt. Cut the rest with a fixed shelf.
- Use a gentle roll-off (12 dB/oct). Check the summed response.

### Tapered column (3 mid boxes)

Roll each lower box off where its distance from the top box is about half a wavelength: the middle one at ~500 Hz,
the bottom one at ~250–300 Hz. The vertical pattern stays more even, and loading starts near 137 Hz. Use it only with
4 × 18″ (see [Pairing](#pairing-subs-and-mids)).

### Vertical lobing

`firstNullAngleDeg` (`src/lib/pa/dispersion.ts`) puts the first null where the path difference is half a wavelength.

| Stack                           | HF to mid center | First null off axis        |
| ------------------------------- | ---------------- | -------------------------- |
| v1 stack                        | ~350 mm          | ~31° at 950 Hz             |
| 2.5-way, upper mid at the HF    | ~325 mm          | ~34° at 950 Hz             |
| Club stack, 3 mids under the HF | ~700 mm          | ~14° at 1 kHz _(estimate)_ |

## Drivers

All are in the catalog (`src/data/catalog/`).

### Subs

| Driver          | Fs / Qts  | Sd × Xmax | Sensitivity | Weight | Price |
| --------------- | --------- | --------- | ----------- | ------ | ----- |
| B&C 18NBX100    | 35 / 0.38 | 1.21 L    | 96.5 dB     | 20 lb  | $449  |
| Eminence 4018LF | 30 / 0.34 | 1.02 L    | 94.9 dB     | 24 lb  | $329  |

- **18NBX100:** ~1.5 dB more output, 4 lb lighter.
- **4018LF:** deeper (Fs 30 Hz), a better bin driver (lower Qts, Bl 26.8), ~$480 less for four. Needs a bigger box
  (Vas 255 L).

### Mids

| Driver            | Fs / Qts    | Sd × Xmax | Power / sensitivity      | Price |
| ----------------- | ----------- | --------- | ------------------------ | ----- |
| FaitalPRO 12PR300 | 50 / 0.36   | 241 cm³   | 300 W AES / 99 dB        | $290  |
| Eminence 3012HO   | 51.5 / 0.32 | 330 cm³   | 400 W / 100.5 dB claimed | $250  |
| 18Sound 10MB600   | 58 / 0.22   | 228 cm³   | 450 W AES / 98 dB        | $250  |
| FaitalPRO 10PR320 | 48 / 0.29   | 237 cm³   | 300 W AES / 96 dB        | $285  |

- **3012HO** is the 12″ pick: ~3 dB more excursion headroom than the 12PR300. Check its response to 950 Hz. Expect
  less than the claimed 100.5 dB.
- **10MB600** is the 10″ pick: made for horns (Qts 0.22). Two of them equal two 12PR300s in output.

### HF

- **Eminence N314T** on the DIY R-OSSE 110×50. Usable 800 Hz–20 kHz, 100 W AES, 110.9 dB.
- The R-OSSE narrows from ~104° at 1 kHz to ~80° at 3–5 kHz and ~60° × 48° at 10 kHz.

## Balance (2 × 18″, 2 mid cones per side)

| Band                         | 2 × 18NBX100 + 2 × 12PR300 | 2 × 4018LF + 2 × 3012HO |
| ---------------------------- | -------------------------- | ----------------------- |
| Subs (800 W each)            | ~131.5 dB                  | ~130 dB                 |
| Mids at 120 Hz (excursion)   | ~125 dB                    | ~128 dB                 |
| Mids at 160 Hz (excursion)   | ~130 dB                    | ~133 dB                 |
| Mids above ~250 Hz (thermal) | ~130 dB + horn gain        | ~132.5 dB + horn gain   |
| HF (N314T, 100 W AES)        | ~128–131 dB                | ~128–131 dB             |

- **2 × 4018LF + 2 × 3012HO is the most even pair.** All bands are within ~3 dB, crossed at ~120 Hz.
- **With 2 × 12PR300 or 2 × 10″,** cross at ~150 Hz (see [Pairing](#pairing-subs-and-mids)).
- **The HF and the subs reach their limits together.** Keep the HF limiter conservative.

## Alternative: 8″ build-out

The lead option with 2 × 8″ mid boxes and unvented 1 × 18″ bins. It is lighter. The 8″ mids need a ~150 Hz crossover
and more boxes for the same level.

| Sub bins | Loads from | Mid boxes (2 × 8″) | Loads from |
| -------- | ---------- | ------------------ | ---------- |
| 1        | ~140 Hz    | 1                  | ~204 Hz    |
| 2        | ~99 Hz     | 2                  | ~144 Hz    |
| 4        | ~70 Hz     | 3                  | ~118 Hz    |

| Per side            | Subs (18NBX100, 800 W each) | Mids at 150 Hz | HF                      |
| ------------------- | --------------------------- | -------------- | ----------------------- |
| 1 bin, 1 mid box    | ~125.5 dB                   | ~123 dB        | 1 CD, spare             |
| 2 bins, 2 mid boxes | ~131.5 dB                   | ~129 dB        | 1 CD at its limit, or 2 |
| 4 bins, 3 mid boxes | ~137.5 dB                   | ~133 dB        | 2–3 CDs                 |

8″ figures assume ~220 cm² × 5.5 mm and ~250 W per driver _(typical, unverified)_.

- **One bin alone** is little better than a vented box below 140 Hz, and it is bigger. Four bins load to ~70 Hz.
- **The HF must grow.** Each doubling of subs adds ~6 dB. Add HF horns stacked and splayed (near and far throw), or
  use a larger compression driver.
- **Layout.** Four bins in a floor row keep the HF ~2.5 m up. Stacked 2 × 2, they put it ~3.3 m up.
- **Gap.** The catalog has no plain 8″ mid. Candidates: B&C 8NDL51, FaitalPRO 8PR200, 18Sound 8NMB420
  _(unverified)_.

## Alignment

Both the CD and the mid cone sit deep in their horns. Their acoustic centers land much closer than in v1.

- **Physical first.** Move the HF horn on its mount until the mid and HF phase curves overlap through the crossover.
  Measure with REW. Pin the position.
- **Tolerance.** At 950 Hz an LR24 sum loses |cos(π·f·Δ)|: −0.2 dB at 25 mm, −0.9 dB at 50 mm, −3.9 dB at 100 mm.
  Stay within ±40 mm.
- **No overhang.** A horn past the stack front enters the crowd space and shadows the mid.
- **Electrical trim, if needed.** Phase error of analog all-pass delay at the crossover:

| Target                     | Circuit                 | Phase error |
| -------------------------- | ----------------------- | ----------- |
| 0.6 ms at 1 kHz            | 4 × first-order         | 14°         |
| 0.6 ms at 1 kHz            | 2 × second-order Bessel | 0.2°        |
| 0.3 ms at 1 kHz            | 1 × second-order Bessel | ~1.5°       |
| Sub-to-top, 1 ms at 120 Hz | 1 × first-order         | 2°          |
| Sub-to-top, 3 ms at 120 Hz | 1 × second-order        | 3°          |

Put the sub-to-top delay on the full-range top feed, before the mid/HF split. The mid and HF then get the same phase.

## Front end

### Signal chain

```
mixer → bus compressor / system EQ → fixed analog crossover box → amps
```

Clubs split the job the same way: analog stages shape the sound, a separate box does the speaker work.

### Mixer and dynamics

- **SSL SiX.** The only compact analog mixer found with a master bus compressor (2-knob G-series). ~$1,450 new.
- **A G-style bus compressor** after a clean mixer, for example the Warm Audio Bus-Comp (~$700).
- **SSL 500-series** in a 10-slot frame (Radial Workhorse Powerhouse, ~$950), with G-Comp and UV-EQ modules _(prices
  unverified)_. DIY crossover and limiter cards can share the frame.
- Allen & Heath ZED mixers have no compressors. Yamaha MG, Behringer Xenyx and Soundcraft Signature mixers have them
  on channels only.

### Crossover box

| Output    | Filter                               | Setting                                    |
| --------- | ------------------------------------ | ------------------------------------------ |
| Subs      | BW24 high-pass, LR24 low-pass        | 31 Hz fixed; sub/mid crossover stepped     |
| Upper mid | LR24 high-pass, LR24 low-pass        | Sub/mid crossover stepped; 950 Hz stepped  |
| Lower mid | LR24 high-pass, 12 dB/oct low-pass   | Sub/mid crossover stepped; ~300 Hz stepped |
| 3rd mid   | LR24 high-pass, 12 dB/oct low-pass   | 4 × 18″ stacks only; ~500 Hz               |
| HF        | LR24 high-pass, fixed shelf, limiter | 950 Hz stepped                             |

- **Step the sub/mid crossover as one switch.** It sets the sub low-pass and every mid high-pass together. An LR24
  pair sums flat only at one shared frequency.
- **Fix what the cabinets set:** the subsonic, the delay, the horn EQ. Step what a measurement may move.
- **Cabinet EQ.** Fixed networks sized from measurements: the horn shelf, the mid horn's rising response.
- **Tune with v1 first.** Use the PLD 4.2 and GXD4 DSP and a mic. Then freeze the values into analog parts.

### Scaling

**Fixed for every stack size** (set by the box types):

- The mid/HF crossover and the slopes.
- The cabinet EQ.
- The mid-to-HF alignment in the stack.
- The HF protection, per HF box and amp.

**Changes with the stack size:**

| What              | Why                                               | How the box handles it                       |
| ----------------- | ------------------------------------------------- | -------------------------------------------- |
| Sub/mid crossover | The sub-to-mid ratio moves where the mids keep up | One stepped switch for all its filters       |
| Band levels       | More boxes add level and coupling                 | Stepped trim per output, 1 dB steps          |
| Low-mid shelf     | More stacked mids raise the mid band's low end    | A stack-size switch picks the shelf          |
| Mid roll-offs     | 2.5-way or tapered column                         | One output per mid position; unused ones off |
| Sub-to-top delay  | Sub count and placement move the subs' center     | Stepped all-pass on the top feed             |
| Amp feeds         | A big stack drives more amps per band             | Balanced outputs that drive several amps     |

- **One card per output.** A frame of equal slots: sub, upper mid, lower mid, 3rd mid, HF, per side. A small stack
  leaves out the 3rd-mid card. A 500-series frame or a Eurocard rack works.
- **Build for the big stack.** Size the frame, the power supply and the outputs for it.
- **Calibrated steps, no free knobs.** Write each stack size's settings on a card.

### Horn protection

With no DSP, a wrong patch or a turned knob can send full-range signal to the N314T.

- Put a series capacitor at the horn: ~40 µF for a corner near 500 Hz at 8 Ω.
- Give each HF output a limiter. Set its threshold from the amp's real voltage gain (28 V RMS = 100 W AES into 8 Ω).
- Lock the amp gain knobs, or put the gain in the box and run the amps fully up.

## Amps and wiring

| Band      | Load                      | Channel                               |
| --------- | ------------------------- | ------------------------------------- |
| Subs      | 2 × 8 Ω in parallel = 4 Ω | 1 per side; needs real power at 4 Ω   |
| Upper mid | 8 Ω                       | 1 per side                            |
| Lower mid | 8 Ω                       | Own channel, or shared through a coil |
| HF        | 8 Ω                       | 1 per side, with the limiter          |

- **The coil is first-order:** 6 dB/oct, not the 12 dB/oct the plan assumes. About 4.2 mH gives 300 Hz into a flat
  8 Ω. The voice coil's impedance rises with frequency, so the real corner moves. For 12 dB/oct, give the lower mid its
  own channel and filter, or use a second-order network with impedance compensation.
- **Count:** 3–4 channels per side, 6–8 in total. The PLD 4.2 and GXD4 give 6, so they need the coil.
- **Class H:** about three 2-channel amps (for example used QSC RMX or Crest CA _(unverified)_). Much heavier than the
  class D v1 amps.

## Super tweeter

The reference stacks add a bullet tweeter above the HF horn for the top octave, from ~8–10 kHz.

- **Adds:** top-octave level without EQ boost on the N314T, a top end wider than the R-OSSE's ~60° at 10 kHz.
- **Costs:** another crossover at a 34 mm wavelength, so some comb filtering. Usually on the HF channel through a
  series capacitor.
- **Plan:** skip it first. Measure the N314T on the R-OSSE. Add one if the top octave falls off or sounds dull
  off-axis. Leave room above the horn.

## Fills

An analog box cannot delay a full-range signal. Drop fills, or add one small digital delay for them.

## Open questions

1. 10″ or 12″ mids? 8″ is lighter; 12″ crosses lowest per box.
2. 18NBX100 or 4018LF subs?
3. Vented or sealed mid horns?
4. Mixer and compressor in the front-end box, or separate?
5. Fills: drop them, or add a digital delay?
6. Class H amps, or the v1 class D amps with their DSP bypassed?

## Planner gaps

The planner needs these to model v2 (later, with the system page in
[speaker-designer-plan.md](speaker-designer-plan.md), L4):

- A 1-D horn engine (see [horn-engine-plan.md](horn-engine-plan.md)).
- Horn-loaded and vented mid boxes.
- More than one driver per band, a 2.5-way roll-off, a tapered column.
- A horn setback setting, for the 3D view and the alignment.
- Front-loaded sub bins, and their loading as bins stack.
- Plain 8″ mid drivers in the catalog.
- More than one HF horn per side.

## Compared: HOQS Paraflex mid-tops

Paraflex (High Order Quarterwave Society) uses two parallel quarter-wave resonators, one tuned low, one tuned high.
They merge into one mouth. The gain comes from resonance near each tuning, not from a flare.

| Point         | 1-D horn mids (SBS / Sunflower)          | Paraflex mid-top (e.g. PF-212, 2 × 8″ plan)           |
| ------------- | ---------------------------------------- | ----------------------------------------------------- |
| Range         | ~120–150 Hz to ~1 kHz                    | 80–600 Hz; ~900 Hz with phase plugs (PF-212)          |
| Sub crossover | ~120–150 Hz                              | 80–90 Hz                                              |
| HF crossover  | 950 Hz suits the R-OSSE                  | 800–900 Hz at most: tight for the R-OSSE              |
| Pattern       | Horizontal control from the flare        | Little mid control; forward-biased cardioid, per HOQS |
| Alignment     | Mostly geometric: align by moving the HF | Delay varies with frequency: wants DSP                |
| Build         | Curved side walls                        | Two resonators to tune; stuffing, Helmholtz dampers   |

- **The horn mids fit this plan better.** They reach the HF crossover, control the pattern and align without DSP.
- **Paraflex suits a small two-box system with DSP:** a 2 × 8″ top and a sub, crossed at 80–90 Hz.
- HOQS also makes a coaxial (CX) variant with the HF horn in the mouth.

Sources: [PF-212 MK1 mid-top](https://github.com/High-Order-Quarterwave-Society/PF-212-MK1-mid-top),
[Paraflex FAQ](https://github.com/High-Order-Quarterwave-Society/About-Paraflex-systems-FAQ),
[HOQS store](https://hoqs.org/), [HOQS Australia projects](https://www.hoqs.com.au/projects).

## Reference stacks

- [SBS Slammer stack at Analog BKNY](https://sbsslammer.wordpress.com/wp-content/uploads/2018/02/photo-oct-19-12-46-59-pm.jpg)
  (photo): two dual-cone bass bins, three single-cone 1-D mid horns, a wide HF horn, a bullet tweeter.
- Sunflower Sound System (Instagram photo from the owner): two mid boxes, each with two cones in one 1-D throat; side
  ports; a wide HF horn; three small openings above it, likely super tweeters _(unverified)_.
