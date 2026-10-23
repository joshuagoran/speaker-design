# Metric units: plan

Issue: #149.

## Goal

- A user picks Metric or US. Every length, area, volume, mass, and speed on the page follows it.
- The model moves to metric in steps. Each step keeps every result the same, to rounding.

## Decisions

| Question                                          | Answer                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Volume in the types                               | Liters (L)                                                                                             |
| Default for new users                             | US. Volumes in liters, by a separate Volume setting (liters or ft³).                                   |
| Display first, or internal units at the same time | Display first (step 1). The internal move follows in small steps (steps 3–6). See "Why display first". |
| Box lengths in the types                          | mm                                                                                                     |
| Where the setting lives                           | A gear menu in the header: Theme, Units, and Volume.                                                   |
| Saved designs                                     | Deferred. Decide before step 3.                                                                        |

## Today

| Quantity                     | Unit in the code             | Where                             |
| ---------------------------- | ---------------------------- | --------------------------------- |
| Box sizes, positions, panels | inches                       | 62 `…In` fields in `src/types.ts` |
| Room and stack places        | feet                         | 12 `…Ft` fields                   |
| Horn sections                | cm, cm²                      | the horn engine (as Hornresp)     |
| Volume                       | L                            | `netLiters` and the driver data   |
| Mass                         | lb                           | weights in 74 files               |
| Unit conversions             | `src/constants/units.ts`     | used in 20 files                  |
| Length text                  | `formatInches` and fractions | used in 20 files                  |

## Why display first

- Step 1 gives users metric at once, with no change to the model.
- The display layer is needed either way. The internal steps then only change what sits behind it.
- Each internal step is small and checks against the same results.

## Steps

Each step is one PR.

| Step | Work                                                                                                                                                                                                                                                                                                               | Proof that nothing else changes                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 1    | A settings menu in the header with the Metric / US setting and the theme switch (saved per browser; US by default). Done. One display layer: a length, area, volume, and mass field and readout that convert at the edge. Every field and readout uses them. Steps per unit: 1 mm or 5 mm in metric, 1/8 in in US. | Tests: every field shows the same value in both settings, to rounding. The spec stays in inches. |
| 2    | Cutlist and build text: mm in metric, inch fractions in US. Plywood names follow the setting (18 mm, 3/4 in).                                                                                                                                                                                                      | Cutlist golden files in both settings.                                                           |
| 3    | Mass to kg in the types and the model.                                                                                                                                                                                                                                                                             | Weight tiles and goldens the same, to rounding.                                                  |
| 4    | Room and stack places to m.                                                                                                                                                                                                                                                                                        | Stack, Space, and coverage goldens the same.                                                     |
| 5    | Box sizes, positions, and panels to mm.                                                                                                                                                                                                                                                                            | Speaker, Hi-fi, and PA goldens, the optimizer snapshot, and the cutlist the same.                |
| 6    | Horn geometry: one unit with the box (mm), not cm.                                                                                                                                                                                                                                                                 | Horn goldens and Hornresp parity the same.                                                       |
| 7    | CLAUDE.md units rule. Remove the old conversions that nothing uses.                                                                                                                                                                                                                                                | `vp check`, with no unused exports.                                                              |

## Rules for the internal steps

- One unit per quantity in the types: mm for lengths, L for volume, kg for mass, m for room distances, Hz, and dB.
- Field names carry their unit (`widthMm`, `netLiters`, `massKg`).
- Conversions happen only in the display layer and in the catalog's derive step (`src/lib/data.ts`).
- The catalog keeps values as the maker publishes them. Nominal sizes stay as names ("18 in").

## Saved designs

Deferred. Decide before step 3, the first step that changes the types. #149 says saves can break, but saved speakers, stacks, and spaces are now in the library.

| Option                                                                      | Cost                     |
| --------------------------------------------------------------------------- | ------------------------ |
| Read old saves through one adapter per step (as `speakerSaves.ts` does now) | A small adapter per step |
| Let old saves break                                                         | Users lose saved designs |
