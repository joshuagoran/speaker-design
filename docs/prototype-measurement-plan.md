# Prototype measurement plan

Measure the first 18 in sub prototype to check the app's model.
Build order: a reflex (vented) box first, then the horn-loaded boxes.

## Goal

Each measurement checks one figure that the Speaker page shows.

| Page figure                                          | Measurement                | What it checks                                                                           |
| ---------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| Driver specs (catalog)                               | Free-air impedance         | The catalog's datasheet figures                                                          |
| Fb (tuning mark on the charts)                       | Boxed impedance curve      | The vent end-correction rule (open item 13 in `docs/calc-audit.md`; moves tuning 2–6 Hz) |
| Response chart (dB SPL, 2.83 V, 1 m)                 | Near-field sweep           | Level, shape, and the lower F3 slope                                                     |
| Maximum output chart (max dB SPL, 1 m) and its limit | Stepped-voltage test       | The maximum output and the limit that stops it                                           |
| Port air speed limit (Chamber setting)               | Port noise and compression | The air speed limit you set                                                              |

The page does not show impedance, cone travel, or port air speed as figures.
The model uses them inside the maximum output chart.
So the tests compare level and tuning, not those internals.

## Equipment

| Item                      | Low-cost option           | Use                                            |
| ------------------------- | ------------------------- | ---------------------------------------------- |
| Impedance meter           | Dayton DATS, or a REW jig | Thiele-Small figures and box tuning            |
| Measurement microphone    | Calibrated USB or XLR mic | Near-field sweep and the high-level test       |
| Audio interface           | Any with a mic preamp     | Sweeps and the REW jig                         |
| Voltmeter (true RMS)      | Basic multimeter          | Set and log the voltage at the terminals       |
| Amp with a known gain     | The planned amp           | Drive the box                                  |
| Software                  | REW (free)                | Sweeps, impedance, and the SPL meter           |
| Tape measure and calipers | Any                       | Record the real vent length and the box volume |

Record the real built vent length and net air volume.
Enter them in the page before you compare.

## Safety rules

- Put a high-pass filter ahead of the amp, below the box's tuning.
- Put a limiter on the amp input.
- Wear hearing protection for every test above 90 dB.
- Use short bursts, 1–2 seconds, with long gaps.
- Watch the cone. Stop at the first sign of bottoming, rubbing, or buzzing.
- Never exceed the driver's rated power or Xmax.
- Raise the voltage in small steps. Stop at once if the sound turns harsh.
- Keep the amp gain low at the start of each session.

## Steps

### 1. Driver Thiele-Small figures

1. Measure the driver free in air, before you mount it. Use the DATS or REW jig.
2. Run it at low level for a short break-in, about 30 minutes. Measure again.
3. Record Fs, Re, Qes, Qms, Qts, Vas, and Sd if you can.
4. Compare with the catalog's datasheet figures for this driver.
5. Enter the measured figures for the later runs.

### 2. Box tuning from the impedance curve

1. Mount the driver. Seal every joint. Fit the vent at its built length.
2. Measure the impedance from 10 Hz to 200 Hz.
3. Find the two peaks. The tuning is the frequency of the minimum between them.
4. Record that frequency and the two peak frequencies.
5. Compare with the Fb the page marks for the same box.
6. Repeat with the vent shortened by a known step. Record each Fb.

The difference settles the vent end-correction rule.
Compare the measured shift with each rule's prediction.

### 3. Near-field response

1. Put the mic at the cone center, 1–2 cm from the dust cap. Sweep at 2.83 V.
2. Move the mic to the vent mouth. Sweep again at the same voltage.
3. Sum the two curves. Scale each by its radiating area, `Sd` for the cone and the vent's area for the vent.
4. Add the phase of each sweep. Sum the complex values, not the dB values.
5. Use the summed curve below about 200 Hz. Above that, the near-field method fails.
6. Compare with the page's response at 2.83 V, 1 m.

Reference the level to 1 m with the usual near-field scaling.
Note the room: outdoors on a flat floor matches the page's half space best.

### 4. High-level test

1. Pick four test frequencies: 30, 40, 50, and 63 Hz.
2. Set the mic 1 m from the cone, on axis, outdoors if you can.
3. Send a short tone burst. Start 20 dB below the page's maximum for that frequency.
4. Raise the voltage in 3 dB steps. Log the voltage and the level at each step.
5. Plot level against voltage. The slope is 1 dB per dB until a limit acts.
6. Record the voltage and level where the slope drops below 1 dB per dB.
7. Stop at the page's maximum level, plus no more than 3 dB. Never go past the driver's rating.
8. Compare with the page's maximum output at each frequency and its named limit.

The limit names the page uses are cone travel (Xmax), port air speed, the driver program rating, and the amp.
Note which one you see: a bottoming sound, port noise, heat, or amp clipping.

### 5. Optional: port noise and compression

1. At 40 Hz and at the tuning, raise the level until you hear air noise at the vent.
2. Record the voltage and level at the first noise.
3. Hold a 5-second burst at that level. Check the level over the burst.
4. Record the level drop (power compression) after the burst.
5. Compare the noise onset with the page's air speed limit setting.

## Results table

| Test                    | Frequency      | Model (page) | Measured | Difference | Note |
| ----------------------- | -------------- | ------------ | -------- | ---------- | ---- |
| Fs (Hz)                 | free air       |              |          |            |      |
| Qts                     | free air       |              |          |            |      |
| Vas (L)                 | free air       |              |          |            |      |
| Fb (Hz)                 | box impedance  |              |          |            |      |
| Fb, vent shortened (Hz) | box impedance  |              |          |            |      |
| Level (dB, 2.83 V, 1 m) | 30 Hz          |              |          |            |      |
| Level (dB, 2.83 V, 1 m) | 50 Hz          |              |          |            |      |
| Level (dB, 2.83 V, 1 m) | 80 Hz          |              |          |            |      |
| F3 (Hz)                 | response       |              |          |            |      |
| Max output (dB, 1 m)    | 30 Hz          |              |          |            |      |
| Max output (dB, 1 m)    | 40 Hz          |              |          |            |      |
| Max output (dB, 1 m)    | 50 Hz          |              |          |            |      |
| Max output (dB, 1 m)    | 63 Hz          |              |          |            |      |
| Limit that acts         | each frequency |              |          |            |      |
| Port noise onset (dB)   | optional       |              |          |            |      |

## What to do with the results

| Result                                                   | Model setting to correct                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Driver figures differ from the datasheet                 | The driver's catalog entry (`src/data/catalog/`)                     |
| Measured Fb differs from the page's Fb                   | The vent end-correction rule (item 13 in `docs/calc-audit.md`)       |
| Level offset in the passband                             | The driver sensitivity figures, or the mic calibration               |
| F3 or low-end slope differs                              | The box volume, loss values (leakage, vent loss), or the vent length |
| Maximum output is lower than the page, at the Xmax limit | The driver's Xmax entry                                              |
| Maximum output is lower than the page, with port noise   | The port air speed limit in the chamber                              |
| Maximum output is lower, with heat or compression        | The driver's power rating figure                                     |

Fix the model only when two or more runs agree.
Use the corrected rule for the horn-loaded boxes.
Measure those with the same steps. Compare with the horn engine's response (`docs/horn-engine-plan.md`, step 5).
