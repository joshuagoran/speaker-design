# Amp and DSP plan: v1

The owner's plan to run the stereo 3-way PA (per side: 1 sub, 1 mid, 1 horn) for a v1 build with no external
DSP: a QSC PLD 4.2 (about $530 used _(unverified)_) plus the owner's QSC GXD4. The amp facts come from the QSC and
Lab.gruppen manuals under [Sources](#sources), checked Oct 2026; anything marked _(unverified)_ comes from the
owner's notes or listings only. Planner defaults are from `src/lib/defaults.ts` (`DEFAULT_PA`) and
`src/data/catalog/amps.ts`.

## Hardware

- **PLD 4.2**
  - 4 channels, 400 W per channel at 8 Ω, 1600 W total with FAST power sharing. Two channels bridged (A+B, C+D)
    or paralleled (AB, CD) give 800 W at 8 Ω.
  - DSP per output: Butterworth, Linkwitz-Riley or Bessel-Thomson filters at 6–48 dB/oct (depending on the type),
    a 5-band PEQ with low and high shelves, and 0–50 ms of delay in 1.0 ms steps (coarse).
  - Limiter: AUTO (Mild / Medium / Aggressive from a speaker power and impedance) or ADV, with RMS (3–100 V) and
    peak (5–155 V) thresholds in volts plus attack and release.
  - Input routing per output: 1, 1+2, 2, 2+3, 3, 3+4 or 4.
  - 50 user presets. Four XLR inputs, each with a male XLR in parallel for daisy-chaining. NL4 outputs.
- **GXD4**
  - 2 channels, 400 W per channel at 8 Ω (600 W at 4 Ω).
  - LR24 only: high-pass 20 Hz–4 kHz, low-pass 60 Hz–4 kHz. A 4-band PEQ (±12 dB, 0.1–3 oct) with no shelves.
  - 0–50 ms of delay. The manual doesn't state the step; its example reads 8.48 ms, so 0.01 ms steps
    _(unverified)_.
  - Limiter: Mild / Medium / Aggressive plus a speaker power (5–400 W at 8 Ω) and impedance. No threshold in volts,
    and QSC don't say what threshold the power sets.
  - 18 user presets. XLR and ¼″ TRS inputs in parallel; NL4 and binding-post outputs.

## Patch

Horns go on the PLD and mids on the GXD4 (a swap from the owner's first draft).

1. Source L to PLD input 1, source R to PLD input 2. The PLD's parallel XLRs on inputs 1 and 2 feed GXD4 inputs 1
   and 2.
2. Route the outputs:

   | Output | Speaker | Input | Processing                                                                  |
   | ------ | ------- | ----- | --------------------------------------------------------------------------- |
   | PLD A  | Sub L   | 1     | LR24 low-pass at the sub crossover (default 120 Hz); BW24 subsonic at 31 Hz |
   | PLD B  | Sub R   | 2     | The same. For mono subs, route 1+2 and cut the sub gain about 6 dB.         |
   | PLD C  | Horn L  | 1     | LR24 high-pass at about 950 Hz–1 kHz, shelf EQ, limiter in volts            |
   | PLD D  | Horn R  | 2     | The same                                                                    |
   | GXD4 1 | Mid L   | 1     | LR24 band-pass from about 120 Hz to 950 Hz–1 kHz, fine delay                |
   | GXD4 2 | Mid R   | 2     | The same                                                                    |

### Why the swap

- **Horn protection.** The N314T is rated 100 W AES, 28 V RMS into 8 Ω. The GXD4 puts out about 57 V RMS, and
  its limiter takes no threshold in volts. The PLD's ADV limiter can cap the horn at about 25–28 V peak.
- **Horn EQ.** The PLD has the shelf filters a horn needs; the GXD4 has none.
- **Fine delay where it's needed.** The compression driver sits about 200 mm or more behind the mid cone (about
  0.6 ms), so the mids usually need delay to line up with the horns. That is below the PLD's 1 ms step; the
  GXD4's fine steps land on it.
- **Subs stay on the PLD.** 1 ms steps are fine at low frequency. Use the PLD steps for coarse sub alignment and
  the GXD4 mid delay to trim.

### Crossover

- Cross at about 950 Hz–1 kHz: the DIY R-OSSE horn (`diy_rosse110x50`) needs 950 Hz or more. The planner's
  default is 900 Hz, on its default horn, the ATH A460G2.
- Don't cross at 1.5 kHz: the 12″ cone is far too wide at that frequency, so it beams much narrower than the horn.

### Presets

- One user preset per amp restores the whole system. Name them, e.g., "STACK 3W" (PLD) and "MID 1K0" (GXD4).
- Changing the PLD's output configuration mutes all 4 channels.

## Limitations and to-dos

- Measure the latency between the two amps with REW and a mic.
- No system EQ before the crossover: do room EQ at the source, or repeat it on each output.
- No master level across both amps: set the volume at the source or mixer.
- The GXD4's front knobs set each channel's digital gain (−100 to +10 dB). Lock them (Utilities > Lockout >
  Lock All) or note their settings.
- No FIR. The PLD's Intrinsic Correction works only with QSC speaker profiles.
- All 6 channels are used, so fills need another amp.

### Power against the planner defaults

| Band | v1 power          | Planner default  | Result                                                   |
| ---- | ----------------- | ---------------- | -------------------------------------------------------- |
| Sub  | 400 W at 8 Ω      | 800 W (`ampW`)   | Up to 3 dB less sub-bass (less where cone travel limits) |
| Mid  | 400 W at 8 Ω      | 400 W (`mAmpW`)  | Meets the default                                        |
| Horn | PLD 400 W, capped | 100 W (`hfAmpW`) | The limiter sets it                                      |

### Verify on the unit

- The PLD delay step (the manual says 1.0 ms) and the GXD4 delay step.
- The PLD loop-through (the manual's parallel male XLRs).
- The PLD 4.2's power in 3-channel mode: the manual charts only the 4.3 and 4.5.
- The PLD 4.2's continuous power: the manual's footnote says one channel driven, the spec sheet all channels.

## Alternative considered: Lab.gruppen C 20:8X

About $550 used _(unverified)_. A discontinued install amp _(unverified)_.

- **No DSP.** Just a fixed 35 Hz 6 dB/oct high-pass (switchable per channel) and a DIP-switch voltage peak limiter
  (100 / 63 / 45 / 32 V peak).
- **Power.** 8 × 250 W at 8 Ω (and at 4 Ω). Pairs A+B, C+D, E+F, G+H bridge to 500 W at 8 Ω or 4 Ω (2 Ω not
  recommended). 8 A RMS current limit per channel. No power sharing. Phoenix inputs, screw-terminal outputs.
- **Owner's idea.**
  - Subs on two bridged pairs: 500 W each, about 2 dB under the planner's 800 W, more near tuning and the
    crossover where the 8 A limit bites _(unverified)_.
  - Mids and horns on the other 4 channels at 250 W: the mids about 2 dB under the 400 W default. The horns'
    45 V peak setting is 32 V RMS, about 126 W into 8 Ω, above the N314T's 100 W AES; the 32 V setting gives
    about 64 W.
  - Fills on the GXD4.
- **Needs an external DSP**, e.g., a dbx DriveRack PA2 (2 in / 6 out, about $300–400 used) _(unverified)_, plus
  Phoenix-to-XLR and screw-terminal-to-NL4 adapters.
- **Verdict.** The PLD 4.2 + GXD4 is the v1 pick: no external DSP, cheaper, and equal or better power. The
  C 20:8X makes sense only with one DSP in front of everything, fills included.

## Future

An external DSP adds system EQ, one master control, finer alignment and FIR. The planned system page
([speaker-designer-plan.md](speaker-designer-plan.md), L4) will model amps, channels and DSP per speaker.

## Sources

- [QSC PLD user manual](https://www.qscaudio.com/resource-files/productresources/amp/pld/q_amp_pld_usermanual.pdf)
- [QSC PLD spec sheet](https://www.qscaudio.com/resource-files/productresources/amp/pld/q_amp_pld_specs.pdf)
- [QSC GXD user manual](https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_usermanual.pdf)
- [Lab.gruppen C Series operation manual rev 1.1.5](https://www.fullcompass.com/common/files/27161-LabGruppenC4XOperationManual.pdf)
  (hosted by Full Compass)
