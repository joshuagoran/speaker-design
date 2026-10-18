# Catalog expansion plan

Status: on hold (cost). Read Oct 2026.

## Goal

- Add the pro and hi-fi drivers that US vendors sell, 5–21 in, plus compression drivers, tweeters, coaxials and triaxials.
- Help the optimizers find good values for a specific box. A cheap driver can be the best fit for one design.

## Rules for each driver

| Rule                | Detail                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep                | Every pro or hi-fi driver from a quality maker with a full datasheet and a US price. Budget lines stay in.                                                      |
| Full datasheet      | Thiele-Small figures, AES power, and a comparable Xmax (coil and gap heights, or a stated formula). Compression drivers: lowest crossover and a response curve. |
| Source              | Figures from the maker's datasheet. Prices from US Speaker (or Parts Express, Madisound).                                                                       |
| Leave out           | Brands with no full datasheets. Guitar, bass instrument, car audio and OEM replacement parts.                                                                   |
| Leave out           | Versions that change only the cone color or the frame.                                                                                                          |
| Leave out           | 4 Ω or 16 Ω versions with no datasheet of their own.                                                                                                            |
| Keep both           | Ferrite and neo pairs (weight matters).                                                                                                                         |
| Compression drivers | Read the response and impedance curves. Use the maker's lowest crossover unless the curve is far below it (for example 12 dB down). Say so in the note.         |

## What is left to add

US Speaker inventory, Oct 2026: 439 models not in the catalog. Model lists: `docs/catalog-inventory.md` (index pages only; not checked against datasheets).

| Maker                     | 5–8 in | 10 in | 12 in | 15 in | 18 in | 21 in | Compression | Tweeters | Coaxials |
| ------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----------- | -------- | -------- |
| Beyma                     | 23     | 8     | 9     | 6     | 4     | 3     | 41          | 14       | 8        |
| B&C                       | 16     | 8     | 11    | 10    | 4     | 5     | 24          | –        | 14       |
| FaitalPRO                 | 24     | 5     | 10    | 6     | 5     | 1     | 2           | –        | 7        |
| Eminence                  | 6      | 8     | 11    | 14    | 3     | 1     | 7           | 3        | 1        |
| Radian                    | 2      | –     | 1     | 1     | 1     | –     | 15          | 3        | 6        |
| RCF                       | 1      | –     | 3     | 9     | 8     | –     | 8           | –        | –        |
| JBL, Ciare, 18 Sound, BMS | 5      | 4     | 5     | 5     | 4     | 1     | 11          | 5        | 4        |
| P.Audio, EV, Peavey       | –      | 1     | –     | 3     | 1     | –     | 4           | 5        | –        |

- Compression counts include line-array drivers and coaxial HF units.
- B&C triaxial: 18HTX100 ($1,359.90, US Speaker). The 15HTX100 has no US vendor.
- The Beyma G40 line is a woofer line (Beyma datasheets), not a bass guitar line. US Speaker's index groups it with bass units.

## Gaps outside US Speaker

- Hi-fi makers (Scan-Speak, Seas, SB Acoustics, Purifi, Dayton, Peerless, Fostex): not at US Speaker. Madisound sells them; its pages are readable.
- Celestion pro drivers: US Speaker sells only Celestion guitar speakers.
- Parts Express product pages need a browser (the price is drawn by script).

## Code changes first

| Part                              | Change                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 21 in subs (11 models)            | Add 21 to the sub size type.                                                                    |
| 12 in subs (e.g. Beyma 12SCF1300) | Add 12 to the sub size type.                                                                    |
| 5–8 in pro midranges              | Add a size or table for them (the mid table is 10, 12 and 15 in).                               |
| Triaxials                         | Add a type with a midrange section. Build with the modular Speaker page.                        |
| Coaxials 12–15 in                 | Data fits the coaxial table now. The fill page is going away; the Speaker page builds coaxials. |

## Open questions

1. Include P.Audio, Peavey and EV? Include JBL only where it publishes full data?
2. Size and type changes: in the catalog PR, or a PR before it?
3. Hi-fi drivers from Madisound: now or later?
4. Writers on Sonnet to save tokens, with one review at the end?

## Cost

| Item             | Figure                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| Last batch       | About 14,000 tokens per entry (lookup, writing, review).                              |
| Expected entries | About 300 after the rules.                                                            |
| Expected cost    | About 4 million tokens, several hours of background agents. Sonnet writers cost less. |

## How to run it

1. A Haiku agent downloads each maker's datasheets (`curl`, then `pdftotext -layout`). WebFetch cannot read PDFs.
2. One fresh writer agent per table (subs, mids, compression drivers, coaxials) adds the entries. It checks each set: Vas from Fs, Mms and Sd, and Qes from Bl and Re, within about 10 %.
3. Rewrite the optimizer snapshots (`vp run optimizer-snapshot`, `stack-optimizer-snapshot`, `speaker-optimizer-snapshot`).
4. Run `vp check` and the driver, table, horn mount and optimizer tests.
5. One Sonnet review checks every entry against its datasheet text.
