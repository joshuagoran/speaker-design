# App terms

Each term has one meaning in the app. Check new UI text against this table.

| Term             | Meaning                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Source           | A Speaker or Stack placed in a Space.                                                                                                  |
| Signal           | The audio to a Source.                                                                                                                 |
| Gain             | A level change in dB on one amp channel: an active band, a box in a Stack, or a Source in a Space.                                     |
| Pad              | A cut in dB on a passive band, in the box. It is 0 dB or less.                                                                         |
| System gain      | One gain in dB on all Sources in a Space. It is 0 dB or less.                                                                          |
| Level            | A sound level in dB SPL that the app calculates.                                                                                       |
| Target level     | The level that the Space must get in the lowest band, at the Measured at location.                                                     |
| Band balance     | How the target changes above each crossover. Flat keeps it the same. More bass makes it quieter.                                       |
| Measured at      | The location where the Space compares its level with the target.                                                                       |
| Listener         | The point in the room where the app calculates the listener level and the arrival times.                                               |
| Main             | A Source that plays to the whole audience.                                                                                             |
| Fill             | A Source that plays to one area. It arrives after the nearest main, at that main's level.                                              |
| Calculate gains  | Sets the gains for a flat result. Speaker: the band gains and pads. Stack: the box gains. Space: the Source gains and the System gain. |
| Calculate delays | Sets each Source's delay. The mains arrive together at the listener. Each fill arrives after the nearest main.                         |
| Headroom         | How far in dB a box or band is below its limit.                                                                                        |
