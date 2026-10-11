# PA v2: a scaled-down horn stack with a fixed analog front end

A plan from the owner's discussion, Oct 2026. It explores v2 of the whole PA: the boxes, the drivers, the amps and
the front end. Nothing here is decided. It builds on the v1 amp plan ([amp-dsp-v1.md](amp-dsp-v1.md)) and the
front-end brief ([front-end-handoff.md](front-end-handoff.md)).

All levels below are rough hand estimates: maximum SPL at 1 m, half-space, with no horn gain and no power compression
(often about −3 dB). Use them to compare options, not as absolute figures. Anything marked _(unverified)_ comes from a
listing, a photo or general knowledge, not from a datasheet or a manual.

## Goals

- **Sound.** A scaled-down version of the sound-system and club horn stacks the owner has heard and liked, for
  example the SBS Slammer stack at Analog BKNY and the Sunflower Sound System stacks.
- **Customized, not flexible.** A non-digital system built for these exact cabinets. Values are fixed once after
  tuning. Less flexible than DSP is acceptable.
- **Same driver family.** An 18″ sub, a 12″ (or 10″) mid and the 1.4″ compression driver.
- **Modular.** The same box types build a small stack or a big one, and one analog front end drives either. See
  [Scaling](#scaling).

## What these stacks have in common

- **Each band gets a horn.** Bass bins with flared walls, horn-loaded mids, and an HF horn on top. Sometimes a
  super tweeter above that.
- **Front-loaded 1-D mid horns.** The cone sits deep at the back. The side walls flare, often in a curve; the top
  and bottom stay flat or flare only a little. The horn controls the horizontal pattern. The vertical pattern comes
  from stacking boxes.
- **The throat is about as wide as the cone, or a little narrower.** The side walls start at or just inside the
  cone's edge. Little or no compression and no visible phase plug _(unverified, from photos)_.
- **Reflex ports on the front sides.** Vertical slots on the outer sides of each box vent the rear chamber
  _(unverified, from photos)_.
- **Stacked mids under the HF horn.** Several mid mouths stack into one tall mouth, which loads lower than one box.

Why they sound the way they do:

- **Low distortion when loud.** Horn loading means the cones move less for the same output.
- **Punch.** A horn-loaded mid-bass from about 150 to 400 Hz gives the impact you feel.
- **More direct sound.** The horizontal flare sends less sound to the side walls.

## Lead option: front-loaded, vented modules

The simplest system, and the closest match to the Sunflower stacks. Every box is a front-loaded 1-D horn with a
vented rear chamber; the ports exit as slots on the front sides. It is 3-way: front-loaded bins cover sub and kick in
one box.

```
          [ N314T + DIY R-OSSE 110×50 ]      HF: 950 Hz and up
          [ mid box: 2 × 10″, 1-D horn ]     ~120–150 Hz → 950 Hz
   [ sub bin: 1 or 2 × 18″, 1-D horn ]       ~35 Hz → ~120–150 Hz
```

### Modules

| Module  | Contents                                                       | Port tuning | Horn loads from                     |
| ------- | -------------------------------------------------------------- | ----------- | ----------------------------------- |
| Sub bin | 1 or 2 × 18″ (18NBX100 or 4018LF), front-loaded 1-D flare      | ~40–45 Hz   | ~140 Hz (1 × 18″), ~99 Hz (2 × 18″) |
| Mid box | 2 × 10″ (10MB600 or 10PR320) or 2 × 12″ (3012HO) in one throat | ~90–100 Hz  | ~176 Hz (one box)                   |
| HF      | N314T on the DIY R-OSSE                                        | —           | —                                   |

### How the hybrid works

- **Above the horn's loading point** the flare does the work: gain, horizontal pattern control, less excursion.
- **Near the port tuning** the rear chamber and ports act as a vented box: the ports carry the output and the cone
  moves less. This covers the band where the mouth is too small to load.
- **Ports at the front sides** keep the port and the mouth in one plane, close together against the wavelength, so
  they sum cleanly and the box can stand against a wall.
- **The mid ports** add output and cut excursion around 100–130 Hz, so one mid box can cross near 120 Hz instead of
  150 Hz.

### Sizes

| Per side                             | Crossovers          | System level (rough)                   |
| ------------------------------------ | ------------------- | -------------------------------------- |
| 1 × 18″ bin + 1 mid box + 1 HF       | ~120 Hz, 950 Hz     | ~125 dB, every band balanced           |
| 2 × 18″ bin + 1 mid box + 1 HF       | ~150 Hz, 950 Hz     | ~130 dB; mids and HF near their limits |
| 2 × 18″ bin + 2 mid boxes + 1–2 HF   | ~110–120 Hz, 950 Hz | ~130 dB with headroom                  |
| 2 × (2 × 18″) + 3 mid boxes + 2–3 HF | ~110–140 Hz, 950 Hz | ~137 dB, bass-heavy                    |

Grow a stack in this order: a second mid box, then subs, then HF. The front end's stepped crossover switch moves
the sub/mid crossover as the ratio changes.

### Inside the mid box

The two cones sit about 280 mm apart in one throat.

| Setup                                                  | HF to mid center | First null at 950 Hz |
| ------------------------------------------------------ | ---------------- | -------------------- |
| Both cones to the crossover (one channel, 4 Ω)         | ~435 mm          | ~25°                 |
| Upper cone to the crossover, lower cone to ~400–500 Hz | ~300 mm          | ~37°                 |

The second is cleaner at the crossover; it needs a coil on the lower cone (about 2.5–3 mH for 8 Ω) or a second
channel.

### Things to get right

- **Port velocity.** The mid ports carry a lot of air near 90–110 Hz: size them generously and flare their ends.
- **Small front chamber.** Start the flare at the cone, with no cavity in front of it.
- **Driver fit.** The 18NBX100, 4018LF and 3012HO suit vented chambers. The 10MB600 (Qts 0.22) is more of a sealed
  or horn driver: vented, it gives a small chamber and a gentle bump near tuning that a fixed shelf can flatten.
- **Simulate first.** Hornresp models front-loaded horns with a vented rear chamber: set the chamber, the ports and
  the flare there, then check the summed response.
- **Alignment.** Every mouth is flush at the front, so the acoustic centers sit at similar depths. Sub to mid needs
  only the stepped all-pass on the top feed, if any.

## Alternative: 4-way with folded horn subs

Folded or tapped horn subs give real horn bass from one box, but fold resonances usually cap them near 100–120 Hz
_(unverified per design)_. One 2 × 10″ mid box only keeps up from about 150 Hz. Either add a band or bring the mids
down:

- **Kick band (4-way).** Sub horn ~35–90 Hz, a front-loaded kick bin ~90–250 Hz (for example 1 × B&C 15NDL76),
  mid box ~250 Hz–950 Hz, HF. The classic sound-system layout; one more box type, channel and front-end card per
  side, and one more alignment step.
- **Mids lower, still 3-way.** Vented 2 × 12″ (3012HO) mid boxes, 2 per side, crossed at about 110–120 Hz.
- **Delay.** A 2–3 m folded path delays the sub by about 6–9 ms. Correct it with an all-pass on the full-range top
  feed; it only needs to hold around the sub crossover:

| Top-feed delay | 2 second-order stages       | 3 stages  |
| -------------- | --------------------------- | --------- |
| 5 ms           | 0° at 100 Hz, 1° at 150 Hz  | 0°        |
| 8 ms           | 2° at 100 Hz, 26° at 150 Hz | 0.2° / 6° |

## Alternative: 12″ small stack, per side

```
          [ N314T + DIY R-OSSE 110×50 ]   HF: 950 Hz and up
          [ 12″ 1-D horn, upper ]         120 Hz → 950 Hz
          [ 12″ 1-D horn, lower ]         120 Hz → ~300 Hz (2.5-way)
   [ 18″ bin ][ 18″ bin ]                 side by side, up to 120 Hz
```

- **Subs.** Two 18″ boxes side by side. With the default 24 × 32 × 18″ box the base is about 48″ wide and 32″ tall.
  Don't stack the subs vertically: the stack gets too tall.
- **Mids.** Two front-loaded 1-D horn boxes, run as a 2.5-way (see [Mid layout](#mid-layout)).
- **HF.** The N314T on the DIY R-OSSE, set back to line up with the upper mid's cone.
- **Height.** The HF center lands at about 1.8 m, above the crowd.
- **Super tweeter.** Optional; see [Super tweeter](#super-tweeter).

## Mid horn

### Loading

Mouth size sets how low a horn loads, not the driver count. Loading starts roughly where the mouth's circumference
equals the wavelength.

| Mid section (500 mm wide) | Mouth area | Loads from about |
| ------------------------- | ---------- | ---------------- |
| 1 box, 400 mm tall        | 0.20 m²    | 216 Hz           |
| 2 × 10″ boxes, 660 mm     | 0.33 m²    | 168 Hz           |
| 2 × 12″ boxes, 800 mm     | 0.40 m²    | 153 Hz           |
| 3 boxes, about 1 m        | 0.50 m²    | 137 Hz           |

Below the loading point the cone acts as a normal direct radiator.

### Horn types considered

| Type                                    | Flare      | Depth   | Compression    | Verdict                                 |
| --------------------------------------- | ---------- | ------- | -------------- | --------------------------------------- |
| Shallow OS waveguide, lip over surround | Both       | ~150 mm | None           | Compact; directivity match, little gain |
| **Front-loaded 1-D horn (the stacks)**  | Sides only | Deep    | None or little | **v2 pick**: plywood-friendly           |
| Compression horn with a phase plug      | Both       | Medium  | 1.5–3:1        | Most gain; hardest to design            |

A compression horn needs a phase plug at this crossover. The air between the cone and a narrowed throat is a
low-pass filter, f ≈ c·S_throat / (2π·V_chamber). For a 12″ at 2:1, the cone's dish alone (about 1.5 L) puts it near
890 Hz, below the 950 Hz crossover. A plug that cuts the chamber to 0.5 L moves it to about 2.7 kHz.

### Building the 1-D horn

- Flat top and bottom, two curved side walls (kerfed or bent ply).
- Mount the driver from behind on a sub-baffle, so the surround meets the throat with no step.
- A rolled-back lip at the mouth, as on the R-OSSE.
- Reflex ports on the outer sides, if the mid is vented. The planner models a sealed mid today.
- A 12″ box comes out at about 20″ wide and 24″ or more deep.

## Mid layout

### Options

| Layout                           | Coupling, 150–300 Hz | Lobing at the crossover       | Channels per side    |
| -------------------------------- | -------------------- | ----------------------------- | -------------------- |
| 10–horn–10 (HF between the mids) | Partial              | None (symmetric)              | 3                    |
| **Mids stacked, as a 2.5-way**   | **Full**             | **About as today (~325 mm)**  | **4, or 3 + a coil** |
| Tapered column, 3 mids           | Full, lowest loading | About as today                | 4–5                  |
| Shared mouth, HF in its middle   | Full                 | None                          | 3; hard to build     |
| 2 × 10″ in one box (Sunflower)   | Full, one mouth      | Set by the two cones' spacing | 3–4                  |

Coupling of two mid mouths (load factor 1 + sin(kd)/kd; 2.0 is full coupling):

| Frequency | Stacked, 330 mm apart | Split by the HF, 650 mm apart |
| --------- | --------------------- | ----------------------------- |
| 120 Hz    | 1.91 (+2.8 dB)        | 1.69 (+2.3 dB)                |
| 170 Hz    | 1.83 (+2.6 dB)        | 1.44 (+1.6 dB)                |
| 216 Hz    | 1.74 (+2.4 dB)        | 1.21 (+0.8 dB)                |
| 300 Hz    | 1.54 (+1.9 dB)        | 0.88 (−0.6 dB)                |

### Pick: stacked mids as a 2.5-way

- **Upper mid:** 120 Hz up to the 950 Hz crossover. It is the only mid that overlaps the HF, about 325 mm away.
- **Lower mid:** 120 Hz to about 300–350 Hz. Below that both mids run, with full mouth coupling through the punch
  region.
- Both mids share the low end, so the response steps up below the roll-off (about +6 dB). Keep some as tonal tilt
  and cut the rest with a fixed shelf in the front end.
- Use a gentle slope (12 dB/oct) on the lower mid's roll-off, and check the summed response.

### Tapered column (3 mids)

Roll each mid off where its distance from the top mid is about half a wavelength: the middle one at about 500 Hz,
the bottom one at about 250–300 Hz. The vertical beamwidth stays more even, and loading starts near 137 Hz. Use it
only with more sub: 3 mids out-run one or two 18″ subs (see [Balance](#balance)).

### Vertical lobing

The planner's `firstNullAngleDeg` (`src/lib/pa/dispersion.ts`) gives the first null where the path difference is
half a wavelength.

| Stack                           | HF to mid center | First null off the aligned axis |
| ------------------------------- | ---------------- | ------------------------------- |
| v1 stack                        | ~350 mm          | ~31° at 950 Hz                  |
| 2.5-way (upper mid at the HF)   | ~325 mm          | ~34° at 950 Hz                  |
| Big club stack, 3 mids under HF | ~700 mm          | ~14° at 1 kHz _(estimate)_      |

## Drivers

All from the catalog (`src/data/catalog/`).

### Subs

| Driver          | Fs / Qts  | Sd × Xmax | Sensitivity | Weight | Price |
| --------------- | --------- | --------- | ----------- | ------ | ----- |
| B&C 18NBX100    | 35 / 0.38 | 1.21 L    | 96.5 dB     | 20 lb  | $449  |
| Eminence 4018LF | 30 / 0.34 | 1.02 L    | 94.9 dB     | 24 lb  | $329  |

- **18NBX100:** about 1.5 dB more output and 4 lb lighter.
- **4018LF:** deeper (Fs 30 Hz), better suited to a short front-loaded bin (lower Qts, Bl 26.8), and about $480
  cheaper for four. It wants a bigger box (Vas 255 L).

### Mids

| Driver            | Fs / Qts    | Sd × Xmax | Power / sensitivity      | Price |
| ----------------- | ----------- | --------- | ------------------------ | ----- |
| FaitalPRO 12PR300 | 50 / 0.36   | 241 cm³   | 300 W AES / 99 dB        | $290  |
| Eminence 3012HO   | 51.5 / 0.32 | 330 cm³   | 400 W / 100.5 dB claimed | $250  |
| 18Sound 10MB600   | 58 / 0.22   | 228 cm³   | 450 W AES / 98 dB        | $250  |
| FaitalPRO 10PR320 | 48 / 0.29   | 237 cm³   | 300 W AES / 96 dB        | $285  |

- **3012HO is the pick for the 12″ stack.** About +3 dB more excursion headroom than the 12PR300 closes the
  120–160 Hz gap. Its low Qts suits horn loading. Check its response and breakup up to 950 Hz on the datasheet, and
  expect less than the claimed 100.5 dB.
- **10″ alternative.** Two 10MB600s give about the same output as two 12PR300s, in smaller boxes, with a driver made
  for horns (Qts 0.22). The 12″ boxes load lower (153 Hz against 168 Hz).

### HF

- **Eminence N314T** on the DIY R-OSSE 110×50. Usable 800 Hz–20 kHz per Eminence. 100 W AES, 110.9 dB.
- The R-OSSE narrows from about 104° at 1 kHz to about 80° at 3–5 kHz and about 60° × 48° at 10 kHz.

## Balance

Per side, 2 × sub and 2 × mid:

| Band                         | 2 × 18NBX100 + 2 × 12PR300 | 2 × 4018LF + 2 × 3012HO |
| ---------------------------- | -------------------------- | ----------------------- |
| Subs (800 W each)            | ~131.5 dB                  | ~130 dB                 |
| Mids at 120 Hz (excursion)   | ~125 dB                    | ~128 dB                 |
| Mids at 160 Hz (excursion)   | ~130 dB                    | ~133 dB                 |
| Mids above ~250 Hz (thermal) | ~130 dB + horn gain        | ~132.5 dB + horn gain   |
| HF (N314T, 100 W AES)        | ~128–131 dB                | ~128–131 dB             |

- **2 × 4018LF + 2 × 3012HO is the most even version.** Every band lands within about 3 dB.
- **The HF and the subs set the limit together.** Keep the HF limiter conservative.
- **One 18″ per side** pairs with 2 mids. A third mid only pays off with two 18″ per side or more.

## Alternative: 8″ modular build-out

The lead option with 2 × 8″ mid boxes and unvented 1 × 18″ bins. Lighter, but the 8″ mids need a ~150 Hz crossover
and more boxes for the same level.

| Module  | Contents                              | Mouth (estimate) |
| ------- | ------------------------------------- | ---------------- |
| Sub bin | 1 × 18″ in a front-loaded 1-D horn    | ~600 × 800 mm    |
| Mid box | 2 × 8″ stacked in one 1-D horn throat | ~500 × 450 mm    |
| HF      | 1 × compression driver on its horn    | —                |

### Loading grows with the count

| Sub bins | Loads from | Mid boxes | Loads from |
| -------- | ---------- | --------- | ---------- |
| 1        | ~140 Hz    | 1         | ~204 Hz    |
| 2        | ~99 Hz     | 2         | ~144 Hz    |
| 4        | ~70 Hz     | 3         | ~118 Hz    |

A single bin is little better than a vented box below 140 Hz, and it is bigger. Its value comes when the bins stack:
four bins load down to about 70 Hz. Pick the bin from the start, so a grown stack uses one sub type.

### Balance at each size

Rough, as in [Balance](#balance). 8″ mids assume about 220 cm² × 5.5 mm and about 250 W per driver _(typical,
unverified)_.

| Per side                | Subs (18NBX100, 800 W each) | Mids at 150 Hz | HF needed                 |
| ----------------------- | --------------------------- | -------------- | ------------------------- |
| 1 bin, 1 mid box (2×8″) | ~125.5 dB                   | ~123 dB        | 1 CD (~128–131 dB), spare |
| 2 bins, 2 mid boxes     | ~131.5 dB                   | ~129 dB        | 1 CD at its limit, or 2   |
| 4 bins, 3 mid boxes     | ~137.5 dB                   | ~133 dB        | 2–3 CDs                   |

- **Cross subs to mids at about 150 Hz.** Two 8″ cones fall short at 120 Hz (about 119 dB). A front-loaded bin
  reaches 150 Hz easily.
- **The 8″ mids reach the HF crossover easily.** An 8″ cone is still wide at 950 Hz (ka ≈ 1.5).
- **The HF must grow too.** Each doubling of subs adds about 6 dB, and one N314T does not. Plan the HF as a module:
  add horns stacked vertically and splayed (near and far throw), so each covers its own slice and they overlap only
  at the edges. Or move to a larger compression driver.
- **A grown stack is bass-heavy** (subs about 4 dB above the mids). That suits the sound-system style; the front
  end's stepped trims set the final balance.

### Layout as it grows

- **Mid column.** 1 box: both 8″ run to the crossover. 2–3 boxes: a tapered column, one amp channel per box (two
  8 Ω cones in parallel, 4 Ω). Top box to the crossover, the next to about 500 Hz, the lowest to about 250–300 Hz.
- **Subs.** Four bins 2 wide × 2 high put the HF about 3.3 m up. A row of four on the floor keeps the same mouth
  area, uses the floor as a mirror, and keeps the HF about 2.5 m up.
- **Amps.** About 3 channels per side for the smallest stack; about 7 for the largest (2 sub channels at 4 Ω,
  3 mid channels, 1–2 HF).

### Gaps

- The catalog has no plain 8″ mid drivers yet, only 8″ coaxials for fills. Candidates to add: B&C 8NDL51,
  FaitalPRO 8PR200, 18Sound 8NMB420 _(all unverified)_.

## Alignment

The compression driver sits deep in its horn. The mid cone now also sits deep in its horn, so the two acoustic
centers land much closer than in v1.

- **Physical first.** Set the HF horn back or forward on its mount until the upper mid and HF phase curves overlap
  through the crossover. Measure with REW, then pin the position.
- **Tolerance.** At 950 Hz an LR24 sum loses |cos(π·f·Δ)|: −0.2 dB at 25 mm, −0.9 dB at 50 mm, −3.9 dB at 100 mm.
  Within about ±40 mm is good enough.
- **Avoid an overhang.** A horn that sticks out past the stack gets into the crowd space and shadows the mid.
- **Electrical trim, if needed.** Analog all-pass delay holds well at low frequencies. Phase error at the crossover:

| Target                     | Circuit                 | Phase error |
| -------------------------- | ----------------------- | ----------- |
| 0.6 ms at 1 kHz            | 4 × first-order         | 14°         |
| 0.6 ms at 1 kHz            | 2 × second-order Bessel | 0.2°        |
| 0.3 ms at 1 kHz            | 1 × second-order Bessel | ~1.5°       |
| Sub-to-top, 1 ms at 120 Hz | 1 × first-order         | 2°          |
| Sub-to-top, 3 ms at 120 Hz | 1 × second-order        | 3°          |

Put the sub-to-top delay on the full-range top feed, before the mid/HF split, so the mid and HF get the same phase
shift.

## Front end

### Signal chain

```
mixer → bus compressor / system EQ → fixed analog crossover box → amps
```

Clubs split the job the same way: the analog stages shape the sound, and a separate box does the speaker work.

### Mixer and dynamics

- **SSL SiX.** The only compact analog mixer found with a master bus compressor (a 2-knob G-series). About $1,450
  new.
- **A G-style bus compressor**, e.g. the Warm Audio Bus-Comp (about $700), after a clean mixer.
- **SSL 500-series** in a 10-slot frame (Radial Workhorse Powerhouse, about $950): the G-Comp and UV-EQ modules
  _(prices unverified)_. The 500 format is open, so DIY crossover and limiter cards could share the frame.
- Allen & Heath ZED mixers have no compressors. Yamaha MG, Behringer Xenyx and Soundcraft Signature mixers have
  compressors or limiters on channels only.

### Crossover box

| Output    | Filter                               | Setting                     |
| --------- | ------------------------------------ | --------------------------- |
| Subs      | BW24 high-pass, LR24 low-pass        | 31 Hz fixed, 120 Hz stepped |
| Upper mid | LR24 band-pass                       | 120 Hz to 950 Hz            |
| Lower mid | LR24 high-pass, 12 dB/oct low-pass   | 120 Hz to ~300 Hz, stepped  |
| 3rd mid   | LR24 high-pass, 12 dB/oct low-pass   | Big stack only: ~500 Hz     |
| HF        | LR24 high-pass, fixed shelf, limiter | 950 Hz stepped              |

- **Fixed or stepped values.** Fix what the cabinets set (subsonic, delay, horn EQ). Use stepped switches or socketed
  resistors where a measurement may move the value (the HF crossover, the lower mid's roll-off).
- **Cabinet EQ.** Fixed networks sized from measurements of these boxes: the horn shelf, the mid horn's rising
  response.
- **Tune with v1 first.** Use the PLD 4.2 and GXD4 DSP and a measurement mic to find the real values. Then freeze
  them into analog parts.

### Scaling

The boxes stay the same types, so most of the front end stays the same from a small stack to a big one.

**Fixed for every stack size** (set by the box types):

- The crossover points and slopes.
- The cabinet EQ: the horn shelf and the mid horn's response.
- The mid-to-HF alignment inside the stack.
- The HF protection, per HF box and amp.

**Changes with the stack size:**

| What                | Why                                                    | How the box handles it                          |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Band levels         | More boxes in a band add level and coupling            | Stepped level trim per output, in 1 dB steps    |
| Low-mid shelf       | More stacked mids raise the low end of the mid band    | A stack-size switch picks the shelf             |
| Mid roll-offs       | 2.5-way (2 mids) or a tapered column (3 mids)          | One output per mid position; unused ones off    |
| Sub-to-top delay    | Sub count and placement move the subs' acoustic center | Stepped all-pass on the top feed                |
| Number of amp feeds | A big stack drives more amps per band                  | Balanced outputs strong enough for several amps |

Design rules that follow:

- **One card per output.** Build the box as a frame of identical slots: sub, upper mid, lower mid, 3rd mid, HF, per
  side. A small stack leaves the 3rd-mid card out. A 500-series frame or a custom Eurocard rack both work.
- **Size for the big stack.** Plan the frame, the power supply and the outputs for the largest stack, so a small
  stack is a subset.
- **Calibrated steps, not free knobs.** Stepped trims and switches let each stack size come back to the same
  measured settings. Note them on a card per stack size.
- **The HF must keep up.** One N314T per side matches about 2 × 18″ and 2 mids. A big stack needs a second HF per
  side or a bigger compression driver; each HF amp channel keeps its own limiter.

### Horn protection

With no DSP, a wrong patch or a turned knob can send full-range signal to the N314T.

- A series capacitor at the horn: about 40 µF for a corner near 500 Hz at 8 Ω.
- A limiter per HF output, its threshold set from the amp's real voltage gain (28 V RMS is the N314T's 100 W AES
  into 8 Ω).
- Lock the amp gain knobs, or put the gain in the box and run the amps fully up.

## Amps and wiring

| Band      | Load                      | Channel                                             |
| --------- | ------------------------- | --------------------------------------------------- |
| Subs      | 2 × 8 Ω in parallel = 4 Ω | 1 per side; needs real power at 4 Ω                 |
| Upper mid | 8 Ω                       | 1 per side                                          |
| Lower mid | 8 Ω                       | Own channel, or share with a coil (~4.2 mH, 300 Hz) |
| HF        | 8 Ω                       | 1 per side, with the limiter                        |

That is 3–4 channels per side, 6–8 in total. The PLD 4.2 and GXD4 give 6, so the coil option fits. The analog route
needs about three 2-channel class H amps (for example used QSC RMX or Crest CA _(unverified)_). Class H amps are much
heavier than the class D v1 amps.

## Super tweeter

The stacks often add a bullet tweeter above the HF horn for the top octave, about 8–10 kHz up.

- **Adds:** top-octave level without EQ boost on the N314T, a wider top end than the R-OSSE's ~60° at 10 kHz, and
  sizzle.
- **Costs:** another crossover where the wavelength is 34 mm, so some comb filtering. Usually wired on the HF
  channel through a series capacitor.
- **Plan:** skip it at first. Measure the N314T on the R-OSSE, and add one if the top octave falls off or sounds dull
  off-axis. Leave room for it above the horn.

## Fills

An analog box cannot delay a full-range signal, so fills cannot be time-aligned without digital delay. Either drop
fills for this system or accept one small digital delay for them.

## Open questions

1. 10″, 12″ or 8″ mids? The lead option uses 2 × 10″ per box; 8″ is lighter, 12″ crosses lowest per box.
2. 18NBX100 or 4018LF subs, and vented boxes or short front-loaded bins?
3. Sealed or vented mid horns?
4. Mixer and compressor inside the front-end box, or separate units?
5. Fills: drop them, or add a digital delay?
6. Class H amps, or keep the v1 class D amps and bypass their DSP?

## Planner gaps

The planner would need these to model v2 (later, with the system page in
[speaker-designer-plan.md](speaker-designer-plan.md), L4):

- A 1-D horn engine (Hornresp-style): horn segments, front and rear chambers, ports and mouth radiation, for
  front-loaded bins, mid horns and folded horns. See [horn-engine-plan.md](horn-engine-plan.md).
- Horn-loaded mids: their loading and their rising response.
- More than one driver per band, a 2.5-way roll-off and a tapered column.
- A horn setback setting, for the 3D view and the alignment.
- Short front-loaded sub bins, and their loading as bins stack.
- Plain 8″ mid drivers in the catalog.
- More than one HF horn per side.
- A vented mid box.

## Compared: HOQS Paraflex mid-tops

Paraflex (High Order Quarterwave Society) is a different principle: two parallel quarter-wave resonators, a
low-tuned and a high-tuned path, merge into one mouth. Gain comes from resonance near each tuning, not from a flare.

| Point            | 1-D horn mids (SBS / Sunflower)                | Paraflex mid-top (e.g. PF-212, 2 × 8″ plan)                         |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Range            | ~120–150 Hz to ~1 kHz                          | 80–600 Hz; ~900 Hz with phase plugs (PF-212, Fb 70 Hz)              |
| Sub crossover    | ~120–150 Hz                                    | 80–90 Hz                                                            |
| HF crossover     | 950 Hz suits the R-OSSE                        | 800–900 Hz at most: tight for the R-OSSE's 950 Hz                   |
| Pattern          | Horizontal control from the flare              | Little mid control; forward-biased cardioid, per HOQS               |
| Alignment        | Mostly geometric: align physically with the CD | Delay varies with frequency near the tunings: wants DSP             |
| Tuning and build | Mouth size and depth; curved side walls        | Two resonators tuned and phase-aligned; stuffing, Helmholtz dampers |

- **For this plan, the horn mids fit better:** they reach the HF crossover, control the pattern and align without
  DSP.
- **Paraflex suits a small, light two-box system** (a 2 × 8″ top plus a sub, crossed at 80–90 Hz) with DSP. It
  could be a separate small-gig top, not a module of this stack.
- HOQS also has a coaxial (CX) variant with the HF horn in the mouth.

Sources: [PF-212 MK1 mid-top](https://github.com/High-Order-Quarterwave-Society/PF-212-MK1-mid-top),
[Paraflex FAQ](https://github.com/High-Order-Quarterwave-Society/About-Paraflex-systems-FAQ),
[HOQS store](https://hoqs.org/), [HOQS Australia projects](https://www.hoqs.com.au/projects).

## Reference stacks

- [SBS Slammer stack at Analog BKNY](https://sbsslammer.wordpress.com/wp-content/uploads/2018/02/photo-oct-19-12-46-59-pm.jpg)
  (photo): two dual-cone bass bins, three single-cone 1-D mid horns, a wide HF horn and a bullet tweeter.
- Sunflower Sound System (Instagram photo shared by the owner): two mid boxes, each with two cones stacked in one
  1-D horn throat; side ports; a wide HF horn; three small openings above it, likely super tweeters
  _(unverified)_.
