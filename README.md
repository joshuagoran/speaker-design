# sound-system

Design tools for a DIY sound-system-style rig: two full-range stacks for rooms of
500–1000 sq ft, sometimes outdoors, plus loud home listening.

## Tools

| File | What it does |
|---|---|
| `tools/vented-sub-bench.html` | Standalone, self-contained. Sliders for cabinet W/H/D, vent type (letterbox / round tubes / side ducts), duct length and highpass. Reports net volume, tuning, F3, the limit that bites first, max SPL and weight. |
| `tools/stack-planner.app.jsx` | The full stack planner: driver and cabinet options, live 3D view, cost roll-up, alignment table. Custom-cabinet mode drives the 3D model from W/H/D and vent sliders. Saved configurations persist in the artifact's document store. Built with `tools/build.sh`. |
| `model/vented-box.js` | The shared physics. Lumped-element vented-box model plus the limit taxonomy. Both tools use the same maths. |

## Building the planner

```sh
tools/build.sh          # -> dist/stack-planner.html
```

The planner declares the artifact `db` capability for saved configurations.
Running it from a plain file server works, minus saving: the page detects the
missing runtime and says so rather than breaking.

The sub bench needs no build. Open it directly, or serve the directory.

## Design constraints

These drive every choice in the tools:

- Must clearly outperform a pair of 1000 W powered tops plus a single powered 18" sub.
- No box over **125 lb**.
- Driver budget: **$400 / 18", $300 / 12", $200 / compression driver**.
- **US vendors only.** Parts Express, US Speaker, Madisound, Loudspeakers Plus, B&H, Full Compass, WAAT.
- Six to eight amp channels total. Currently planned around a Powersoft Ottocanali 4K4.
- Prices verified from vendors, dimensions from plans and datasheets — never recalled.

## Model assumptions

Half space, 1 m, one cabinet, no room gain. Port limit at 17 m/s peak air speed.
Thermal limit at the driver's AES rating. Cabinet weight assumes 3/4" birch at
2.3 lb/ft² with two braces, plus driver and 6 lb of hardware.

Verify Fb with an impedance sweep on the prototype before cutting birch.

See `docs/design-notes.md` for the findings behind the current configuration.
