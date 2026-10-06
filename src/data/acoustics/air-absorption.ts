// Air absorption for the coverage map, dB per meter, at 20 °C, 50 % relative humidity and 101.325 kPa: ISO 9613-1's
// pure-tone attenuation, worked out from the standard's equations at the octave centers (they agree with its Table 1,
// e.g. 4.66 dB/km at 1 kHz, 105 dB/km at 8 kHz). The two rows pair up: one frequency, one attenuation.

/** The octave centers the table gives, Hz. */
export const AIR_HZ = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** The attenuation at each of those frequencies, dB per meter. */
export const AIR_DB_PER_M = [
  0.00012, 0.00044, 0.00131, 0.00273, 0.00466, 0.00989, 0.0297, 0.1053, 0.3645,
] as const;
