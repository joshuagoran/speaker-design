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
- `hr_run` answers "Yes" to masking the chamber resonances: lumped chambers, as the horn engine has. If Tools >
  Options is set to "Masked", Hornresp does not ask. A tapped horn's chambers are passages either way.

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
  mouth's wall angle, degrees) after a conical or parabolic one. Hornresp recalculates the value from the geometry.
- **Repeated keys.** `Le` and `Rms` appear again in the advanced driver sections. Change only the first.
- **Driver values.** Hornresp takes Mmd (the moving mass without air load) and Cms, Rms; not Fs and Qms.
  `tests/hornresp.test.ts` (`designOf`) shows the conversion.
- **Several drivers** are one composite driver: Sd, Mmd and Rms add; Cms, Re and Le divide.
- **The layout key.** The line after `Re` is the driver count: `Nd = 1` for a normal horn. `OD = 1` makes an
  offset-driver horn and `TH = 1` a tapped horn. Hornresp imports and exports the key in that line.
- **End correction.** Set `End Correction Flag = 0`, so Lpt is the vent's length plus its inner end correction.
- **Path length.** Keep `Acoustic Path Length = 0`: it is not the engine's `portOffset`.

## Tapped and offset-driver reference records

`records/` holds six records, as Hornresp exported them. Their results are in `tests/hornresp/`, and
`tests/hornresp-reader.test.ts` checks them.

| Record                | Layout | Design                                                                 |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| `th-thorn10`          | TH     | A Thorn-like 10″ tapped horn, 200 cm conical path                      |
| `th-thorn10-chambers` | TH     | `th-thorn10` with both chambers: Vtc 1500 cc, Atc 300; Vrc 6 L, Lrc 20 |
| `th-15`               | TH     | A 15″ tapped horn, 300 cm conical path                                 |
| `th-15-four`          | TH     | `th-15` in four sections: the rears tap S4                             |
| `od-skram`            | OD     | SKRAM-like: parabolic, from its FreeCAD model; Vrc 120 L is a guess    |
| `th18-xoc1`           | TH     | TH18 by Xoc1 (PD 1850/3), as published on its plans page; Rg 0.1 Ω     |

To run one again, use `hr_run` as for any case. The layout key is in the record. Do not step the layout with the
Nd label in Hornresp: its OD3 step (a Ripole) rewrites the horn's values.

Hornresp's tapped horn, as these runs show:

- **Sides.** The cone's front taps S2, its rear S3 (S4 with four sections).
- **Chambers.** Vtc and Vrc are passages from the cone to its tap, not lumped volumes. Vtc has the area Atc. Vrc has
  the length Lrc. Masking does not change them.
- **Export.** A TH record has `Ap` and `Lpt` in place of `Added Mass` and `Acoustic Path Length`, and
  `End Correction Flag = 1`. No end correction applies to a TH.

## Export names

Hornresp rejects long export file names. `hr_calc_export` saves as `out` and renames.
