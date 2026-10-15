# hornresp

Tools to run Hornresp (David McBean's horn simulator, Windows only) under Wine on Linux, for the horn engine's
reference tests (`tests/hornresp.test.ts`). They are not part of the build, the tests or CI.

- `make_record.py`: writes a Hornresp record (an import file) from a template record and new values.
- `courier_font.py`: makes the "Courier New" font Hornresp needs.
- `hornresp.sh`: drives Hornresp with `xdotool`. It starts it, sets the air, imports a record, calculates it and
  exports the results.

The script clicks at screen positions, so it is fragile. It works on a 1600 × 1000 Xvfb screen with no window
manager. Check a step with `shot NAME` (a screenshot) when something goes wrong.

## Set up (Ubuntu 24.04, once per container)

1. Install 32-bit Wine, a virtual display and the GUI tools:

   ```sh
   dpkg --add-architecture i386 && apt-get update
   apt-get install -y wine wine32:i386 xvfb xdotool imagemagick
   ```

2. Download Hornresp from hornresp.net (`Setup.exe`). It is a zip: unzip it to a folder, `HR_DIR`.
3. Make a Wine prefix: `WINEPREFIX=<dir> wineboot -i`.
4. Give Wine a "Courier New" font. Hornresp stops without it. `courier_font.py` copies Liberation Mono under that
   name into the prefix's `Fonts` folder (its header shows how).

## Run a case

```sh
export HR_DIR=<hornresp folder> WINEPREFIX=<prefix> SHOT_DIR=/tmp
source tools/hornresp/hornresp.sh
hr_start                     # up to a minute on a new container
hr_set_air                   # 343 m/s, 1.18 kg/m³: the planner's air
hr_run my-case my-case.txt   # import, calculate, export to $HR_DIR/Export/my-case-data.txt
hr_trim "$HR_DIR/Export/my-case-data.txt" > tests/hornresp/my-case-results.txt
hr_stop
```

- **Set the air each time.** A new container starts with Hornresp's defaults (344 m/s, 1.205 kg/m³). With them the
  SPL reads ~0.15 dB higher.
- **Check the setup first.** Run a committed case and compare it with its results file. It must be identical.
- `hr_run` answers "Yes" to masking the chamber resonances: lumped chambers, as the horn engine has.

## Make a record

Start from a committed record (`tests/hornresp/*.txt`) and change what differs:

```sh
python3 tools/hornresp/make_record.py tests/hornresp/mid-vented.txt my-case.txt \
  --comment "validation: my case" --set Le=0.60 --vent 120:23.31 --segments exp:400:1400:35
```

Units are Hornresp's: areas cm², lengths cm, Vrc litres, Vtc cc, Le mH, Mmd g.

### Hornresp's rules for a record

Hornresp rejects a record that breaks one of these as "not a valid record", with no reason. `make_record.py`
applies them.

- **CRLF** on every line.
- **Segment rows chain.** Each row starts with the row before's end area.
- **The mouth key.** `Cir` (mouth circumference in cutoff wavelengths) after an exponential segment; `Fta` (the
  mouth's wall angle, degrees) after a conical one. The value must agree with the geometry.
- **Repeated keys.** `Le` and `Rms` appear again in the advanced driver sections. Change only the first.
- **Driver values.** Hornresp takes Mmd (the moving mass without air load) and Cms, Rms; not Fs and Qms.
  `tests/hornresp.test.ts` (`designOf`) shows the conversion.
- **Several drivers** are one composite driver: Sd, Mmd and Rms add; Cms, Re and Le divide.
- **End correction.** Set `End Correction Flag = 0`, so Lpt is the vent's length plus its inner end correction.
- **Path length.** Keep `Acoustic Path Length = 0`: it is not the engine's `portOffset`.

## Tapped and offset-driver reference records

`records/` holds three records for the acoustic network's next check (`tests/hornresp-reader.test.ts`). Their
results tests are skipped until Hornresp's results exist.

| Record       | Layout | Design                                                              |
| ------------ | ------ | ------------------------------------------------------------------- |
| `th-thorn10` | TH     | A Thorn-like 10″ tapped horn, 200 cm conical path                   |
| `th-15`      | TH     | A 15″ tapped horn, 300 cm conical path                              |
| `od-skram`   | OD     | SKRAM-like: parabolic, from its FreeCAD model; Vrc 120 L is a guess |

1. Import the record.
2. Set the driver layout in Hornresp (TH or OD). The records leave it out: the record key is not known yet.
3. Calculate, then export the results as for any case. Save them as `tests/hornresp/<record>-results.txt`.
4. Export the record too, and replace the file in `records/`. It then carries Hornresp's own layout key.
5. Remove the `skip` from the record's results test. If the reader does not know the layout key, add it to
   `HORNRESP_LAYOUT_KEY` (`src/constants/acousticNetwork.ts`).

Check these points in the run:

- **TH sides.** The reader puts the cone's front at S2 and its rear at S3. The other way round flips the phase only.
- **TH chambers.** The reader puts Vtc on the front side and Vrc on the rear side.
- **The mouth key after a Par section.** `make_record.py` writes `Fta`, as for a conical section. Hornresp may want
  another key.

## Export names

Hornresp rejects long export file names. `hr_calc_export` saves as `out` and renames.
