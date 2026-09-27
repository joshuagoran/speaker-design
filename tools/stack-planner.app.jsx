const { useEffect, useRef, useState } = React;

// ---------------------------------------------------------------
// Editable config. Dimensions in inches (outer). Volumes are gross
// internal, before driver/port/bracing displacement. Verify every
// driver spec and price against the vendor before ordering.
// ---------------------------------------------------------------
const PLY = 0.75; // 3/4" birch
const ST260_PROFILE = [[1.89,0.0],[0.5,0.0],[0.507,0.036],[0.515,0.078],[0.526,0.125],[0.54,0.177],[0.557,0.232],[0.578,0.291],[0.601,0.354],[0.629,0.42],[0.66,0.488],[0.695,0.56],[0.775,0.706],[0.87,0.863],[0.979,1.025],[1.1,1.192],[1.232,1.361],[1.374,1.533],[1.528,1.706],[1.688,1.877],[1.857,2.045],[2.035,2.209],[2.217,2.366],[2.404,2.514],[2.597,2.654],[2.794,2.784],[2.996,2.904],[3.201,3.012],[3.406,3.105],[3.51,3.146],[3.617,3.183],[3.726,3.215],[3.834,3.241],[3.944,3.26],[4.055,3.272],[4.165,3.277],[4.276,3.273],[4.384,3.26],[4.493,3.236],[4.596,3.203],[4.696,3.159],[4.795,3.1],[4.884,3.031],[4.959,2.953],[5.023,2.865],[5.074,2.769],[5.107,2.668],[5.124,2.569],[5.126,2.525],[5.125,2.486],[4.968,2.494],[4.969,2.525],[4.967,2.56],[4.952,2.64],[4.923,2.72],[4.88,2.797],[4.826,2.867],[4.761,2.929],[4.684,2.984],[4.601,3.03],[4.516,3.065],[4.426,3.091],[4.334,3.108],[4.24,3.117],[4.144,3.119],[4.048,3.114],[3.951,3.102],[3.855,3.084],[3.759,3.061],[3.663,3.032],[3.475,2.963],[3.29,2.881],[3.105,2.784],[2.922,2.679],[2.743,2.564],[2.566,2.439],[2.396,2.308],[2.228,2.169],[2.064,2.023],[1.907,1.873],[1.755,1.719],[1.61,1.562],[1.472,1.405],[1.407,1.327],[1.346,1.253],[1.279,1.167],[1.251,1.13],[1.231,1.104],[1.177,1.023],[1.133,0.938],[1.101,0.849],[1.079,0.755],[1.065,0.655],[1.058,0.549],[1.055,0.435],[1.054,0.315],[1.89,0.315],[1.89,0.0]]; // [radius, depth] in inches, from ST260-19.stl cross-section


const SUB_OPTIONS = [
  { id: "sbnero18", lb: 45, pick: true, name: "SB Audience Nero-18SW1100D", price: 290, src: "Madisound, Sep 2026", size: 18, ts: { Fs: 36, Qts: 0.33, Qes: 0.34, Qms: 11.83, Vas: 153.1, Sd: 1256.6, Xmax: 12.2, Re: 5.0, Bl: 30.9, Mms: 294, aes: 1100, disp: 10.5 },
    note: "[datasheet] Ferrite, 1100 W AES, 10.5 L displacement, 45.6 lb. SB claim 99 dB; their own T/S give about 96 dB/2.83 V." },
  { id: "emnsw4018", lb: 20.9, name: "Eminence NSW4018-8", price: 580, src: "US vendor, Sep 2026 (per Josh)", size: 18, ts: { Fs: 36, Qts: 0.38, Qes: 0.39, Qms: 8.46, Vas: 164, Sd: 1217, Xmax: 15.2, Re: 5.9, Bl: 28.2, Mms: 237, aes: 1600, disp: 5.81 },
    note: "[datasheet, loudspeakerdatabase.com; usspeaker.com] Neo, 1600 W AES / 3200 W program, 96.6 dB, 5.81 L displacement, 20.9 lb." },
  { id: "em4018", lb: 24, name: "Eminence Definimax 4018LF", price: 329, src: "local vendor, Sep 2026", size: 18, ts: { Fs: 30, Qts: 0.34, Qes: 0.35, Qms: 11.95, Vas: 255, Sd: 1188, Xmax: 8.6, Re: 6.1, Bl: 26.8, Mms: 217, aes: 1200, disp: 10.5 },
    note: "[datasheet, loudspeakerdatabase.com; usspeaker.com] Ferrite, 1200 W AES / 2400 W program, 94.9 dB, 24 lb. Displacement not published; 10.5 L assumed." },
  { id: "bc18tbx", lb: 28, name: "B&C 18TBX100", price: 399.9, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 34, Qts: 0.35, Qes: 0.37, Qms: 7.2, Vas: 212, Sd: 1210, Xmax: 9, Re: 5.1, Bl: 25.5, Mms: 209, aes: 1200, disp: 10.5 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Ferrite, 1200 W nominal / 2400 W continuous, 97 dB, Xvar 11 mm, 10.5 L displacement, 28 lb." },
  { id: "bc18sw", lb: 26, name: "B&C 18SW115", price: 739, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 32, Qts: 0.3, Qes: 0.32, Qms: 5.6, Vas: 187, Sd: 1210, Xmax: 14, Re: 5.3, Bl: 30.3, Mms: 275, aes: 1700, disp: 10.5 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Neo, 1700 W nominal / 3400 W continuous, 97 dB, Xvar 16 mm, 10.5 L displacement, 26.2 lb." },
  { id: "bc18tbw", lb: 34, name: "B&C 18TBW100", price: 472, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 35, Qts: 0.39, Qes: 0.41, Qms: 8, Vas: 175, Sd: 1210, Xmax: 12, Re: 5.3, Bl: 26.4, Mms: 245, aes: 1500, disp: 11.0 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Ferrite, 1500 W nominal / 3000 W continuous, 96 dB, Xvar 14 mm, 34 lb. 11.0 L displacement (B&C datasheet)." },
  { id: "bc18ps", lb: 22.5, name: "B&C 18PS100", price: 361.62, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 30, Qts: 0.39, Qes: 0.41, Qms: 4.6, Vas: 245, Sd: 1210, Xmax: 8, Re: 5.3, Bl: 22.5, Mms: 202, aes: 700, disp: 9.5 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Ferrite, 700 W nominal / 1400 W continuous, 95.5 dB, Xvar 8 mm, 22.5 lb. B&C's Vas is 14% below what its Mms and Sd imply; the model uses Fs, Mms and Sd, not Vas. 9.5 L displacement (B&C datasheet)." },
  { id: "bc18nw", lb: 20, name: "B&C 18NW100", price: 458.1, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 31, Qts: 0.26, Qes: 0.27, Qms: 4.2, Vas: 252, Sd: 1210, Xmax: 9, Re: 5.1, Bl: 28, Mms: 211, aes: 1200, disp: 10.5 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Neo, 1200 W nominal / 2400 W continuous, 98 dB, Xvar 11 mm, Le 1.7 mH, 20 lb. Displacement not published; 10.5 L assumed." },
  { id: "bc18nbx", lb: 20, name: "B&C 18NBX100", price: 448.56, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 35, Qts: 0.38, Qes: 0.4, Qms: 5.6, Vas: 198, Sd: 1210, Xmax: 10, Re: 5.2, Bl: 24.8, Mms: 217, aes: 1200, disp: 10.5 },
    note: "[datasheet, bcspeakers.com, Sep 2026] Neo, 1200 W nominal / 2400 W continuous, 96.5 dB, Xvar 12 mm, Le 1.85 mH, 20 lb. Displacement not published; 10.5 L assumed." },
  { id: "lv18403", lb: 36.2, name: "Lavoce SAF184.03", price: 369, src: "Parts Express (back-ordered)", size: 18, ts: { Fs: 38, Qts: 0.42, Qes: 0.44, Qms: 6.39, Vas: 143.2, Sd: 1220, Xmax: 12.1, Re: 5.7, Bl: 28.05, Mms: 255.5, aes: 1500, disp: 8.5 },
    note: "[datasheet, Lavoce via toutlehautparleur.com, Sep 2026] Ferrite, 1500 W AES / 3000 W program, 96 dB, 8.5 L displacement, 36.2 lb. Lavoce recommend 175 L tuned to 35 Hz. Xmax is Lavoce's (Hvc \u2212 Hg)/2 + Hg/4; the plain (Hvc \u2212 Hg)/2 would be 8.35 mm." },
  { id: "lv18402", lb: 29.8, name: "Lavoce SAF184.02", price: 319, src: "Parts Express", size: 18, ts: { Fs: 38, Qts: 0.44, Qes: 0.46, Qms: 10.2, Vas: 150, Sd: 1225, Xmax: 8.4, Re: 4.8, Bl: 24.9, Mms: 250, aes: 1200, disp: 8.5 },
    note: "[datasheet, Lavoce via toutlehautparleur.com, Sep 2026] Ferrite, 1200 W AES / 2400 W program, 97 dB, 8.5 L displacement, 29.8 lb. Xmax is Lavoce's (Hvc \u2212 Hg)/2 + Hg/4; the plain (Hvc \u2212 Hg)/2 would be 5.35 mm." },
  { id: "lv18n403", lb: 24.3, name: "Lavoce SAN184.03 (neo)", price: 489, src: "Parts Express", size: 18, ts: { Fs: 36, Qts: 0.42, Qes: 0.44, Qms: 7.8, Vas: 160, Sd: 1225, Xmax: 13, Re: 5.5, Bl: 27.2, Mms: 261, aes: 1500, disp: 7.8 },
    note: "[datasheet, Lavoce via toutlehautparleur.com, Sep 2026] Neo, 1500 W AES / 3000 W program, 96 dB, 7.8 L displacement, 24.3 lb. Xmax is Lavoce's (Hvc \u2212 Hg)/2 + Hg/4; the plain (Hvc \u2212 Hg)/2 would be 9.25 mm." },
  { id: "ciare18sw", lb: 34.5, name: "Ciare 18.00SW-8", price: 455, src: "per Josh, Sep 2026", size: 18, ts: { Fs: 36, Qts: 0.5, Qes: 0.55, Qms: 6.7, Vas: 93, Sd: 1134, Xmax: 14, Re: 7.0, Bl: 32.5, Mms: 377, aes: 1000, disp: 10.5 },
    note: "[datasheet, per Josh; matches usspeaker.com] Ferrite, 1000 W AES / 2000 W program, 94 dB 1 W/1 m, Le 3 mH, 34.5 lb. Xmax 14 mm as published, which matches the (Hvc \u2212 Hg)/2 + Hg/4 convention (13.5 mm); plain (Hvc \u2212 Hg)/2 gives 11 mm. Displacement not published; 10.5 L assumed." },
  { id: "ciarendh18", lb: 19.8, name: "Ciare NDH18-4S", price: 459.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 31, Qts: 0.32, Qes: 0.33, Qms: 9.8, Vas: 239, Sd: 1164, Xmax: 11.5, Re: 6.1, Bl: 27.7, Mms: 212, aes: 1000, disp: 10.5 },
    note: "[usspeaker.com spec table, Sep 2026] 8 \u03a9 version. Neo, 2000 W program (1000 W AES assumed), 96.5 dB, 4 in coil, 19.8 lb. A 4 \u03a9 version (NDH18-4S-4, same price) also exists. Ciare's Xmax uses (Hvc \u2212 Hg)/2 + Hg/4. Displacement not published; 10.5 L assumed." },
  { id: "f18fh510", lb: 19.4, name: "FaitalPRO 18FH510", price: 389.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 30, Qts: 0.3, Qes: 0.3, Qms: 13.6, Vas: 369.5, Sd: 1134, Xmax: 9.25, Re: 5.1, Bl: 21, Mms: 139, aes: 600, disp: 6.1 },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 600 W AES / 1200 W program, 98 dB, 19.4 lb. Sd 1134 cm² is self-consistent with the published Vas. 6.1 L displacement (Faital datasheet)." },
  { id: "f18fh500", lb: 10.1, name: "FaitalPRO 18FH500", price: 459.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 30, Qts: 0.35, Qes: 0.36, Qms: 12.5, Vas: 418, Sd: 1207, Xmax: 9.3, Re: 5.1, Bl: 19, Mms: 137, aes: 600, disp: 5.7 },
    note: "[web search, Sep 2026; not checked against the datasheet] Neo, 600 W AES / 1200 W program, 99 dB, 10.1 lb. usspeaker lists Sd 1134 / Vas 375 L, also self-consistent; probably an older datasheet revision. 5.7 L displacement (Faital datasheet)." },
  { id: "f18fx600", lb: 13.4, name: "FaitalPRO 18FX600", price: 541.95, src: "usspeaker.com, Sep 2026 (Parts Express $586 per Josh)", size: 18, ts: { Fs: 32, Qts: 0.28, Qes: 0.29, Qms: 7.4, Vas: 257.8, Sd: 1134, Xmax: 11.3, Re: 5.0, Bl: 24.5, Mms: 175, aes: 700, disp: 5.3 },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 700 W AES / 1400 W program, 99 dB, 13.4 lb. usspeaker set used: it is self-consistent; the other published set (Sd 1213, Qms 9.8) is not. 5.3 L displacement (Faital datasheet)." },
  { id: "f18hp1010", lb: 22.3, name: "FaitalPRO 18HP1010", price: 459.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 35, Qts: 0.4, Qes: 0.42, Qms: 7.8, Vas: 240.1, Sd: 1207, Xmax: 9.75, Re: 5.3, Bl: 22, Mms: 175.2, aes: 1000, disp: 7.1 },
    note: "[web search, Sep 2026; not checked against the datasheet] Ferrite, 1000 W AES / 2000 W program, 98 dB, 22.3 lb. usspeaker lists Sd 1134 / Vas 215 L, also self-consistent; probably an older datasheet revision. 7.1 L displacement (Faital datasheet)." },
  { id: "by18pwb", lb: 30, name: "Beyma 18PWB1000Fe/S", price: 418.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 27, Qts: 0.38, Qes: 0.4, Qms: 8.2, Vas: 317, Sd: 1265, Xmax: 12.5, Re: 6.0, Bl: 25, Mms: 245, aes: 1000, disp: 10.5 },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 1000 W AES / 2000 W program, 96 dB, 29.7 lb. Displacement not published; 10.5 L assumed." },
  { id: "by18lex", lb: 19.8, name: "Beyma 18LEX1200Nd", price: 458.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 36, Qts: 0.33, Qes: 0.35, Qms: 10.9, Vas: 219, Sd: 1255, Xmax: 11, Re: 5.3, Bl: 26.4, Mms: 200, aes: 1200, disp: 10.5 },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 1200 W AES / 2400 W program, 98 dB, 19.8 lb. Displacement not published; 10.5 L assumed." },
  { id: "es18lw2420", lb: 27.3, name: "18Sound 18LW2420", price: 439.95, src: "usspeaker.com, Sep 2026", size: 18, ts: { Fs: 33, Qts: 0.31, Qes: 0.33, Qms: 7, Vas: 255, Sd: 1225, Xmax: 10, Re: 5.0, Bl: 24.6, Mms: 192, aes: 1300, disp: 10.5 },
    note: "[usspeaker.com spec table, Sep 2026] 1300 W AES / 2600 W program, 97 dB, 27.3 lb. Displacement not published; 10.5 L assumed." },
  { id: "sbnero15", lb: 35.9, name: "SB Audience Nero-15SW800", price: 295, src: "Madisound (out of stock)", size: 15, ts: { Fs: 31, Qts: 0.34, Qes: 0.36, Qms: 7.59, Vas: 137, Sd: 861, Xmax: 14.3, Re: 5.3, Bl: 24.4, Mms: 207, aes: 800, disp: 6.45 },
    note: "[web search, Sep 2026; not checked against the datasheet] 800 W AES / 1600 W program, 6.45 L displacement, 35.9 lb (may be shipping weight)." },
];

const MID_OPTIONS = [
  // ---- 15" mid-bass (sealed), for tops crossed low (tapped-horn sub, separated subs) ----
  { id: "bc15cl76", size: 15, lb: 8.4, name: "B&C 15CL76", price: 246.18, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 42, Qts: 0.33, Qes: 0.34, Qms: 7.9, Vas: 135, Sd: 855, Xmax: 7, Re: 5.1, Bl: 21, Mms: 108, aes: 400, disp: null },
    note: "[bcspeakers.com, Sep 2026] Neo, 400 W nominal / 800 W continuous, 98.5 dB, Le 1.3 mH, to 3 kHz. Lightest 15 here." },
  { id: "bc15fw76", size: 15, lb: 20.5, name: "B&C 15FW76", price: 295.8, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 40, Qts: 0.21, Qes: 0.22, Qms: 5.1, Vas: 138, Sd: 855, Xmax: 7, Re: 5.1, Bl: 26.2, Mms: 117, aes: 500, disp: null },
    note: "[bcspeakers.com, Sep 2026] Ferrite, 500 W nominal / 1000 W continuous, 100 dB, Le 1.4 mH, to 2 kHz. Strong motor but 20.5 lb." },
  { id: "bc15ndl76", size: 15, lb: 10.4, pick: true, name: "B&C 15NDL76", price: 305.4, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 37, Qts: 0.22, Qes: 0.24, Qms: 4.5, Vas: 195, Sd: 855, Xmax: 7, Re: 5.3, Bl: 22.5, Mms: 96, aes: 500, disp: null },
    note: "[bcspeakers.com, Sep 2026] Neo, 500 W nominal / 1000 W continuous, 99.5 dB, Le 1.5 mH, to 2 kHz. The 15 sibling of the 12NDL76." },
  { id: "bc15ndl88", size: 15, lb: 12.6, name: "B&C 15NDL88", price: 388.44, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 45, Qts: 0.34, Qes: 0.36, Qms: 6.1, Vas: 126, Sd: 855, Xmax: 8, Re: 5, Bl: 20.1, Mms: 102, aes: 700, disp: null },
    note: "[bcspeakers.com, Sep 2026] Neo, 3.5 in coil, 700 W nominal / 1400 W continuous, 99 dB, Le 1.25 mH, to 3 kHz." },
  { id: "bc15nw76", size: 15, lb: 12.3, name: "B&C 15NW76", price: 379.8, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 42, Qts: 0.22, Qes: 0.23, Qms: 4.3, Vas: 130, Sd: 855, Xmax: 8, Re: 5.3, Bl: 25.5, Mms: 104, aes: 600, disp: null },
    note: "[bcspeakers.com, Sep 2026] Neo, 600 W nominal / 1200 W continuous, 100.5 dB, Le 1.25 mH, to 2 kHz." },
  { id: "by15mc700nd", size: 15, lb: 9.2, name: "Beyma 15MC700Nd", price: 374.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 49, Qts: 0.31, Qes: 0.34, Qms: 3.6, Vas: 105, Sd: 880, Xmax: 7, Re: 5.2, Bl: 22.6, Mms: 107, aes: 700, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 700 W AES / 1400 W program, 100 dB, Le 0.8 mH, to 4 kHz." },
  { id: "es15mb700", size: 15, lb: 18.3, name: "18Sound 15MB700", price: 279.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 42, Qts: 0.29, Qes: 0.31, Qms: 4.5, Vas: 202, Sd: 850, Xmax: 5.5, Re: 5, Bl: 17.6, Mms: 71, aes: 400, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 400 W AES / 800 W program, 103 dB, Le 1.2 mH, to 4.3 kHz. Mms not published; 71 g derived (Qes agrees)." },
  { id: "f15fh500", size: 15, lb: 9.7, name: "FaitalPRO 15FH500", price: 389.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 35, Qts: 0.31, Qes: 0.32, Qms: 10.4, Vas: 180.5, Sd: 800, Xmax: 9.25, Re: 5.1, Bl: 19.2, Mms: 104, aes: 500, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 500 W AES / 1000 W program, 98 dB, Le 1.3 mH, to 3.15 kHz. Most excursion of the 15s." },
  { id: "f15pr400", size: 15, lb: 7.9, name: "FaitalPRO 15PR400", price: 359.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 35, Qts: 0.32, Qes: 0.34, Qms: 6, Vas: 223, Sd: 805, Xmax: 5.75, Re: 5.1, Bl: 16.7, Mms: 85.2, aes: 400, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 400 W AES / 800 W program, 100 dB, Le 0.75 mH, to 4 kHz." },
  { id: "sbnero12", size: 12, lb: 9.15, pick: true, name: "SB Audience Nero-12MWN700D", price: 247, src: "Madisound",
    ts: { Fs: 52.7, Qts: 0.38, Qes: 0.4, Qms: 8.9, Vas: 52.5, Sd: 543.3, Xmax: 7.3, Re: 5.3, Bl: 17.9, Mms: 72.5, aes: 700, disp: 2.15 },
    note: "[datasheet, sbaudience.com R.1 2024] Neo, 700 W AES / 1400 W max, 97 dB, 3 in coil, Le 0.32 mH, 2.15 L displacement. Xmax = (Hvc \u2212 Hg)/2 + Hg/3." },
  { id: "bc12ndl76", size: 12, lb: 8.6, name: "B&C 12NDL76", price: 281.52, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 50, Qts: 0.2, Qes: 0.21, Qms: 4.2, Vas: 73, Sd: 522, Xmax: 7, Re: 5.3, Bl: 20.1, Mms: 53, aes: 400, disp: null },
    note: "[usspeaker.com spec table, Sep 2026; Xmax 7 mm per bcspeakers.com] Neo, 400 W nominal / 800 W continuous, 100 dB, Le 1.0 mH. Displacement not published; 2.5 L assumed." },
  { id: "bc12ndl88", size: 12, lb: 8.6, name: "B&C 12NDL88", price: 355.92, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 51, Qts: 0.27, Qes: 0.29, Qms: 5.0, Vas: 52, Sd: 522, Xmax: 8, Re: 5.0, Bl: 19.9, Mms: 71, aes: 700, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 700 W nominal / 1400 W continuous, 98 dB, 3.5 in coil. Displacement not published; 2.5 L assumed." },
  { id: "bc12nw76", size: 12, lb: 10.6, name: "B&C 12NW76", price: 343.5, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 40, Qts: 0.16, Qes: 0.17, Qms: 3.7, Vas: 76, Sd: 522, Xmax: 8, Re: 5.3, Bl: 25.5, Mms: 77, aes: 500, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 500 W nominal / 1000 W continuous, 98.5 dB. Displacement not published; 2.5 L assumed." },
  { id: "bc12fw76", size: 12, lb: 18.7, name: "B&C 12FW76", price: 256.74, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 54, Qts: 0.17, Qes: 0.18, Qms: 3.8, Vas: 45, Sd: 522, Xmax: 7, Re: 5.1, Bl: 26.4, Mms: 75, aes: 500, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 500 W nominal / 1000 W continuous, 100 dB, 18.7 lb. Displacement not published; 2.5 L assumed." },
  { id: "bc12cl64", size: 12, lb: 4.2, name: "B&C 12CL64", price: 184.2, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 52, Qts: 0.3, Qes: 0.32, Qms: 4.3, Vas: 64, Sd: 522, Xmax: 4.5, Re: 5.5, Bl: 17.5, Mms: 55, aes: 250, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 250 W nominal / 500 W continuous, 98 dB, 4.2 lb. Short 4.5 mm Xmax. Displacement not published; 2.5 L assumed." },
  { id: "f12pr320", size: 12, lb: 6.1, name: "FaitalPRO 12PR320", price: 309.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 42, Qts: 0.37, Qes: 0.39, Qms: 7.8, Vas: 94.8, Sd: 489, Xmax: 7.37, Re: 5.3, Bl: 13.5, Mms: 51.4, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 300 W AES / 600 W program, 97 dB, Le 0.67 mH. Displacement not published; 2.5 L assumed." },
  { id: "f12pr300", size: 12, lb: 5.3, name: "FaitalPRO 12PR300", price: 289.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 50, Qts: 0.36, Qes: 0.37, Qms: 9.9, Vas: 79.2, Sd: 489, Xmax: 4.92, Re: 5.4, Bl: 14.1, Mms: 43.4, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 300 W AES / 600 W program, 99 dB, Le 0.42 mH, 5.3 lb. Displacement not published; 2.5 L assumed." },
  { id: "f12pr310", size: 12, lb: 9.37, name: "FaitalPRO 12PR310", price: 247.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 54, Qts: 0.4, Qes: 0.41, Qms: 11.6, Vas: 62.83, Sd: 489, Xmax: 4.92, Re: 5.4, Bl: 14.4, Mms: 46.9, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 300 W AES / 600 W program, 99 dB. Displacement not published; 2.5 L assumed." },
  { id: "f12pr330", size: 12, lb: 9.5, name: "FaitalPRO 12PR330", price: 265.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 50, Qts: 0.4, Qes: 0.42, Qms: 10.9, Vas: 67.7, Sd: 489, Xmax: 7.37, Re: 5.3, Bl: 14.2, Mms: 50.8, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 300 W AES / 600 W program, 98 dB. Displacement not published; 2.5 L assumed." },
  { id: "f12hp1010", size: 12, lb: 20.3, name: "FaitalPRO 12HP1010", price: 378.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 45, Qts: 0.33, Qes: 0.35, Qms: 9.4, Vas: 50, Sd: 496, Xmax: 9.25, Re: 5.5, Bl: 19.8, Mms: 87.2, aes: 700, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 700 W AES / 1400 W program, 96 dB, Le 1.33 mH, 9.25 mm Xmax, 20.3 lb. Small Vas suits a compact sealed box. Displacement not published; 2.5 L assumed." },
  { id: "f12rs550", size: 12, lb: 17.9, name: "FaitalPRO 12RS550", price: 335.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 42, Qts: 0.37, Qes: 0.39, Qms: 6.9, Vas: 43.5, Sd: 512.8, Xmax: 9.25, Re: 5.1, Bl: 20.5, Mms: 123, aes: 500, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 500 W AES / 1000 W program, 93 dB, Le 1.5 mH, 9.25 mm Xmax. Deepest-reaching sealed 12 here, but 3\u20134 dB less sensitive. Displacement not published; 2.5 L assumed." },
  { id: "f12fh500", size: 12, lb: 8.8, name: "FaitalPRO 12FH500", price: 359.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 45, Qts: 0.25, Qes: 0.26, Qms: 6.9, Vas: 75.1, Sd: 487, Xmax: 7.5, Re: 5.1, Bl: 17.5, Mms: 56, aes: 500, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 500 W AES / 1000 W program, 97 dB. Displacement not published; 2.5 L assumed." },
  { id: "es12mb700", size: 12, lb: 17.7, name: "18Sound 12MB700", price: 294.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 49, Qts: 0.19, Qes: 0.2, Qms: 4.7, Vas: 101, Sd: 531, Xmax: 4.5, Re: 5.0, Bl: 17.8, Mms: 41, aes: 450, disp: null },
    note: "[usspeaker.com; Mms from the 18Sound datasheet] Ferrite, 450 W AES, 101.5 dB, Le 0.9 mH. Displacement not published; 2.5 L assumed." },
  { id: "es12mb1000", size: 12, lb: 21.2, name: "18Sound 12MB1000", price: 409.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 54, Qts: 0.19, Qes: 0.2, Qms: 6.0, Vas: 60, Sd: 531, Xmax: 2.5, Re: 5.8, Bl: 23.5, Mms: 55.5, aes: 600, disp: null },
    note: "[usspeaker.com; Mms from the 18Sound datasheet] Ferrite, 600 W AES, 102 dB. Xmax only 2.5 mm: built for efficiency, not excursion. Displacement not published; 2.5 L assumed." },
  { id: "es12nlw9300", size: 12, lb: 13.7, name: "18Sound 12NLW9300", price: 369.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 47, Qts: 0.42, Qes: 0.45, Qms: 5.5, Vas: 56, Sd: 531, Xmax: 8, Re: 4.7, Bl: 17, Mms: 82, aes: 800, disp: null },
    note: "[datasheet, eighteensound.it] Neo, 800 W AES / 1200 W continuous, 97 dB, Le 0.53 mH. usspeaker lists older figures (Fs 40, Vas 87 L). Displacement not published; 2.5 L assumed." },
  { id: "es12lw1400", size: 12, lb: 24, name: "18Sound 12LW1400", price: null, src: "not on usspeaker",
    ts: { Fs: 45, Qts: 0.3, Qes: 0.32, Qms: 5.0, Vas: 55, Sd: 531, Xmax: 8.25, Re: 5.2, Bl: 20, Mms: 88, aes: 900, disp: null },
    note: "[datasheet, eighteensound.it] 900 W AES / 1400 W continuous, 96 dB, 4 in coil. AudioHorn's recommended 12 for the X-Shape 34; 18Sound now list the 12NLW9300 as its successor. Displacement not published; 2.5 L assumed." },
  { id: "by12mc700nd", size: 12, lb: 8.2, name: "Beyma 12MC700Nd", price: 342.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 51, Qts: 0.24, Qes: 0.26, Qms: 4.1, Vas: 58, Sd: 550, Xmax: 7, Re: 5.2, Bl: 21.6, Mms: 72, aes: 700, disp: 2.0 },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 700 W AES / 1400 W program, 99 dB, 2.0 L displacement." },
  { id: "by12lx60", size: 12, lb: 21.4, name: "Beyma 12LX60v2", price: 249.75, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 49, Qts: 0.39, Qes: 0.4, Qms: 15.3, Vas: 43, Sd: 550, Xmax: 9, Re: 5.1, Bl: 20, Mms: 102, aes: 700, disp: 5.5 },
    note: "[usspeaker.com spec table, Sep 2026] Ferrite, 700 W AES / 1400 W program, 96 dB, 5.5 L displacement, 21.4 lb." },
  { id: "by12p80nd", size: 12, lb: 12.3, name: "Beyma 12P80Nd", price: 474.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 47, Qts: 0.19, Qes: 0.2, Qms: 5.2, Vas: 65, Sd: 550, Xmax: 7.5, Re: 5.0, Bl: 23.7, Mms: 74, aes: 700, disp: 4.0 },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 700 W AES / 1400 W program, 100 dB, 4.0 L displacement." },
  { id: "em3012", size: 12, lb: 11, name: "Eminence KappaLite 3012HO", price: 249.99, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 51.5, Qts: 0.32, Qes: 0.33, Qms: 8.39, Vas: 81.1, Sd: 532.4, Xmax: 6.2, Re: 5.5, Bl: 15.9, Mms: 46.9, aes: 400, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 400 W / 800 W program, 100.5 dB claimed, Le 0.57 mH. Displacement not published; 2.5 L assumed." },
  { id: "em3012lf", size: 12, lb: 11, name: "Eminence KappaLite 3012LF", price: 254.99, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 37.02, Qts: 0.32, Qes: 0.34, Qms: 6.94, Vas: 105.42, Sd: 545.4, Xmax: 9.1, Re: 5.6, Bl: 16.7, Mms: 72.4, aes: 450, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 450 W / 900 W program, 95.5 dB, 9.1 mm Xmax. Displacement not published; 2.5 L assumed." },
  { id: "em2512", size: 12, lb: 7, name: "Eminence Deltalite II 2512", price: 194.99, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 44, Qts: 0.41, Qes: 0.45, Qms: 4.17, Vas: 134.88, Sd: 519.5, Xmax: 4.9, Re: 5.17, Bl: 10.69, Mms: 37, aes: 250, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 250 W / 500 W program, 99.9 dB claimed, 4.9 mm Xmax. Displacement not published; 2.5 L assumed." },
  { id: "ci12ndh3", size: 12, lb: 11, name: "Ciare 12NDH3", price: 319.08, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 55.1, Qts: 0.23, Qes: 0.23, Qms: 11.36, Vas: 66.42, Sd: 530, Xmax: 6.5, Re: 6.1, Bl: 21.36, Mms: 49.5, aes: 400, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 800 W program (400 W AES assumed), 100 dB, Le 0.54 mH. Displacement not published; 2.5 L assumed." },
  { id: "lv123n", size: 12, lb: 11.4, name: "Lavoce WAN123.00", price: 249, src: "Parts Express, Sep 2026",
    ts: { Fs: 48, Qts: 0.27, Qes: 0.28, Qms: 6.2, Vas: 73, Sd: 531, Xmax: 7, Re: 4.8, Bl: 17.8, Mms: 61, aes: 500, disp: 2.4 },
    note: "[datasheet, Lavoce] Neo, 500 W AES / 1000 W program, 99 dB, Le 0.7 mH, 2.4 L displacement. Xmax = (Hvc \u2212 Hg)/2 + Hg/4." },
  { id: "lv123f", size: 12, lb: 18.9, name: "Lavoce WAF123.01", price: 199, src: "Parts Express, Sep 2026",
    ts: { Fs: 65, Qts: 0.39, Qes: 0.42, Qms: 6.3, Vas: 42, Sd: 531, Xmax: 7.5, Re: 4.8, Bl: 17, Mms: 63, aes: 500, disp: 2.8 },
    note: "[datasheet, Lavoce] Ferrite, 500 W AES / 1000 W program, 98 dB, 2.8 L displacement." },
  { id: "lv124f", size: 12, lb: 26.6, name: "Lavoce WAF124.01", price: 289, src: "Parts Express, Sep 2026",
    ts: { Fs: 42, Qts: 0.22, Qes: 0.23, Qms: 6.3, Vas: 49, Sd: 540, Xmax: 9, Re: 5.1, Bl: 26.4, Mms: 120, aes: 1000, disp: 3.2 },
    note: "[datasheet, Lavoce] Ferrite, 1000 W AES / 2000 W program, 95 dB, 4 in coil, 3.2 L displacement, 26.6 lb." },
  { id: "sbnero10", size: 10, lb: 8.6, name: "SB Audience Nero-10MWN600D", price: null, src: "not priced yet",
    ts: { Fs: 68.1, Qts: 0.34, Qes: 0.36, Qms: 5.88, Vas: 18.8, Sd: 356.3, Xmax: 7.3, Re: 5.4, Bl: 18.2, Mms: 52.2, aes: 600, disp: 2.55 },
    note: "[datasheet, sbaudience.com R.1 2024] Neo, 600 W AES / 1200 W max, 96 dB, 2.55 L displacement." },
  { id: "bc10ndl64", size: 10, lb: 6.4, name: "B&C 10NDL64", price: 233.88, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 56, Qts: 0.27, Qes: 0.29, Qms: 3.4, Vas: 31, Sd: 320, Xmax: 6, Re: 5.7, Bl: 16.2, Mms: 37, aes: 250, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 250 W nominal / 500 W continuous, 97 dB. Displacement not published; 2.5 L assumed." },
  { id: "bc10nw64", size: 10, lb: 6.4, name: "B&C 10NW64", price: 224.22, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 50, Qts: 0.25, Qes: 0.27, Qms: 4.5, Vas: 27.5, Sd: 320, Xmax: 8, Re: 5.2, Bl: 17.5, Mms: 47, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 300 W nominal / 600 W continuous, 96 dB. Displacement not published; 2.5 L assumed." },
  { id: "f10pr320", size: 10, lb: 5.6, name: "FaitalPRO 10PR320", price: 284.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 48, Qts: 0.29, Qes: 0.31, Qms: 4.6, Vas: 45.9, Sd: 321, Xmax: 7.37, Re: 5.3, Bl: 13.5, Mms: 35, aes: 300, disp: null },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 300 W AES / 600 W program, 96 dB. Displacement not published; 2.5 L assumed." },
  { id: "es10mb600", size: 10, lb: 15.9, name: "18Sound 10MB600", price: 249.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 58, Qts: 0.22, Qes: 0.23, Qms: 5.5, Vas: 33.4, Sd: 350, Xmax: 6.5, Re: 5.7, Bl: 18.6, Mms: 38, aes: 450, disp: null },
    note: "[usspeaker.com; Mms from the 18Sound datasheet] Ferrite, 450 W AES, 98 dB. Displacement not published; 2.5 L assumed." },
  { id: "by10mc500nd", size: 10, lb: 6.8, name: "Beyma 10MC500Nd", price: 280.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 58, Qts: 0.25, Qes: 0.26, Qms: 4.7, Vas: 29, Sd: 350, Xmax: 8, Re: 5.5, Bl: 18.7, Mms: 45, aes: 500, disp: 2.0 },
    note: "[usspeaker.com spec table, Sep 2026] Neo, 500 W AES / 1000 W program, 97 dB, 2.0 L displacement." },
  { id: "lv102n", size: 10, lb: 6.2, name: "Lavoce WAN102.50", price: 179, src: "Parts Express, Sep 2026",
    ts: { Fs: 77, Qts: 0.35, Qes: 0.38, Qms: 4.7, Vas: 21.5, Sd: 343, Xmax: 5.1, Re: 5.6, Bl: 15.3, Mms: 32.6, aes: 300, disp: 1.2 },
    note: "[datasheet, Lavoce] Neo, 300 W AES / 600 W program, 97 dB, 1.2 L displacement." },
  { id: "lv102f", size: 10, lb: 10.2, name: "Lavoce WAF102.50", price: 159, src: "Parts Express, Sep 2026",
    ts: { Fs: 71, Qts: 0.31, Qes: 0.33, Qms: 5.3, Vas: 23.6, Sd: 347, Xmax: 5, Re: 5.5, Bl: 16, Mms: 34.6, aes: 250, disp: 1.5 },
    note: "[datasheet, Lavoce; sheet titled WAF102.50A] Ferrite, 250 W AES / 500 W program, 98 dB, 1.5 L displacement." },
];

const MID_BOXES = [
  { id: "b14", name: "14 × 14 × 18 in", box: { w: 14, h: 14, d: 18 }, note: "Within the RX-28's 14.2\" width limit at 1100 Hz." },
  { id: "b13", name: "13 × 13 × 13 in", box: { w: 13, h: 13, d: 13 }, note: "Cube for a 10\" mid, ~25 L sealed." },
  { id: "b15", pick: true, name: "15 × 15 × 15 in", box: { w: 15, h: 15, d: 15 }, note: "Cube. Exceeds the RX-28 width guidance; fine under a round ATH horn." },
  { id: "b17", size: 15, name: "17 × 17 × 14 in", box: { w: 17, h: 17, d: 14 }, note: "Smallest practical face for a 15, ~45 L." },
  { id: "b18", size: 15, pick: true, name: "18 × 18 × 16 in", box: { w: 18, h: 18, d: 16 }, note: "~60 L for a 15." },
];

const CD_OPTIONS = [
  { id: "hf10ak", lb: 2, name: "FaitalPRO HF10AK (1\")", hf: { sens: 110, sensRef: "a 1\u2033 50\u00d740\u00b0 horn", aes: 60, aesXo: 1300, minXo: 1300, imp: 8 }, exit: 1, price: 281.95, src: "usspeaker.com, Sep 2026", note: "Ketone polymer, 110 dB, 60 W AES, 1.3 kHz rec. crossover. Smooth; pair with RX-Shape 28." },
  { id: "de250", lb: 3.3, name: "B&C DE250 (1\")", hf: { sens: 108.5, sensRef: "the B&C ME45 horn", aes: 60, aesXo: 1600, minXo: 1600, imp: 8 }, exit: 1, price: 137.46, src: "usspeaker.com, Sep 2026", note: "Ferrite, 108.5 dB, 60 W AES, 1.6 kHz rec. crossover. The DIY standard; a bit high for the RX-28's 1.2 kHz." },
  { id: "nd1tp", lb: 1.5, name: "18Sound ND1TP-16 (1\")", hf: { sens: 110, sensRef: "the 18Sound XR1464C horn", aes: 50, aesXo: 1600, minXo: 1600, imp: 16 }, exit: 1, price: null, src: "EU order, price TBD", note: "AudioHorn's budget pick for the RX-28. 16 Ω version as specified; ships from Europe." },
  { id: "nd1090", lb: 1.5, name: "18Sound ND1090-16 (1\")", hf: { sens: 110, sensRef: "the 18Sound XR1464C horn", aes: 50, aesXo: 1600, minXo: 1600, imp: 16 }, exit: 1, price: null, src: "EU order, price TBD", note: "AudioHorn's measured driver on the RX-28. Also NSD1095N as the premium option." },
  { id: "hf108", lb: 2, name: "FaitalPRO HF108 (1\")", hf: { sens: 109, sensRef: "a 1\u2033 50\u00d740\u00b0 horn", aes: 60, aesXo: 1300, minXo: 1300, imp: 8 }, exit: 1, price: 220.95, src: "usspeaker.com, Sep 2026 (Parts Express $259)", note: "Marcel Batík's standard 1\" pairing for the A400G2/A460G2; measured polars on at-horns.eu." },
  { id: "n314t", lb: 4.8, name: 'Eminence N314T-8 (1.4")', hf: { sens: 110.9, sensRef: "Eminence's averaged 1 W/1 m figure (no horn named)", aes: 100, aesXo: 800, minXo: 800, imp: 8 }, exit: 1.4, price: 234.99, src: "usspeaker.com, Sep 2026 (Parts Express $249.99)", note: "3 in titanium diaphragm, D3 surround. Minimum crossover 800 Hz at 12 dB/oct, 110 dB, 100 W AES, 4.8 lb. Exit is a 7.3\u00b0 included conical flare, so an ATH throat adapter has to be generated for it \u2014 none published yet. The only driver here rated below 1 kHz." },
  { id: "de360", lb: 3, pick: true, name: "B&C DE360 (1\")", hf: { sens: 110, sensRef: "the B&C ME45 horn", aes: 35, aesXo: 1800, minXo: 1800, imp: 8 }, exit: 1, price: 117.36, src: "Parts Express, Sep 2026", note: "Ketone polymer 1\" measured on the ATH Gen2 waveguides. Sheet says 1.8 kHz min; ~1.1–1.3 kHz LR4 works on the A400G2, verify with a distortion sweep." },
  { id: "lavoce171", lb: 1.5, name: "Lavoce DF10.171K (1\")", exit: 1, price: 109, src: "Parts Express", note: "Budget 1\" measured by Marcel Batík on ATH waveguides. Pair with the ST260 print." },
  { id: "n151m", lb: 1, name: "Eminence N151M (1\")", hf: { sens: 111.5, sensRef: "a flat baffle (Eminence's averaged figure)", aes: 45, aesXo: 1500, minXo: 1800, imp: 8 }, exit: 1, price: 94.99, src: "usspeaker.com, Sep 2026", note: "Ring radiator, 1.8 kHz rec. crossover, 45 W. Too high a crossover for a 12\"; listed for price reference only." },
];

const HORN_OPTIONS = [
  { id: "rx28", lb: 2, name: "AudioHorn RX-Shape 28", hf: { covH: 90, covV: null, minXo: 1100, lowHz: 800 }, exit: 1, price: 320, src: "audiohorn.net: 275€ PLA, 355€ PETG, plus shipping", size: { w: 13.3, h: 9.1, d: 6 }, driver: "18Sound ND1TP-16 / 1095N / 1090", xo: "1100–1200 Hz", note: "Free-standing 1\" horn for 10/12\" woofers. Supporting cabinet must be ~34 cm (13.4\") wide with a 4 mm roundover." },
  { id: "me90", lb: 3.1, name: "B&C ME90", hf: { covH: 80, covV: 60, minXo: null, lowHz: 900 }, exit: 1.4, price: 114.48, src: "usspeaker.com, Sep 2026", size: { w: 10.6, h: 10.6, d: 5.5 }, driver: "1.4\" exit, e.g. Eminence N314T", xo: "1.2\u20131.3 kHz (900 Hz cutoff)", note: "Cast aluminium, 80\u00b0 \u00d7 60\u00b0, 1.4\" throat, 4-bolt. Cutoff 900 Hz, so cross about 1.2\u20131.3 kHz; the 10.6\" mouth holds its pattern to about 1.2\u20131.4 kHz." },
  { id: "hd1403", lb: 3, name: "Lavoce HD1403", hf: { covH: 80, covV: 60, minXo: null, lowHz: 900 }, exit: 1.4, price: 69, src: "parts-express.com, Sep 2026", size: { w: 11, h: 10.6, d: 4.5 }, driver: "1.4\" exit, e.g. Eminence N314T", xo: "1.2\u20131.3 kHz (900 Hz cutoff)", note: "Cast aluminium constant-directivity horn, 80\u00b0 \u00d7 60\u00b0, 1.4\" throat, 4-bolt, cutoff 900 Hz. 10.6\" H \u00d7 11\" W \u00d7 4.5\" D; cutout 8.8\" \u00d7 9.5\". Weight not published; 3 lb assumed." },
  { id: "st260", lb: 1, name: "ATH ST260 (printed)", hf: { covH: 90, covV: 90, minXo: null, lowHz: 1500 }, exit: 1, profile: ST260_PROFILE, price: 40, src: "free STL; ~$40 filament self-printed, $80–150 via service", size: { w: 10.25, h: 10.25, d: 3.3 }, driver: "Lavoce DF10.171K / Faital HF108", xo: "1200–1500 Hz", note: "Round free-standing waveguide, ~110° coverage. No cabinet-width constraint." },
  { id: "a400g2", lb: 2.5, pick: true, name: "ATH A400G2 (printed, approx.)", hf: { covH: 100, covV: 100, minXo: null, lowHz: 670 }, exit: 1, profile: ST260_PROFILE, scale: 400 / 260, price: 60, src: "free STL from at-horns.eu; ~$60 filament, more via service", size: { w: 15.75, h: 15.75, d: 5.1 }, driver: "Faital HF108 / B&C DE360 / Lavoce DF10.171K", xo: "800–1000 Hz", note: "Shown as the ST260 profile scaled 1.54×; the real Gen2 profile is deeper. 15.7\" round mouth." },
  { id: "a460g2_14", lb: 3.5, name: "ATH A460G2 + 1.4 in adapter (printed, approx.)", hf: { covH: 100, covV: 100, minXo: null, lowHz: 580 }, exit: 1.4, profile: ST260_PROFILE, scale: 460 / 260, price: 80, src: "free STL from at-horns.eu; ~$80 filament, more via service", size: { w: 18.1, h: 18.1, d: 5.8 }, driver: "Eminence N314T-8 / SB Rosso-65CD-T / 18Sound ND3T", xo: "900\u20131000 Hz", note: "Same print as the A460G2 with a 36 mm throat adapter. 18.1 in mouth controls pattern to about 750 Hz, so it supports a 900 Hz\u20131 kHz crossover. Adapter must match the driver's exit angle (7.3\u00b0 for the N314T-8); Bat\u00edk publishes them per driver." },
  { id: "a460g2", lb: 3.5, name: "ATH A460G2 (printed, approx.)", hf: { covH: 100, covV: 100, minXo: null, lowHz: 670 }, exit: 1, profile: ST260_PROFILE, scale: 460 / 260, price: 80, src: "free STL from at-horns.eu; ~$80 filament, more via service", size: { w: 18.1, h: 18.1, d: 5.8 }, driver: "1\" or 1.4\" via adapter; measured pairings on at-horns.eu", xo: "600–800 Hz", note: "Shown as the ST260 profile scaled 1.77×; the real Gen2 profile is deeper. 18.1\" round mouth, Marcel's pick for 1\" drivers." },
  { id: "athRect", lb: 3.5, name: "Rectangular full-width waveguide (concept)", exit: 1, rect: true, price: 90, src: "would need generating in ATH and printing in sections", size: { w: 19, h: 11, d: 7 }, driver: "1\" with a 60 W class driver (DE250 / HF10AK)", xo: "~1.2 kHz", note: "Round 1\" throat morphing to a rounded rectangle as wide as the cabinet. Horizontal loading to ~710 Hz, vertical only to ~1.2 kHz. Wide horizontal, narrow vertical suits a dance floor. Drawn as a generic flare, not a real ATH profile." },
  { id: "iwata600", lb: 2.5, name: "Iwata 600 (printed, approx.)", exit: 1, profile: ST260_PROFILE, scaleX: 290 / 260, scaleY: 185 / 260, scaleZ: 245 / 83, price: 50, src: "STL on Cults3D; ~$50 filament", size: { w: 11.4, h: 7.3, d: 9.6 }, driver: "B&C DE250 / Faital HF10AK", xo: "1200–1500 Hz", note: "Shown as the ST260 profile stretched to 290 × 185 × 245 mm deep; flare shape approximate. Elliptical 600 Hz horn, 1\" throat." },
];

// Prices are US dollars, checked Sep 2026, single unit, before tax/shipping.

const RACKS = [
  {
    id: "mains", name: "Mains rack", note: "PA2 does the system tuning; each amp channel runs full-range with its own driver limiter.",
    items: [
      ["dbx DriveRack PA2 (used) — input EQ, master level, 6 outputs: XO, delay, driver EQ", 300],
      ["dbx RTA-M mic — for the PA2's RTA/AutoEQ", 100],
      ["QSC GXD8 (used) — subs, 800 W/ch at 8 Ω, limiter set by power + impedance", 600],
      ["QSC GXD4 (used) — mids, 400 W/ch at 8 Ω", 400],
      ["QSC GXD4 (used) — horns, gain trimmed, safety HPF ~500 Hz in the amp", 400],
      ["Furman PL-8 / M-8x2 (used) — 1U 15 A power conditioner", 90],
      ["Optional: GL.iNet travel router in the rack — PA2 app over its own Wi-Fi", 25],
      ["8U rack case, 6× XLR looms, 1U blank panel on the rear rail with 4× NL4MP sockets", 250],
    ],
  },
  {
    id: "battery", name: "Battery rack", note: "~70% sub output, ~90% mids/highs; 5–7 h on a 1 kWh pack.",
    items: [
      ["48 V 20 Ah LiFePO4 pack + fused disconnect", 350],
      ["miniDSP 2x4 HD (12 V) — copy of the dbx settings, run mono", 220],
      ["2× TPA3255 boards bridged mono (Fosi/3e Audio) — subs", 180],
      ["1× TPA3255 stereo board — mids", 90],
      ["1× small Class D board — horns", 60],
      ["48→12 V buck, wiring, panel-mount Speakon/XLR", 60],
      ["Small flight case", 120],
    ],
  },
  {
    id: "shared", name: "Shared", note: "Travels with whichever rack is in use.",
    items: [
      ["UMIK-1 measurement mic + REW", 100],
      ["6× XLR + 6× Speakon cables, Speakon panel jacks on all boxes", 120],
    ],
  },
];

const SWATCHES = [
  ["#e8b4a8", "Dusty pink"],
  ["#2b2725", "Near black"],
  ["#c8cdc4", "Pale sage"],
  ["#eeff00", "Acid yellow"],
  ["#8fa3ad", "Slate blue"],
  ["#b23a2f", "Oxide red"],
  ["#efe8dc", "Bone"],
  ["#4a5d4e", "Deep green"],
];

const CAB_FINISHES = {
  birch: { name: "Birch", color: 0xd7b98a, inner: 0xc9a875, rough: 0.85, swatch: "#d7b98a" },
  walnut: { name: "Walnut", color: 0x5c3a24, inner: 0x4f3220, rough: 0.7, swatch: "#5c3a24" },
};

const CABINETS = [
  { id: "column", name: "Upright column", vents: ["slots", "round1", "round2"],
    dims: { 18: { w: 21, h: 35, d: 21 }, 15: { w: 19, h: 28, d: 19 } },
    note: "Tallest, smallest footprint, stacks into itself. 174 L for an 18." },
  { id: "compactColumn", name: "Compact column", vents: ["slots", "round1", "round2"],
    dims: { 18: { w: 21, h: 31, d: 21 }, 15: { w: 19, h: 26, d: 19 } },
    note: "The column at the compact volume. 155 L net, 4\" shorter and 6 lb lighter than the tall one for 0.9 dB at 35 Hz. Best duct hydraulic diameter of any option." },
  { id: "blockTall", name: "Block, tall", vents: ["vslots"],
    dims: { 18: { w: 25, h: 28, d: 24 }, 15: { w: 22, h: 25, d: 21 } },
    note: "Full-height side ducts, no braces needed. 178 L for an 18." },
  { id: "blockCompact", name: "Compact block", vents: ["vslots"],
    dims: { 18: { w: 26, h: 26, d: 21 }, 15: { w: 22, h: 22, d: 19 } },
    note: "Squarest of the vented blocks. 159 L net, Fb 34.3 Hz, 121.0 dB at 35 Hz. Two flared side ducts." },
  { id: "wideCompact", name: "Compact wide", vents: ["vslots"],
    dims: { 18: { w: 32, h: 22, d: 20 }, 15: { w: 27, h: 19, d: 18 } },
    note: "Block-wide proportions at the compact volume. 159 L net, widest ducts of the compact set." },
  { id: "blockWide", name: "Block, wide", vents: ["vwide"],
    dims: { 18: { w: 32, h: 22, d: 24 }, 15: { w: 28, h: 20, d: 21 } },
    note: "Low and wide, widest ducts of any version. 181 L for an 18." },
  { id: "towerCol", name: "Tower column, 18 deep", vents: ["folded"],
    dims: { 18: { w: 21, h: 37, d: 18 }, 15: { w: 19, h: 31, d: 16 } },
    note: "For the Tower layout. 155 L net in an 18 in deep shell; the letterbox duct runs back along the floor and turns up the back wall to get its length." },
  { id: "es18app", name: "18Sound reflex (app note)", vents: ["slots"],
    dims: { 18: { w: 23.25, h: 35.5, d: 19.75 }, 15: { w: 23.25, h: 35.5, d: 19.75 } },
    note: "18Sound's published 905 H \u00d7 590 W \u00d7 500 D mm reflex box, 15 mm birch, ~230 L gross, 28 Hz HPF. Their vent isn't modelled; a bottom slot is loaded instead." },
  // internal 22.5 x 28.5 x 20.875 in; external adds two 3/4" walls and the 3/4" baffle recess
  { id: "ciareRef", name: "Ciare 18.00SW reflex (vendor)", vents: ["slots"], vent: { slotH: 2, len: 16.625 },
    dims: { 18: { w: 24, h: 30, d: 23 }, 15: { w: 24, h: 30, d: 23 } },
    note: "Vendor-suggested box for the Ciare 18.00SW: 7.55 ft\u00b3 internal, 22 \u00d7 2 in slot, 16.625 in deep, tuned 29 Hz, F3 28.5 Hz." },
  { id: "cube", name: "Cube", vents: ["round4"],
    dims: { 18: { w: 25, h: 25, d: 25 }, 15: { w: 23, h: 23, d: 19 } },
    note: "Square baffle, centred driver, corner ports. Reads the same in any rotation." },
];

const VENT_NAMES = {
  slots: '3 slots along the bottom',
  round1: '1 × 8" flared tube',
  round2: '2 × 5" flared tubes',
  vslots: 'Full-height side ducts',
  vwide: 'Full-height side ducts',
  round4: '4 flared corner tubes',
  folded: '3 slots, folded up the back',
};

const FORMATS = [
  { id: "full", name: 'Full — 18" sub, 12" mid', sub: 18, mid: 12,
    note: "~110-123 lb sub depending on cabinet. System F3 ~37 Hz, ~121 dB at 35 Hz per box. The show system." },
  { id: "mid", name: 'Middle — 15" sub, 12" mid', sub: 15, mid: 12,
    note: "19 in square footprint, ~80 lb sub, 62 in stack. About 3 dB down on the 18. Best compromise if home use matters." },
  { id: "compact", name: 'Compact — 15" sub, 10" mid', sub: 15, mid: 10,
    note: "Smallest boxes, 10 in mid is 3 dB down on the 12. Fits a room; least headroom outdoors." },
];

// Pickers list alphabetically; the default pick is marked with a dot, not moved to the top.
const byName = (arr) => [...arr].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));
[SUB_OPTIONS, MID_OPTIONS, CD_OPTIONS, HORN_OPTIONS].forEach((arr) => arr.splice(0, arr.length, ...byName(arr)));

// ---------------------------------------------------------------
// Vented-box model. Same lumped-element circuit used to check this
// design offline; see the provenance note under the table.
// Complex helpers kept local and minimal.
// ---------------------------------------------------------------
const cx = (re, im = 0) => ({ re, im });
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
const cinv = (a) => cdiv(cx(1), a);
const cabs = (a) => Math.hypot(a.re, a.im);

// Filter magnitudes. Butterworth order n: x^n / sqrt(1 + x^2n). Linkwitz-Riley 2m: a
// Butterworth m squared, x^2m / (1 + x^2m). LR24 is -6 dB at the corner, BW24 -3 dB.
const HP_TYPES = { BW24: ["bw", 4], LR24: ["lr", 4], BW48: ["bw", 8], LR48: ["lr", 8] };
const hpGain = (f, fc, type = "BW24") => {
  const [kind, n] = HP_TYPES[type] || HP_TYPES.BW24, x = f / fc;
  return kind === "bw" ? Math.pow(x, n) / Math.sqrt(1 + Math.pow(x, 2 * n)) : Math.pow(x, n) / (1 + Math.pow(x, n));
};
const lr24lp = (f, fc) => 1 / (1 + Math.pow(f / fc, 4));   // Linkwitz-Riley 24 dB/oct lowpass
const lr24hp = (f, fc) => hpGain(f, fc, "LR24");

function boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, hpType = "BW24") {
  if (!ts || !VbL || !SpIn2 || LpIn <= 0) return null;
  const rho = 1.18, c = 343;
  const Sd = ts.Sd / 10000;                 // cm^2 -> m^2
  const Mms = ts.Mms / 1000;                // g -> kg
  const Vas = ts.Vas / 1000, Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Sp = SpIn2 * 0.00064516;
  const reff = Math.sqrt(Sp / Math.PI);
  const Leff = LpIn * 0.0254 + 1.46 * reff;  // both-end correction
  const Map = (rho * Leff) / Sp;
  const Fb = (c / (2 * Math.PI)) * Math.sqrt(Sp / (Vb * Leff));
  const Ral = 7 / (2 * Math.PI * Fb * Cab);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);

  const N = 420, out = [];
  for (let i = 0; i < N; i++) {
    const f = 12 * Math.pow(300 / 12, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Zd = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cinv(cmul(s, cx(Cas)))));
    const Zc = cinv(cmul(s, cx(Cab)));
    const Zp = cadd(cmul(s, cx(Map)), cx(0.3));
    const Zbox = cinv(cadd(cadd(cinv(Zc), cinv(Zp)), cinv(cx(Ral))));
    const Ud = cdiv(cx(Pg), cadd(Zd, Zbox));
    const Up = cdiv(cmul(Ud, Zbox), Zp);
    const Ut = { re: Ud.re - Up.re, im: Ud.im - Up.im };
    const hp = hpGain(f, hpf, hpType);
    const p = (rho * w * cabs(Ut)) / (2 * Math.PI);
    // volts is RMS; x1.414 turns RMS travel and air speed into sine peaks, which Xmax and the 17 m/s limit mean
    out.push({ f, spl: 20 * Math.log10((p * hp) / 2e-5),
               xmm: Math.SQRT2 * (cabs(Ud) / (w * Sd)) * hp * 1000,
               vel: Math.SQRT2 * (cabs(Up) / Sp) * hp });
  }
  const band = out.filter((o) => o.f > 80 && o.f < 200);
  const ref = band.reduce((a, o) => a + o.spl, 0) / band.length;
  const f3 = (out.find((o) => o.spl >= ref - 3) || out[0]).f;
  const at = (t) => out.reduce((b, o) => (Math.abs(o.f - t) < Math.abs(b.f - t) ? o : b));
  const lo = out.filter((o) => o.f > 20 && o.f < 90);
  return {
    curve: out,
    Fb, f3, ref,
    spl30: at(30).spl, spl35: at(35).spl, spl45: at(45).spl,
    peakVel: Math.max(...lo.map((o) => o.vel)),
    peakVelF: lo.reduce((b, o) => (o.vel > b.vel ? o : b)).f,
    peakX: Math.max(...lo.map((o) => o.xmm)),
    peakXF: lo.reduce((b, o) => (o.xmm > b.xmm ? o : b)).f,
    xmaxPct: (Math.max(...lo.map((o) => o.xmm)) / ts.Xmax) * 100,
  };
}

// ---------------------------------------------------------------
// Sealed-box model for the mid-bass: the same driver circuit with the box
// compliance in series and no port. hp and lp are the crossover corners,
// Linkwitz-Riley 24 dB/oct. Voice-coil inductance is not modelled, so the top
// octave reads a little high. Excursion is the sine peak, as in boxModel.
// ---------------------------------------------------------------
function closedBox(ts, VbL, hp, lp, volts) {
  if (!ts || !VbL || VbL <= 0) return null;
  const rho = 1.18, c = 343;
  const Sd = ts.Sd / 10000, Mms = ts.Mms / 1000, Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd), Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const Ctot = (Cas * Cab) / (Cas + Cab);
  const Fc = 1 / (2 * Math.PI * Math.sqrt(Mas * Ctot));
  const Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl);
  const Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
  const Qtc = Qts * (Fc / ts.Fs);
  const N = 420, out = [];
  for (let i = 0; i < N; i++) {
    const f = 20 * Math.pow(2000 / 20, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Z = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cadd(cinv(cmul(s, cx(Cas))), cinv(cmul(s, cx(Cab))))));
    const U = cabs(cdiv(cx(Pg), Z));
    const g = (hp ? lr24hp(f, hp) : 1) * (lp ? lr24lp(f, lp) : 1);
    const raw = 20 * Math.log10((rho * w * U) / (2 * Math.PI) / 2e-5);
    out.push({ f, raw, spl: raw + 20 * Math.log10(g), xmm: Math.SQRT2 * (U / (w * Sd)) * g * 1000 });
  }
  const band = out.filter((o) => o.f > 200 && o.f < 500);
  const ref = band.reduce((a, o) => a + o.raw, 0) / band.length;
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[0]).f;
  return { curve: out, Fc, Qtc, f3, ref, peakX: Math.max(...out.map((o) => o.xmm)) };
}

const inToL = (w, h, d) => ((w - 2 * PLY) * (h - 2 * PLY) * (d - 2 * PLY) * 16.387) / 1000;
// Internal litres with walls of thickness t and a 3/4″ baffle recessed `inset` into the frame.
const boxL = (w, h, d, t, inset = 0.75) => ((w - 2 * t) * (h - 2 * t) * (d - inset - 0.75 - t) * 16.387) / 1000;
// Plywood weight, lb/ft² (birch). The baffle stays 3/4″ either way.
const PLY_LB = { 0.75: 2.3, 0.5: 1.6 };

// ---------------------------------------------------------------
// 3D view
// ---------------------------------------------------------------
function StackView({ sub, mid, horn, plinth, cutaway, portStyle, layout, baffleColor, portGeom, wall = 0.75, inset = 0.75, cabFinish = "birch", spacerH = 20 }) {
  const mount = useRef(null);
  const state = useRef({ rotY: 0.6, rotX: 0.35, drag: false, lx: 0, ly: 0 });

  useEffect(() => {
    const el = mount.current;
    const W = el.clientWidth || 640, H = el.clientHeight || 560;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x777766, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(40, 80, 30);
    scene.add(key);

    // cabinet finish: clear birch, walnut veneer, or paint (a hex colour)
    const finish = CAB_FINISHES[cabFinish];
    const birch = new THREE.MeshStandardMaterial({ color: finish ? finish.color : new THREE.Color(cabFinish), roughness: finish ? finish.rough : 0.8 });
    const edge = new THREE.LineBasicMaterial({ color: 0x5a4a30 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55 });
    const painted = new THREE.MeshStandardMaterial({ color: new THREE.Color(baffleColor), roughness: 0.9 });
    const ghost = new THREE.MeshStandardMaterial({ color: 0xd7b98a, roughness: 0.9, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const shellMat = cutaway ? ghost : birch;
    // duct fins, shelves and cut edges follow the cabinet finish, a shade darker
    const plyIn = new THREE.MeshStandardMaterial({ color: finish ? finish.inner : new THREE.Color(cabFinish).multiplyScalar(0.88), roughness: 0.9 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.95, side: THREE.DoubleSide });
    const baffleMat = cutaway ? new THREE.MeshStandardMaterial({ color: new THREE.Color(baffleColor), roughness: 0.9, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }) : painted;

    const group = new THREE.Group();
    scene.add(group);

    // cabinet: four perimeter panels (wall ply) with 1/4" roundovers front and back,
    // 3/4" baffle set back by the inset on cleats, painted. Returns the z of the baffle face.
    const T = wall, BT = 0.75, REVEAL = inset, RO = 0.25;
    const rr = (w, h, r) => {
      const x = w / 2, y = h / 2, sh = new THREE.Shape();
      sh.moveTo(-x + r, -y);
      sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r);
      sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y);
      sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r);
      sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
      return sh;
    };
    const rectPath = (cx, cy, w, h, r) => {
      const x = w / 2, y = h / 2, p = new THREE.Path();
      p.moveTo(cx - x + r, cy - y);
      p.lineTo(cx + x - r, cy - y); p.quadraticCurveTo(cx + x, cy - y, cx + x, cy - y + r);
      p.lineTo(cx + x, cy + y - r); p.quadraticCurveTo(cx + x, cy + y, cx + x - r, cy + y);
      p.lineTo(cx - x + r, cy + y); p.quadraticCurveTo(cx - x, cy + y, cx - x, cy + y - r);
      p.lineTo(cx - x, cy - y + r); p.quadraticCurveTo(cx - x, cy - y, cx - x + r, cy - y);
      return p;
    };
    const circPath = (cx, cy, r) => { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); return p; };
    const cabinet = (w, h, d, y, holes, baffleBottom = 0, x = 0, parent = group) => {
      const iw = w - 2 * T, ih = h - 2 * T - baffleBottom;
      const shape = rr(w, h, RO * 1.5);
      shape.holes.push(rr(iw + 2 * RO, h - 2 * T + 2 * RO, 0.12));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO, bevelEnabled: true, bevelSize: RO, bevelThickness: RO, bevelSegments: 4,
      });
      const frame = new THREE.Mesh(geo, shellMat);
      frame.position.set(x, y + h / 2, -d / 2 + RO);
      parent.add(frame);
      const bshape = rr(iw, ih, 0.12);
      (holes || []).forEach((hp) => bshape.holes.push(hp));
      const baffle = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false }),
        [baffleMat, cutaway ? baffleMat : plyIn] // caps painted, cut edges left as bare ply
      );
      baffle.position.set(x, y + T + baffleBottom + ih / 2, d / 2 - REVEAL - BT);
      parent.add(baffle);
      const back = new THREE.Mesh(new THREE.BoxGeometry(iw, h - 2 * T, T), shellMat);
      back.position.set(x, y + h / 2, -d / 2 + T / 2);
      parent.add(back);
      return d / 2 - REVEAL;
    };
    // Same construction with a semicircular top the full width of the cabinet.
    // Holes use the same baffle-centred coordinates as cabinet().
    const archOutline = (P, hw, yb, acy, r) => {
      P.moveTo(-hw, yb); P.lineTo(hw, yb); P.lineTo(hw, acy);
      P.absarc(0, acy, r, 0, Math.PI, false); P.lineTo(-hw, yb);
      return P;
    };
    const archCabinet = (w, h, d, y, holes, baffleBottom = 0, x = 0, parent = group) => {
      const R = w / 2, acy = h / 2 - R;                  // arch centre, frame-centred coords
      const shape = archOutline(new THREE.Shape(), R, -h / 2, acy, R);
      shape.holes.push(archOutline(new THREE.Path(), R - T + RO, -h / 2 + T - RO, acy, R - T + RO));
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * RO, bevelEnabled: true, bevelSize: RO, bevelThickness: RO, bevelSegments: 4,
        curveSegments: 48 }), shellMat);
      frame.position.set(x, y + h / 2, -d / 2 + RO);
      parent.add(frame);
      const ih = h - 2 * T - baffleBottom, bcy = y + T + baffleBottom + ih / 2;
      const bshape = archOutline(new THREE.Shape(), R - T, -ih / 2, (y + h - R) - bcy, R - T);
      (holes || []).forEach((hp) => bshape.holes.push(hp));
      const baffle = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bshape, { depth: BT, bevelEnabled: false, curveSegments: 48 }),
        [baffleMat, cutaway ? baffleMat : plyIn]);
      baffle.position.set(x, bcy, d / 2 - REVEAL - BT);
      parent.add(baffle);
      const bk = archOutline(new THREE.Shape(), R - T, -h / 2 + T, acy, R - T);
      const back = new THREE.Mesh(new THREE.ExtrudeGeometry(bk, { depth: T, bevelEnabled: false, curveSegments: 48 }), shellMat);
      back.position.set(x, y + h / 2, -d / 2);
      parent.add(back);
      return d / 2 - REVEAL;
    };
    const cone = (r, y, z, x = 0, parent = group) => {
      if (cutaway) return;
      // membrane: a filled disc just behind the baffle face
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 48), black);
      disc.position.set(x, y, z - 0.3);
      parent.add(disc);
      // shallow cone from the surround down to the dust cap
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 0.22, 48, 1, true), black);
      c.rotation.x = -Math.PI / 2;
      c.position.set(x, y, z - 0.3 - r * 0.11);
      parent.add(c);
      const surround = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.055, 12, 48), black);
      surround.position.set(x, y, z - 0.18);
      parent.add(surround);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), black);
      cap.scale.set(1, 0.45, 1);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(x, y, z - 0.42);
      parent.add(cap);
    };

    const subGroup = new THREE.Group();
    group.add(subGroup);
    // plinth / toe-kick, inset so the column appears to float
    // the 4-corner port needs a square baffle, so it implies the symmetric box
    const cornerPort = portStyle === "round4";
    const vSlot = portStyle === "vslots" || portStyle === "vwide" || portStyle === "vslot1";
    const sides = portStyle === "vslot1" ? [1] : [-1, 1];   // side ducts: one wall or both
    const vWide = portStyle === "vwide";
    const s = sub.box;
    const pg = portGeom || {};   // explicit vent geometry when the cabinet is custom
    const pl = plinth || 0;
    if (pl > 0) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(s.w - 3, pl, s.d - 3), birch);
      p.position.set(0, pl / 2, 0);
      subGroup.add(p);
    }
    // sub column: driver cutout high on the baffle, three duct cutouts across the bottom
    const ductH = pg.ductH != null ? pg.ductH : 3, innerW = s.w - 2 * T, ductW = (innerW - 2 * T) / 3;
    const drvR = sub.size / 2 - 0.9;
    const round = !["slots", "folded", "vslots", "vwide", "vslot1"].includes(portStyle); // round-tube ports only
    // one place that decides the box's shape and what internal structure it needs
    const boxKind = vSlot ? "block" : cornerPort ? "cube" : "column";
    const corners = portStyle === "round4";
    const nPorts = pg.nPorts != null ? pg.nPorts : (portStyle === "round1" ? 1 : corners ? 4 : 2);
    const portR = pg.portR != null ? pg.portR : (portStyle === "round1" ? 8 : corners ? (sub.size >= 18 ? 4 : 3.5) : 5) / 2;
    const bandH = round || vSlot ? 0 : ductH + T;           // slots: baffle starts above the duct shelf
    // Tower: one shell and one continuous baffle; sections are divided internally.
    const towerMode = layout === "tower";
    const TW_MID = 15.5;
    const archTop = towerMode && !!horn.profile && !horn.scaleX && s.w / 2 - T > horn.size.w / 2;
    // arched: horn centred on the arch, equal margin below and around it
    const twHsH = archTop ? (s.w / 2 - T) + s.w / 2 : horn.size.h + 2;
    const extH = towerMode ? TW_MID + twHsH : 0;
    const baffleH = s.h + extH - 2 * T - bandH;
    const baffleCy = pl + T + bandH + baffleH / 2; // absolute centre of the baffle
    // centred when symmetric; bottom slots: centred in the baffle above the duct (sub section only in a tower)
    const drvAbsY = corners || vSlot ? pl + s.h / 2
      : !round ? pl + T + bandH + (s.h - 2 * T - bandH) / 2
      : pl + s.h - T - innerW / 2;
    const vThroat = pg.throat != null ? pg.throat : Math.round(((sub.size >= 18 ? 66 : 54) / (2 * (s.h - 2 * T))) * 100) / 100;
    // a single side duct pushes the driver into the middle of the remaining baffle
    const drvX = sides.length === 1 && vSlot ? -sides[0] * (vThroat + 0.43 + T) / 2 : 0;
    const holes = [circPath(drvX, drvAbsY - baffleCy, drvR)];
    let portCy = 0;
    if (round) {
      // 8" sits low on the baffle; 5" pair centred 10" up
      portCy = corners ? 0 : (portStyle === "round1" ? pl + T + portR + 0.75 + 1 : pl + 10) - baffleCy;
      if (corners) {
        const off = innerW / 2 - portR - 0.75 - 0.4;
        [-1, 1].forEach((kx) => [-1, 1].forEach((ky) => holes.push(circPath(kx * off, ky * off, portR))));
      } else if (nPorts === 1) holes.push(circPath(0, portCy, portR));
      else [-1, 1].forEach((k) => holes.push(circPath(k * (portR + 2.6), portCy, portR)));
    }
    if (vSlot) {
      // full-height ducts using the side walls as their outer face
      const slotH = s.h - 2 * T;
      const throat = vThroat;
      const mouth = throat + 0.43;                 // flat strip set at 20 deg: 0.43 in rise
      const sx = innerW / 2 - mouth / 2;
      sides.forEach((k) => holes.push(rectPath(k * sx, pl + s.h / 2 - baffleCy, mouth, slotH, 0.12)));
    }
    if (towerMode) {
      holes.push(circPath(0, pl + s.h + TW_MID / 2 - baffleCy, (mid.size || 12) / 2 - 0.9));
      const hy = (archTop ? pl + s.h + TW_MID + (s.w / 2 - T) : pl + s.h + TW_MID + twHsH / 2) - baffleCy;
      holes.push(horn.rect ? rectPath(0, hy, innerW - 1, horn.size.h, 1.2)
        : horn.profile ? circPath(0, hy, Math.min(horn.size.w, horn.size.h) / 2 - 0.2)
        : rectPath(0, hy, horn.size.w, horn.size.h, 1));
    }
    const subZ = (archTop ? archCabinet : cabinet)(s.w, s.h + extH, s.d, pl, holes, bandH, 0, subGroup);
    if (towerMode) {
      // internal partitions: sub/mid floor, mid/horn floor, and the mid chamber's back wall
      const zF = s.d / 2 - REVEAL - BT, zB = -s.d / 2 + T, dep = zF - zB;
      [pl + s.h - T / 2, pl + s.h + TW_MID - T / 2].forEach((py) => {
        const pp = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, dep), plyIn);
        pp.position.set(0, py, (zF + zB) / 2);
        subGroup.add(pp);
      });
    }
    if (vSlot) {
      // Full-height duct against each side wall. The inner wall is a constant
      // thickness panel chamfered 20 deg at both ends, so the duct runs a
      // straight throat with a flared mouth front and rear.
      const slotH = s.h - 2 * T;
      const throat = vThroat;
      const mouth = throat + 0.43;
      const FL = 0.43 / Math.tan((20 * Math.PI) / 180);   // 1.18 in along the duct
      const yc = pl + s.h / 2;
      const zf = s.d / 2;                                  // duct mouth, flush with the frame face
      const zb = -s.d / 2 + T;                             // inside face of the back panel
      // rear end of the duct: the set duct length back from the mouth, leaving at least a
      // throat-width gap to the back panel
      const zr = Math.max(zb + throat, zf - (pg.tubeLen != null ? pg.tubeLen : zf - zb));
      const sideLen = zf - zr;

      sides.forEach((k) => {
        const xo = k * (innerW / 2);                       // inside face of the side wall
        const xT = xo - k * throat;                        // duct face at the throat
        const xM = xo - k * mouth;                         // duct face at a flared end
        // profile in world XZ; shape coords are (x, -z) so the extrusion runs along +Y
        const sh = new THREE.Shape();
        sh.moveTo(xM, -zf);
        sh.lineTo(xT, -(zf - FL));
        sh.lineTo(xT, -(zr + FL));
        sh.lineTo(xM, -zr);
        sh.lineTo(xM - k * T, -zr);
        sh.lineTo(xT - k * T, -(zr + FL));
        sh.lineTo(xT - k * T, -(zf - FL));
        sh.lineTo(xM - k * T, -zf);
        sh.closePath();
        const wall = new THREE.Mesh(
          new THREE.ExtrudeGeometry(sh, { depth: slotH, bevelEnabled: false }), plyIn);
        wall.rotation.x = -Math.PI / 2;
        wall.position.set(0, yc - slotH / 2, 0);
        subGroup.add(wall);

        // two 1/2 in dividers per duct, bracing the inner wall to the side wall
        [-1, 1].forEach((f) => {
          const div = new THREE.Mesh(new THREE.BoxGeometry(throat, 0.5, sideLen), plyIn);
          div.position.set(k * (innerW / 2 - throat / 2), yc + (f * slotH) / 6, zr + sideLen / 2);
          subGroup.add(div);
        });
      });
        } else if (!round) {
      // duct mouths sit flush with the frame face; the box bottom is the duct floor
      const band = rr(innerW, bandH, 0.12);
      for (let k = -1; k <= 1; k++) band.holes.push(rectPath(k * (ductW + T), -T / 2, ductW, ductH, 0.25));
      if (REVEAL > 0) {
        const nose = new THREE.Mesh(new THREE.ExtrudeGeometry(band, { depth: REVEAL, bevelEnabled: false }), shellMat);
        nose.position.set(0, pl + T + bandH / 2, s.d / 2 - REVEAL);
        subGroup.add(nose);
      }
    } else {
      // flared tubes behind the baffle: bell, straight section, inner bell
      const tubeLen = pg.tubeLen != null ? pg.tubeLen : (portStyle === "round1" ? 11 : corners ? 11.5 : 9.8);
      const off = innerW / 2 - portR - 0.75 - 0.4;
      const spots = corners
        ? [[-off, -off], [off, -off], [-off, off], [off, off]].map(([a, b]) => [a, pl + s.h / 2 + b])
        : (nPorts === 1 ? [0] : [-(portR + 2.6), portR + 2.6]).map((a) => [a, baffleCy + portCy]);
      spots.forEach(([x, yy]) => {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(portR, portR, tubeLen, 32, 1, true), portMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(x, yy, subZ - tubeLen / 2); // starts at the baffle face, runs back
        subGroup.add(tube);
        // quarter-round flares, tangent to the tube at the throat
        const RB = 0.75, seg = 10;
        const prof = [];
        for (let i = 0; i <= seg; i++) {
          const t = (i / seg) * (Math.PI / 2);
          prof.push(new THREE.Vector2(portR + RB * (1 - Math.cos(t)), RB * Math.sin(t)));
        }
        [[subZ, 1], [subZ - tubeLen, -1]].forEach(([z, dir]) => {
          const bell = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), portMat);
          bell.rotation.x = dir > 0 ? Math.PI / 2 : -Math.PI / 2; // opens away from the tube at each end
          bell.position.set(x, yy, z);
          subGroup.add(bell);
        });
      });
    }
    cone(drvR, drvAbsY, subZ, drvX, subGroup);
    // duct structure inside: top shelf, two fins (slot version only)
    const wantLen = pg.tubeLen != null ? pg.tubeLen : s.d - T - 3;
    const ductLen = Math.max(2, Math.min(wantLen, s.d - T - ductH)); // from the frame face back, open gap behind
    if (portStyle === "folded") {
      // floor leg to a rear channel, then up the back wall; open at the top of the rear channel
      const bz = -s.d / 2 + T;                          // inside face of the back panel
      const wallZ = bz + ductH + T / 2;                 // rear channel's front wall
      const roofLen = s.d / 2 - (wallZ + T / 2);
      const roofZ = s.d / 2 - roofLen / 2;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, roofLen), plyIn);
      roof.position.set(0, pl + T + ductH + T / 2, roofZ);
      subGroup.add(roof);
      [-1, 1].forEach((k) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, roofLen), plyIn);
        fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, roofZ);
        subGroup.add(fin);
      });
      // the rear channel rises until the centreline adds up to the set duct length
      // The wall starts at the floor leg's roof, so the floor leg runs on under it into the
      // rear channel, turns, and rises between this wall and the back panel.
      const floorRun = roofLen + T + ductH / 2;
      const wallBot = pl + T + ductH;
      const wallTop = Math.min(pl + s.h - T - 1, Math.max(wallBot + 1, pl + T + ductH / 2 + (wantLen - floorRun)));
      const wallH = wallTop - wallBot;
      const rw = new THREE.Mesh(new THREE.BoxGeometry(innerW, wallH, T), plyIn);
      rw.position.set(0, wallBot + wallH / 2, wallZ);
      subGroup.add(rw);
    }
    if (portStyle === "slots") {
    const ductZ = s.d / 2 - ductLen / 2;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(innerW, T, ductLen), plyIn);
    shelf.position.set(0, pl + T + ductH + T / 2, ductZ);
    subGroup.add(shelf);
    [-1, 1].forEach((k) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(T, ductH, ductLen), plyIn);
      fin.position.set((k * (ductW + T)) / 2, pl + T + ductH / 2, ductZ);
      subGroup.add(fin);
    });
    }
    // mid cube: on the sub, or on round columns either side of it
    const tower = layout === "tower";
    // Tower: one enclosure per side. The mid chamber and horn section share the
    // sub's footprint and sit directly on it, so the three read as one cabinet.
    const m = tower ? { w: s.w, h: 15.5, d: s.d } : mid.box;
    const gap = 0.4;
    const sat = layout === "satellite";
    const pole = layout === "pole";
    const COL_D = 8, COL_H = 34;                       // column diameter and height
    const satX = s.w / 2 + COL_D / 2 + 6;              // columns clear of the sub
    const subTop = pl + s.h;
    const POLE_RISE = spacerH;                         // exposed spacer above the sub top
    const midBaseY = sat ? COL_H : pole ? subTop + POLE_RISE : tower ? subTop : subTop + gap;
    const midXs = sat ? [-satX, satX] : [0];
    if (pole) {
      // Three-post spacer: 6 in discs top and bottom, three 1.25 in posts on a
      // 4 in circle, 35 mm spigots into the cabinets at each end.
      const DR = 3, DT = 1, PR = 0.625, PCIRC = 2, SPIG = 0.69;
      const yBot = subTop, yTop = subTop + POLE_RISE;
      [yBot + DT / 2, yTop - DT / 2].forEach((y) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(DR, DR, DT, 44), birch);   // cabinet finish
        d.position.set(0, y, 0);
        subGroup.add(d);
      });
      const postLen = POLE_RISE - 2 * DT;
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3 + Math.PI / 6;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, postLen, 28), birch);
        p.position.set(PCIRC * Math.cos(a), yBot + DT + postLen / 2, PCIRC * Math.sin(a));
        subGroup.add(p);
        // threaded rod up the middle of each post, visible in cutaway
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, POLE_RISE, 12), black);
        rod.position.set(PCIRC * Math.cos(a), yBot + POLE_RISE / 2, PCIRC * Math.sin(a));
        subGroup.add(rod);
      }
      // spigots buried in each cabinet
      [[yBot - 1.25, 2.5], [yTop + 1.25, 2.5]].forEach(([y, len]) => {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(SPIG, SPIG, len, 20), black);
        sp.position.set(0, y, 0);
        subGroup.add(sp);
      });
    }
    if (sat) {
      midXs.forEach((x) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2, COL_D / 2, COL_H, 40), birch);
        col.position.set(x, COL_H / 2, 0);
        group.add(col);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2 + 1, COL_D / 2 + 1, 1, 40), birch);
        cap.position.set(x, COL_H + 0.5, 0);
        group.add(cap);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(COL_D / 2 + 2.5, COL_D / 2 + 2.5, 1.5, 40), birch);
        base.position.set(x, 0.75, 0);
        group.add(base);
      });
    }
    let midZ = 0;
    midXs.forEach((x) => {
      midZ = tower ? subZ : cabinet(m.w, m.h, m.d, midBaseY, [circPath(0, 0, (mid.size || 12) / 2 - 0.9)], 0, x);
      cone((mid.size || 12) / 2 - 0.9, midBaseY + m.h / 2, midZ, x);
    });

    // horn
    const hz = horn.size;
    const hornY = midBaseY + m.h;
    let hornCY = null, hornZ = null;
    if (tower) {
      hornCY = archTop ? hornY + (s.w / 2 - T) : hornY + (hz.h + 2) / 2;
      hornZ = subZ - hz.d + 0.2;            // mouth flush with the shared baffle face
    }
    if (!horn.profile && !horn.rect && !tower) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(hz.w * 0.5, 1.2, hz.d * 0.5), black);
      stand.position.set(midXs[0], hornY + 0.6, 0);
      group.add(stand);
    }
    const rectHornGeo = (mw, mh, depth, tr = 0.5) => {
      const NS = 40, NP = 112, pos = [], idx = [];
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, g = Math.pow(t, 1.7);
        const a = tr + (mw / 2 - tr) * g, b = tr + (mh / 2 - tr) * g;
        const n = 2 + 7 * Math.pow(t, 1.4);          // superellipse exponent: circle -> squarish
        for (let j = 0; j < NP; j++) {
          const th = (j / NP) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
          pos.push(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
                   b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), depth * t);
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NP; j++) {
        const a0 = i * NP + j, a1 = i * NP + ((j + 1) % NP);
        idx.push(a0, a0 + NP, a1, a1, a0 + NP, a1 + NP);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    };
    midXs.forEach((hx) => {
    if (horn.rect) {
      const mw = tower ? innerW - 1 : m.w;
      const rm = new THREE.Mesh(rectHornGeo(mw, hz.h, hz.d),
        new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55, side: THREE.DoubleSide }));
      rm.position.set(hx, tower ? hornCY : hornY + hz.h / 2 + 0.3, tower ? hornZ : m.d / 2 - hz.d + 1);
      group.add(rm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2; th.position.set(hx, rm.position.y, rm.position.z - 2); group.add(th);
    } else if (horn.profile) {
      const sc = horn.scale || 1;
      const pts = horn.profile.map(([r, x]) => new THREE.Vector2(r * sc, x * sc));
      const lathe = new THREE.LatheGeometry(pts, 96);
      const lm = new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.55, side: THREE.DoubleSide }));
      lm.rotation.x = Math.PI / 2; // lathe axis (y) -> z, mouth toward +z
      if (horn.scaleX || horn.scaleY || horn.scaleZ) lm.scale.set(horn.scaleX || 1, horn.scaleZ || 1, horn.scaleY || 1); // local x=width, y=depth, z=height
      lm.position.set(hx, tower ? hornCY : hornY + hz.h / 2 + 0.3, tower ? hornZ : m.d / 2 - hz.d + 1);
      group.add(lm);
      const th = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
      th.rotation.x = Math.PI / 2; th.position.set(hx, lm.position.y, tower ? hornZ - 2 : -2.2); group.add(th);
    } else {
    const hornShape = new THREE.Shape();
    const rw = hz.w / 2, rh = hz.h / 2, r = Math.min(rw, rh) * 0.5;
    hornShape.moveTo(-rw + r, -rh);
    hornShape.lineTo(rw - r, -rh); hornShape.quadraticCurveTo(rw, -rh, rw, -rh + r);
    hornShape.lineTo(rw, rh - r); hornShape.quadraticCurveTo(rw, rh, rw - r, rh);
    hornShape.lineTo(-rw + r, rh); hornShape.quadraticCurveTo(-rw, rh, -rw, rh - r);
    hornShape.lineTo(-rw, -rh + r); hornShape.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
    const hornGeo = new THREE.ExtrudeGeometry(hornShape, { depth: hz.d, bevelEnabled: true, bevelSize: 1.6, bevelThickness: 1.2, bevelSegments: 6 });
    const hornMesh = new THREE.Mesh(hornGeo, cream);
    hornMesh.position.set(hx, tower ? hornCY : hornY + 1.2 + rh + 1, tower ? hornZ : -hz.d / 2 + 2);
    group.add(hornMesh);
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 4, 32), black);
    throat.rotation.x = Math.PI / 2;
    throat.position.set(hx, hornMesh.position.y, tower ? hornZ - 2.5 : -hz.d / 2 - 0.5);
    group.add(throat);
    }
    });

    // 5 ft 9 in scale figure: standard pictogram silhouette, billboarded
    const figure = (() => {
      const H = 69, u = H / 100;
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x8b847d, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
      const body = new THREE.Shape();
      const P = [
        [6.5, 85], [10.0, 82], [11.0, 70], [8.0, 50], [6.5, 30], [5.5, 1],
        [1.0, 1], [0, 40], [-1.0, 1], [-5.5, 1], [-6.5, 30], [-8.0, 50],
        [-11.0, 70], [-10.0, 82], [-6.5, 85],
      ];
      body.moveTo(P[0][0] * u, P[0][1] * u);
      P.slice(1).forEach(([x, y]) => body.lineTo(x * u, y * u));
      body.closePath();
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(body), mat));
      const head = new THREE.Shape();
      head.absarc(0, 92.5 * u, 6 * u, 0, Math.PI * 2, false);
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(head), mat));
      g.position.set(-s.w * 1.4, 0, 3);
      group.add(g);
      return g;
    })();

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new THREE.GridHelper(120, 10, 0xd9d2c4, 0xe6e0d4));

    group.position.y = 0;

    // Frame from the real bounding box so nothing is cropped at any aspect
    // ratio. The horizontal radius is taken as the diagonal of the footprint
    // so the fit holds through a full rotation rather than only head-on.
    const bbox = new THREE.Box3().setFromObject(group);
    const bc = bbox.getCenter(new THREE.Vector3());
    const bs = bbox.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(bc.x, bc.y, bc.z);
    const halfH = bs.y / 2;
    const halfW = Math.sqrt(bs.x * bs.x + bs.z * bs.z) / 2;
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    let baseDist = halfH / tanV;
    const fit = (aspect) => {
      baseDist = Math.max(halfH / tanV, halfW / (aspect * tanV)) * 1.18;
    };
    fit(W / H);

    const st = state.current;
    if (st.zoom == null) st.zoom = 1;

    // Pointer handling. touch-action on the canvas is pan-y, so a mostly
    // vertical swipe scrolls the page and anything else reaches us here.
    const pts = new Map();
    let pinch0 = 0, zoom0 = 1;

    const onDown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = st.zoom;
      }
      st.drag = true; st.lx = e.clientX; st.ly = e.clientY;
    };

    const onMove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) st.zoom = Math.max(0.45, Math.min(2.2, zoom0 * (pinch0 / d)));
        return; // pinching, not rotating
      }
      if (!st.drag) return;
      st.rotY += (e.clientX - st.lx) * 0.01;
      st.rotX = Math.max(0.05, Math.min(1.2, st.rotX + (e.clientY - st.ly) * 0.006));
      st.lx = e.clientX; st.ly = e.clientY;
    };

    const onUp = (e) => {
      pts.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) st.drag = false;
      else { const p = [...pts.values()][0]; st.lx = p.x; st.ly = p.y; }
    };

    const onWheel = (e) => {
      e.preventDefault();
      st.zoom = Math.max(0.45, Math.min(2.2, st.zoom * (1 + e.deltaY * 0.0012)));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Keep the canvas and the framing correct through rotation and resize.
    const resize = () => {
      const w = el.clientWidth || W, h = el.clientHeight || H;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      fit(w / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener("orientationchange", resize);

    let raf;
    const tick = () => {
      const dist = baseDist * st.zoom;
      cam.position.set(
        target.x + dist * Math.sin(st.rotY) * Math.cos(st.rotX),
        target.y + dist * Math.sin(st.rotX),
        target.z + dist * Math.cos(st.rotY) * Math.cos(st.rotX)
      );
      cam.lookAt(target);
      if (figure) figure.quaternion.copy(cam.quaternion);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [sub, mid, horn, plinth, cutaway, portStyle, layout, baffleColor, portGeom, wall, inset, cabFinish, spacerH]);

  return <div ref={mount} className="w-full h-full cursor-grab" />;
}

function SignalPath() {
  const ink = "#292524", mute = "#78716c", line = "#57534e";
  const col = { pa2: "#7c3aed", sub: "#0f766e", mid: "#c2410c", hf: "#b45309", grey: "#a8a29e" };
  const Box = ({ x, y, w, h, c, children }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#fafaf9" stroke={c} strokeWidth="1.5" />
      {children}
    </g>
  );
  const T = ({ x, y, s = 11, c = ink, a = "middle", b }) => (
    <text x={x} y={y} fontSize={s} fill={c} textAnchor={a} fontFamily="system-ui, sans-serif" fontWeight={b ? 600 : 400}>{b}</text>
  );
  const A = ({ d, c = line }) => <path d={d} fill="none" stroke={c} strokeWidth="1.3" markerEnd="url(#sp-ar)" />;
  return (
    <svg viewBox="0 0 860 400" width="100%" role="img" aria-label="Mains rack signal path">
      <defs><marker id="sp-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke={line} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>

      <T x={60} y={22} c={mute} b="Source" /><T x={215} y={22} c={mute} b="Processor" /><T x={415} y={22} c={mute} b="Amps" /><T x={600} y={22} c={mute} b="Rear panel" /><T x={770} y={22} c={mute} b="Stacks" />

      <Box x={15} y={190} w={90} h={52} c={col.grey}><T x={60} y={212} b="DJ mixer" /><T x={60} y={230} s={10} c={mute} b="master L/R" /></Box>
      <A d="M105 216 L150 216" /><T x={127} y={208} s={10} c={mute} b="XLR" />

      <Box x={150} y={110} w={130} h={220} c={col.pa2}>
        <T x={215} y={132} b="dbx DriveRack PA2" /><T x={215} y={148} s={10} c={mute} b="2 in / 6 out" />
        <T x={215} y={176} s={10} c={mute} b="inputs: venue EQ" /><T x={215} y={190} s={10} c={mute} b="outputs: XO, EQ, delay, limit" />
        <T x={272} y={230} s={10} a="end" c={col.sub} b="Sub L / R" /><T x={272} y={270} s={10} a="end" c={col.mid} b="Mid L / R" /><T x={272} y={310} s={10} a="end" c={col.hf} b="Horn L / R" />
      </Box>

      <Box x={350} y={205} w={130} h={44} c={col.sub}><T x={415} y={223} b="QSC GXD8" /><T x={415} y={239} s={10} c={mute} b="800 W/ch @ 8 Ω" /></Box>
      <Box x={350} y={262} w={130} h={44} c={col.mid}><T x={415} y={280} b="QSC GXD4" /><T x={415} y={296} s={10} c={mute} b="400 W/ch @ 8 Ω" /></Box>
      <Box x={350} y={319} w={130} h={44} c={col.hf}><T x={415} y={337} b="QSC GXD4" /><T x={415} y={353} s={10} c={mute} b="gain trimmed · HPF 500 Hz" /></Box>
      <A d="M280 226 L350 226" c={col.sub} /><A d="M280 266 L350 283" c={col.mid} /><A d="M280 306 L350 340" c={col.hf} />

      <Box x={555} y={150} w={90} h={230} c={col.grey}><T x={600} y={170} b="Speakon" /><T x={600} y={184} s={10} c={mute} b="4× NL4MP" /></Box>
      <rect x={565} y={200} width={70} height={22} rx="4" fill="none" stroke={col.sub} /><T x={600} y={215} s={10} c={col.sub} b="SUB L · 1±" />
      <rect x={565} y={228} width={70} height={22} rx="4" fill="none" stroke={col.sub} /><T x={600} y={243} s={10} c={col.sub} b="SUB R · 1±" />
      <rect x={565} y={290} width={70} height={36} rx="4" fill="none" stroke={col.mid} /><T x={600} y={304} s={10} c={col.mid} b="TOP L" /><T x={600} y={318} s={9} c={mute} b="1± mid · 2± horn" />
      <rect x={565} y={332} width={70} height={36} rx="4" fill="none" stroke={col.mid} /><T x={600} y={346} s={10} c={col.mid} b="TOP R" /><T x={600} y={360} s={9} c={mute} b="1± mid · 2± horn" />
      <A d="M480 222 L565 211" c={col.sub} /><A d="M480 232 L565 239" c={col.sub} />
      <A d="M480 278 L565 300" c={col.mid} /><A d="M480 290 L565 342" c={col.mid} />
      <A d="M480 335 L565 318" c={col.hf} /><A d="M480 347 L565 360" c={col.hf} />
      <T x={518} y={196} s={9} c={mute} b="binding posts, 12 AWG" />

      <Box x={690} y={196} w={110} h={26} c={col.sub}><T x={745} y={213} s={10} b="Sub L" /></Box>
      <Box x={690} y={226} w={110} h={26} c={col.sub}><T x={745} y={243} s={10} b="Sub R" /></Box>
      <Box x={690} y={288} w={110} h={40} c={col.mid}><T x={745} y={304} s={10} b="Mid box L" /><T x={745} y={319} s={9} c={mute} b="posts → horn L" /></Box>
      <Box x={690} y={332} w={110} h={40} c={col.mid}><T x={745} y={348} s={10} b="Mid box R" /><T x={745} y={363} s={9} c={mute} b="posts → horn R" /></Box>
      <A d="M645 211 L690 209" /><A d="M645 239 L690 239" /><T x={667} y={202} s={9} c={mute} b="NL2" />
      <A d="M645 308 L690 308" /><A d="M645 352 L690 352" /><T x={667} y={300} s={9} c={mute} b="NL4" />

      <T x={15} y={394} s={10} a="start" c={mute} b="Crossovers in the PA2: sub HPF ~32 Hz BW24 · sub/mid 100–120 Hz LR4 · mid/horn ~1.1 kHz LR4. Amps run full-range; limiters set per driver in each amp." />
    </svg>
  );
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
function Pick({ label, options, value, onChange }) {
  return (
    <div className="mb-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <select
        value={value?.id ?? ""}
        onChange={(e) => onChange(options.find((o) => o.id === e.target.value))}
        className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500 focus:outline-none focus:border-stone-900"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.pick ? "● " : ""}{o.name}{o.price ? ` — $${o.price}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// Max-SPL chart: one or more curves ({f, spl}), fixed 80-135 dB so setups compare directly.
function ResponseChart({ series, marks = [], fmax = 200, fmin = 15, top = 135, bot = 80, step = 5, yLabel = "max dB SPL @ 1 m", H = 300 }) {
  const W = 760, L = 52, R = 14, TT = 16, B = 36;
  const x0 = L, x1 = W - R, y0 = TT, y1 = H - B;
  const TOP = top, BOT = bot;
  const px = (f) => x0 + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (x1 - x0);
  const py = (v) => y1 - ((Math.max(BOT, Math.min(TOP, v)) - BOT) / (TOP - BOT)) * (y1 - y0);
  const paths = series.map((sr) => {
    const pts = sr.curve.filter((o) => o.f >= fmin && o.f <= fmax);
    const d = pts.map((p, i) => (i ? "L" : "M") + px(p.f).toFixed(1) + "," + py(p.spl).toFixed(1)).join("");
    return { ...sr, d, fill: pts.length ? d + `L${px(pts[pts.length - 1].f).toFixed(1)},${y1} L${px(pts[0].f).toFixed(1)},${y1} Z` : "" };
  });
  const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((f) => f <= fmax);
  const grid = [];
  ticks.forEach((f) => {
    const X = px(f);
    grid.push(<line key={"v" + f} x1={X} y1={y0} x2={X} y2={y1} stroke="#e7e5e4" strokeWidth="1" />);
    grid.push(<text key={"vt" + f} x={X} y={y1 + 18} textAnchor="middle" fill="#a8a29e" fontSize="11" fontFamily="system-ui, sans-serif">{f >= 1000 ? f / 1000 + "k" : f}</text>);
  });
  for (let v = BOT; v <= TOP; v += step) {
    const Y = py(v);
    grid.push(<line key={"h" + v} x1={x0} y1={Y} x2={x1} y2={Y} stroke="#e7e5e4" strokeWidth="1" />);
    grid.push(<text key={"ht" + v} x={x0 - 8} y={Y + 3.5} textAnchor="end" fill="#a8a29e" fontSize="11" fontFamily="system-ui, sans-serif">{v}</text>);
  }
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} against frequency`} style={{ display: "block", width: "100%", height: "auto" }}>
        {grid}
        {marks.filter((m) => m.f > fmin && m.f < fmax).map((m, i, ms) => (
          <g key={m.label + i}>
            <line x1={px(m.f)} y1={y0} x2={px(m.f)} y2={y1} stroke="#a8a29e" strokeWidth="1" strokeDasharray="3 4" />
            <text x={px(m.f) + 5} y={y0 + 13 + (ms.slice(0, i).some((o) => Math.abs(px(o.f) - px(m.f)) < 70) ? 14 : 0)} fill="#a8a29e" fontSize="10.5" fontFamily="system-ui, sans-serif">{m.label}</text>
          </g>
        ))}
        {paths.map((p) => <path key={p.label + "f"} d={p.fill} fill={p.tint} />)}
        {paths.map((p) => <path key={p.label} d={p.d} fill="none" stroke={p.stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
        {paths.map((p, i) => (
          <g key={p.label + "k"}>
            <line x1={x0 + 10} y1={y0 + 8 + i * 16} x2={x0 + 30} y2={y0 + 8 + i * 16} stroke={p.stroke} strokeWidth="2" />
            <text x={x0 + 36} y={y0 + 12 + i * 16} fill="#57534e" fontSize="11" fontFamily="system-ui, sans-serif">{p.label}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#a8a29e" fontSize="11" fontFamily="system-ui, sans-serif">frequency, Hz</text>
        <text transform={`translate(13,${(y0 + y1) / 2}) rotate(-90)`} textAnchor="middle" fill="#a8a29e" fontSize="11" fontFamily="system-ui, sans-serif">{yLabel}</text>
      </svg>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline gap-3 mb-1">
        <span className="text-sm text-stone-600">{label}</span>
        <span className="text-sm tabular-nums font-medium">{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 0) : value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-stone-900" />
    </div>
  );
}

// ---------------------------------------------------------------
// Notes page: project decisions that aren't planner output
// ---------------------------------------------------------------
function NotesPage() {
  return (
    <main className="max-w-6xl mx-auto px-8 pb-16 flex flex-col gap-2">
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ fontFamily: "system-ui, sans-serif" }}>
          {RACKS.map((r) => {
            const total = r.items.reduce((a, [, c]) => a + c, 0);
            return (
              <div key={r.id} className="border border-stone-300 rounded-lg p-4 bg-stone-50">
                <div className="flex justify-between items-baseline mb-1">
                  <h2 className="text-xl" style={{ fontFamily: "Georgia, serif" }}>{r.name}</h2>
                  <span className="text-sm tabular-nums text-stone-600">≈ ${total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-stone-500 mb-3">{r.note}</p>
                <ul className="text-sm text-stone-700 space-y-1">
                  {r.items.map(([label, cost]) => (
                    <li key={label} className="flex justify-between gap-3"><span>{label}</span><span className="tabular-nums text-stone-500">${cost}</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-2" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-2" style={{ fontFamily: "Georgia, serif" }}>Signal path (mains rack)</h2>
          <div className="max-w-4xl"><SignalPath /></div>
          <p className="text-sm text-stone-700 max-w-3xl mt-3">
            Division of labour: the PA2 holds input EQ and master level, then crossovers, delay and driver EQ on six outputs.
            Each output feeds one amp channel, set full-range, with the amp's own limiter configured from the driver's power and
            impedance so it references real output voltage. A safety high-pass around 500 Hz in the horn amp catches a mis-recalled
            preset, which a level limiter cannot.
          </p>
        </section>
        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Amp DSP: QSC GXD4 / GXD8</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Power per channel", "GXD4: 400 W into 8 \u03a9, 600 W into 4 \u03a9. GXD8: 800 W into 8 \u03a9, 1200 W into 4 \u03a9. Continuous, both channels driven. Voltage gain 33.5 dB (GXD4), 36.5 dB (GXD8)."],
              ["Filters", "Linkwitz-Riley 24 dB/oct only. Highpass 20 Hz\u20134 kHz, lowpass 60 Hz\u20134 kHz. No Butterworth and nothing steeper. Plus a 4-band PEQ (\u00b112 dB, 0.1\u20133 oct) and 50 ms of delay."],
              ["Limiter", "\u201cSmart Speaker Protection\u201d: Mild, Medium or Aggressive; a speaker power of 5\u2013800 W (GXD8) or 5\u2013400 W (GXD4); and 4 or 8 \u03a9. QSC say to set the power to the speaker's continuous rating."],
              ["What it can't do", "No threshold in volts, no attack or release settings, no limiting confined to one band. QSC don't say how the power setting maps to a threshold (the spec sheet calls it a peak limiter, the manual an RMS limiter)."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <h3 className="text-base font-medium mt-5 mb-2">Protecting an excursion-limited sub with a GXD</h3>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["1. Highpass", "At or a little above tuning, LR24. Set the planner's highpass to LR24 to match."],
              ["2. Limiter power", "The lower of the planner's \u201ccone reaches Xmax at X W\u201d and the driver's rating; Medium or Aggressive. On a GXD8 the ceiling is 800 W, which is just the amp's own limit."],
              ["3. Check it", "Play a sine at the frequency where excursion peaks (the planner's port-velocity row, just above tuning), raise it until the limit indicator lights, and measure AC volts at the speaker terminals. Compare with \u221a(W \u00d7 8)."],
              ["4. Steeper or in volts", "Do it in the PA2 ahead of the amps and keep the GXD limiter as a backstop. Not yet checked against the PA2 manual."],
              ["Horns", "A GXD4 puts 400 W on a 35 W AES driver like the DE360. Its limiter, set to the driver's rating, is the protection; set the planner's HF amp slider to the same power so its numbers match."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">
            Xmax is where distortion climbs, not where damage starts; the mechanical limit is usually 2–3× further, so 1.2–1.4× the Xmax voltage is a common setting once you've listened.
            Sources: <a className="underline" href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_usermanual.pdf">GXD user manual</a>, <a className="underline" href="https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_specsheet.pdf">GXD spec sheet</a>.
          </p>
        </section>

        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Crossover / DSP: PA2 and alternatives</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">What the planner's protection needs per output: 48 dB/oct highpass, a peak limiter set in volts or dBu with attack and release, a slower RMS limiter, PEQ and delay. At ~15 ft from the mixer keep the inputs balanced; outputs to amps in the same rack matter less.</p>
          <div className="overflow-x-auto"><table className="text-sm w-full min-w-[720px] border-collapse">
            <thead><tr className="text-stone-500 text-left border-b border-stone-300">
              {["Unit", "I/O", "Slopes", "Limiter", "PEQ / out", "Price (US)", "Notes"].map((h) => <th key={h} className="py-1 pr-4 font-normal">{h}</th>)}
            </tr></thead>
            <tbody>
              {[
              ["dbx DriveRack 260", "2×6 XLR", "LR to 48 (BW to 24)", "dBu threshold; attack, hold, release", "4", "$995 new, ~$390 used", "Best value: limits set straight from the amp's gain. Only 4 PEQ bands per output."],
              ["dbx DriveRack VENU360", "3×6 XLR", "BW / LR to 48", "Attack, hold, release; threshold vs full scale", "8", "$1,149 new, ~$750 used", "Best overall: independent outputs, up to 1 s delay, app control."],
              ["Behringer DCX2496", "3×6 XLR (+AES)", "BW / LR to 48", "Per output, release only; units unclear", "Shared pool", "~$339", "Budget pick. Steep slopes use up EQ filters. PC control over RS-232/485."],
              ["Behringer DCX2496LE", "2×6 XLR", "BW / LR to 48", "Same as DCX2496", "Shared pool", "~$289", "Same DSP, but no third input, no digital I/O and no PC port: front panel only."],
              ["Ashly AQM408", "4×8 XLR", "BW / LR / Bessel to 48; FIR (512 taps)", "Brick-wall, peak detect, −20 to +20 dBu, attack & release; plus compressor (peak or average) for an RMS stage", "PEQ blocks (count unconfirmed)", "$999 new (Sweetwater, Full Compass, B&H), ~$800 used", "Current. Meets every requirement; 2 spare outputs. Control is browser-only over Ethernet (no front-panel editing), so bring a phone or tablet on the rack's network."],
              ["t.racks DSP 408", "4×8 XLR", "up to 48 (unconfirmed)", "Attack, release; units unclear", "9", "$439", "Thomann only in the US."],
              ["dbx DriveRack PA2 (current)", "2×6 XLR", "BW / LR to 48", "No attack or release; up to 3 dB overshoot", "8, linked L/R", "~$599, ~$366 used", "Left and right share EQ and delay per band; 10 ms output delay."],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-stone-200 align-top">
                  {r.map((c, i) => <td key={i} className={`py-1.5 pr-4 ${i === 0 ? "font-medium whitespace-nowrap" : ""}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-xs text-stone-500 mt-2 max-w-3xl">Ruled out: Dayton DSP-408 (RCA only, no limiter, 24 dB/oct max); miniDSP (only balanced 8-out model is end of life; Flex is 2×4); Xilica XP, Ashly Protea, BSS FDS-366T (discontinued, used only); Symetrix (over budget). Specs from manufacturer manuals; some prices from search snippets, Sep 2026. Pick: a used DriveRack 260 on a budget; new, the Ashly AQM408 (limiters in dBu with attack and release, 4×8) or the VENU360 (front panel plus app). Keep the GXD limiters as a backstop either way.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Home inputs: Gemini MXR-01BT</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">Turntable, line and phone into the same DSP and amps, with one master volume. A 2-channel DJ mixer does it all in one box.</p>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["What it has", "2 channels, each switchable phono or line, 3-band EQ, Bluetooth input, 1/4″ mic, headphones, all-metal chassis."],
              ["Outputs", "Balanced 1/4″ TRS master (to the DSP), RCA master, and an RCA booth out with its own level."],
              ["Hook-up", "Master TRS → TRS-to-XLR-male cables → DSP inputs. Turntable ground wire to the mixer's ground post."],
              ["Volume", "Use the mixer master. Set DSP input and amp gains so the master at full is the loudest you'll want; the DSP and amp limiters stay as a backstop."],
              ["Booth out", "Spare RCA with its own level: could feed a fill or booth monitor through the DSP."],
              ["Turn-on", "Mixer and sources first, amps last; amps off first."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">Source: <a className="underline" href="https://www.geminisound.com/products/mxr-01bt">Gemini MXR-01BT</a>. Alternative without a mixer: a hi-fi preamp with phono, RCA out through an ART CleanBox Pro to balanced.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Passive crossover: calibrate and build</h2>
          <p className="text-sm text-stone-700 mb-3 max-w-3xl">For fills without a maker's network (FaitalPRO, Ciare, B&C 8″). A 2nd-order 2-way is 6–8 parts: woofer coil + cap, HF cap + coil, two pad resistors. About $40–80 per box in parts. All values get tuned, not just the pad.</p>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["1. Gear (~$150, once)", "UMIK-1 mic, REW (free) to measure, VituixCAD (free) to design, and an impedance jig (Dayton DATS V3, or a resistor + soundcard in REW)."],
              ["2. Measure in the finished box", "Woofer and HF separately, no crossover: response at 1 m on axis (outdoors or gated), impedance, and a near-field of woofer + port. Don't move the mic between drivers, so the phase stays valid. Optional: 15/30/45° off axis."],
              ["3. Design", "Import into VituixCAD, start from the textbook network, tune values for a flat sum with no dip at the crossover. Round to real part values; keep the minimum impedance at about 5 Ω or above."],
              ["4. Prototype on DSP (optional)", "Copy the target curves into the PA2 or GXD, listen and measure, then match the passive design to what you liked."],
              ["5. Test build", "Clip leads or a loose board outside the box. Measure the whole speaker against the simulation; swap pad resistors to set the HF level (buy a few spare values). Listen at gig level."],
              ["6. Final build", "Stripboard is fine for the HF side; run the woofer path (~6 A at 300 W) in 14–16 AWG wire, not the strips, or wire point to point on a ply board. Space the coils or turn them 90° apart, away from the woofer magnet. Mount on foam, re-measure installed, copy for the other boxes and spot-check each."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500 mt-3 max-w-3xl">Roughly a weekend to measure and design, plus an evening to build and verify.</p>
        </section>

        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Materials</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Prototype in particleboard", "Cheap and flat. Build it to verify duct tuning, then transfer interior dimensions \u2014 not the cut list \u2014 to the real material."],
              ["Consider 5/8\" or 1/2\" for the final boxes", "Sub column drops 119 \u2192 107 \u2192 95 lb loaded. Needs more bracing, and the extra interior volume lowers Fb, so the duct gets shorter."],
              ["MDO for the baffles", "Paints far better than birch, no edge penalty since no baffle edge is exposed."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Still to decide</h2>
          <ul className="text-sm text-stone-700 space-y-2 max-w-3xl">
            {[
              ["Baffle mounting", "Cleats (forgiving, costs 3/4\" of interior on each side) or a stopped rabbet in the frame panels (tighter, squares the box, needs a dado). Baffle size changes with the choice."],
              ["Bracing", "Not drawn. Volume and weight allow for two braces. Centre ribs, slat ladder or windowed shelves — decide once handle recesses are placed, since they compete for the same panel area."],
              ["Handles", "Recess type, depth and position on the sub. Interacts with bracing."],
              ["Driver margins", "Currently equal at top and sides. One recommendation is to offset deliberately so baffle modes and diffraction paths don't coincide — likely inaudible below 100 Hz, so mostly a visual decision."],
              ["Port edge finish", "The letterbox mouths are cut in the shell's nose band, so this is a shell-material question, not a baffle one. Paint carried into the ducts, or masked so the ply edge shows — end grain in the mouth needs sealing either way."],
              ["Duct tuning", "Verify Fb by impedance sweep on the particleboard prototype and trim the duct before cutting birch. End correction is the largest source of error in the modelled Fb."],
              ["Sensitivity", "SB's 99 dB claim is 3 dB above what their own published T/S parameters give (95.9 dB/2.83V). Everything about levels and limiter settings depends on which is right. Measure it, or assume the lower figure."],
              ["Driver clearance", "Check the Nero's frame and 8.4\" mounting depth against the baffle margin and anything that ends up behind the magnet."],
              ["Compression driver", "DE360 at $117 is the default; crossover floor on the A400G2 needs a distortion sweep to confirm ~1.1 kHz."],
              ["Horn print", "A400G2 in one piece needs a 400 mm+ bed; otherwise sectioned. Filament, print service, or buy the RX-28 instead."],
              ["Prototype material", "3/4\" particleboard for the first sub, then transfer verified interior dimensions to birch."],
              ["Final panel thickness", "3/4\" or braced 1/2\" birch (switch it under Plywood in the planner). 1/2\" needs bracing on roughly 12\" centres and a doubler at the driver cutout. Decide before the prototype, since wall thickness changes the interior volume and therefore the duct length."],
              ["Baffle material", "MDO if the baffles are painted — no baffle edge is exposed in any of the current configurations, so there is no reason not to. Birch only if the baffle is ever meant to be clear-finished."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                <span><span className="font-medium">{t}.</span> {d}</span>
              </li>
            ))}
          </ul>
        </section>

    </main>
  );
}

// ---------------------------------------------------------------
// Fills / booth monitors: 8-10" passive coaxials
// ---------------------------------------------------------------
// ts: woofer T/S (the model uses Fs, Qms, Re, Bl, Mms, Sd, Xmax; Vas is shown only).
// hf: compression section, sens 1 W/1 m, aes W, xo recommended minimum Hz, imp Ω, cov degrees.
const FILL_OPTIONS = [
  { id: "bc8cxn51", size: 8, lb: 5.5, name: "B&C 8CXN51", price: null, src: "usspeaker.com (no price shown)",
    ts: { Fs: 68, Qes: 0.29, Qms: 4.7, Vas: 17, Sd: 220, Xmax: 6, Re: 4.9, Bl: 12.6, Mms: 22, aes: 250, disp: null },
    hf: { sens: 104, aes: 50, xo: 1800, imp: 8, cov: 100 }, lfSens: 97, note: "Neo. 250 W / 500 W program LF. No matching B&C network sold for the 8″ (DIY or DSP)." },
  { id: "bc8fcx51", size: 8, lb: 11.2, name: "B&C 8FCX51", price: null, src: "usspeaker.com (no price shown)",
    ts: { Fs: 69, Qes: 0.36, Qms: 6.3, Vas: 16, Sd: 220, Xmax: 6.5, Re: 4.9, Bl: 11.5, Mms: 22, aes: 250, disp: null },
    hf: { sens: 104, aes: 50, xo: 1800, imp: 8, cov: 100 }, lfSens: 96, note: "Ferrite. No matching B&C network sold for the 8″ (DIY or DSP)." },
  { id: "by8cx300fe", size: 8, lb: 10.1, name: "Beyma 8CX300Fe", price: 288.5, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 89, Qes: 0.63, Qms: 4.2, Vas: 10.8, Sd: 220, Xmax: 6, Re: 5.2, Bl: 9.6, Mms: 20, aes: 300, disp: null },
    hf: { sens: 105, aes: 50, xo: 1800, imp: 16, cov: 70 }, lfSens: 95, note: "Ferrite. High Qts (0.55): wants a small sealed box. No matching Beyma network sold (FD2CXFE is listed for the 10″ only)." },
  { id: "by8cx300nd", size: 8, lb: 6.1, name: "Beyma 8CX300NdN", price: 428.75, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 61, Qes: 0.28, Qms: 13.3, Vas: 36.2, Sd: 220, Xmax: 6, Re: 5.1, Bl: 9.4, Mms: 12.7, aes: 250, disp: 1.5 },
    hf: { sens: 104, aes: 50, xo: 1500, imp: 8, cov: 70 }, lfSens: 96, note: "Neo, 1.5 L displacement. Mms not published; 12.7 g derived (Vas and Qes agree). Beyma FD2CX network ($198.95/pair, 2.6 kHz, 500 W AES)." },
  { id: "f8hx200", size: 8, lb: 6, name: "FaitalPRO 8HX200", price: 455.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 76, Qes: 0.43, Qms: 9.5, Vas: 11.9, Sd: 205, Xmax: 4.92, Re: 5.5, Bl: 11.6, Mms: 22, aes: 250, disp: null },
    hf: { sens: 104, aes: 15, xo: 1700, imp: 8, cov: 90 }, lfSens: 94, note: "Neo, dome HF (15 W AES). No FaitalPRO network sold in the US (DIY or DSP)." },
  { id: "f8hx230", size: 8, lb: 10.4, name: "FaitalPRO 8HX230", price: 399.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 70, Qes: 0.38, Qms: 7.4, Vas: 8, Sd: 205, Xmax: 6.17, Re: 6.5, Bl: 15.1, Mms: 23.6, aes: 250, disp: null },
    hf: { sens: 105, aes: 30, xo: 1700, imp: 8, cov: 100 }, lfSens: 94, note: "Ferrite, annular HF. Published Vas doesn't fit its Mms/Sd (not used by the model). No FaitalPRO network sold in the US (DIY or DSP)." },
  { id: "f8hx240", size: 8, lb: 8.6, name: "FaitalPRO 8HX240", price: 469.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 70, Qes: 0.31, Qms: 8.1, Vas: 12.9, Sd: 205, Xmax: 6.17, Re: 5, Bl: 13.8, Mms: 27.7, aes: 250, disp: null },
    hf: { sens: 107, aes: 30, xo: 1700, imp: 8, cov: 100 }, lfSens: 94, note: "Neo, annular HF. No FaitalPRO network sold in the US (DIY or DSP)." },
  { id: "embeta8cx", size: 8, lb: 6.8, name: "Eminence Beta 8CX", price: 129.99, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 54, Qes: 0.31, Qms: 7.67, Vas: 34.9, Sd: 205.9, Xmax: 3.2, Re: 5.53, Bl: 11.21, Mms: 19, aes: 250, disp: null },
    hf: null, lfSens: 92, note: "Budget coax; HF section specs not listed on usspeaker, so only the woofer is modelled. Short 3.2 mm Xmax. Eminence PXB2:2K5CX network ($64.99, 250 W, switchable −3 dB HF)." },
  { id: "bc10cxn64", size: 10, lb: 7.1, name: "B&C 10CXN64", price: 476.22, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 68, Qes: 0.33, Qms: 5.6, Vas: 23, Sd: 320, Xmax: 5.5, Re: 5.6, Bl: 15.8, Mms: 33.5, aes: 250, disp: null },
    hf: { sens: 103, aes: 80, xo: 1200, imp: 8, cov: 70 }, lfSens: 97, note: "Neo, 1.4 in HF exit. B&C sell a matching passive network, FB10CX64 ($176.52, 2.1 kHz, 18 dB/oct)." },
  { id: "bc10fcx64", size: 10, lb: 12.8, name: "B&C 10FCX64", price: 419.88, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 63, Qes: 0.44, Qms: 7.9, Vas: 25, Sd: 320, Xmax: 5.5, Re: 5.5, Bl: 13.4, Mms: 37, aes: 250, disp: null },
    hf: { sens: 104, aes: 80, xo: 1200, imp: 8, cov: 70 }, lfSens: 95, note: "Ferrite, 1.3 in HF exit, titanium diaphragm. Same B&C FB10CX64 network ($176.52, 2.1 kHz, 18 dB/oct)." },
  { id: "by10cx300fe", size: 10, lb: 11.2, name: "Beyma 10CX300Fe", price: 378.5, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 48, Qes: 0.41, Qms: 5.3, Vas: 62.7, Sd: 380, Xmax: 6.75, Re: 5.2, Bl: 11.65, Mms: 35, aes: 300, disp: null },
    hf: { sens: 104, aes: 50, xo: 2000, imp: 16, cov: 70 }, lfSens: 96.5, note: "Ferrite; lowest Fs of the 10s. HF 16 Ω, rated 50 W AES at 2 kHz. Beyma FD2CXFE network ($146.50/pair, 3.8 kHz, 400 W AES, for the 16 Ω HF)." },
  { id: "cindcx10", size: 10, lb: 9.2, name: "Ciare NDCX10-1.4", price: 399.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 79.5, Qes: 0.32, Qms: 10.25, Vas: 14.79, Sd: 355, Xmax: 6, Re: 5.59, Bl: 16.37, Mms: 31.08, aes: 350, disp: null },
    hf: { sens: 109, aes: 110, xo: null, imp: 8, cov: null }, lfSens: 97, note: "Neo, 1.4 in throat, 110 W AES HF (the strongest HF here). Published Vas doesn't fit Mms/Sd (not used by the model). Coverage and crossover not listed. No Ciare network sold in the US (DIY or DSP)." },
  { id: "f10hx230", size: 10, lb: 11, name: "FaitalPRO 10HX230", price: 468.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 65, Qes: 0.37, Qms: 5.8, Vas: 25.8, Sd: 321, Xmax: 7.37, Re: 5.3, Bl: 14.1, Mms: 34, aes: 250, disp: null },
    hf: { sens: 107, aes: 30, xo: 1700, imp: 8, cov: 110 }, lfSens: 96, note: "Ferrite, annular HF, widest coverage (110°). No FaitalPRO network sold in the US (DIY or DSP)." },
  { id: "f10hx240", size: 10, lb: 9, name: "FaitalPRO 10HX240", price: 539.95, src: "usspeaker.com, Sep 2026",
    ts: { Fs: 65, Qes: 0.37, Qms: 5.8, Vas: 25.8, Sd: 321, Xmax: 7.37, Re: 5.3, Bl: 14.1, Mms: 34, aes: 250, disp: null },
    hf: { sens: 107, aes: 30, xo: 1700, imp: 8, cov: 110 }, lfSens: 96, note: "Neo version of the 10HX230. No FaitalPRO network sold in the US (DIY or DSP)." },
  { id: "embeta10cx", size: 10, lb: 7.3, name: "Eminence Beta 10CX", price: null, src: "usspeaker.com (no price shown)",
    ts: { Fs: 49, Qes: 0.43, Qms: 5.21, Vas: 64.2, Sd: 344.9, Xmax: 5, Re: 5.53, Bl: 10.88, Mms: 29, aes: 250, disp: null },
    hf: null, lfSens: 93.3, note: "Budget coax; HF section specs not listed, so only the woofer is modelled. Eminence PXB2:2K5CX network ($64.99, 250 W, switchable −3 dB HF)." },
].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

function FillsPage() {
  const [drv, setDrv] = useState(FILL_OPTIONS.find((o) => o.id === "bc10cxn64"));
  const [boxType, setBoxType] = useState("vented");
  const [dim, setDim] = useState({ w: 11.5, h: 16, d: 11 });
  const [port, setPort] = useState({ n: 1, dia: 3, len: 4 });
  const [hp, setHp] = useState(70);          // highpass to the subs, LR24
  const [ampW, setAmpW] = useState(300);     // per box, rated into 8 Ω
  const [portMax, setPortMax] = useState(20);
  const setD = (k, v) => setDim((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPort((p) => ({ ...p, [k]: v }));
  const ts = drv.ts, V = Math.sqrt(ampW * 8);
  const gross = inToL(dim.w, dim.h, dim.d);
  const pArea = boxType === "vented" ? port.n * Math.PI * Math.pow(port.dia / 2, 2) : 0;
  const pVol = (pArea * port.len * 16.387) / 1000;
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const net = Math.max(3, gross - disp - (boxType === "vented" ? pVol : 0));
  const eff = boxType === "sealed" ? net * 1.15 : net;   // sealed boxes are stuffed
  const vTherm = Math.sqrt(2 * ts.aes * 8);
  const vM = boxType === "vented" ? boxModel(ts, eff, pArea, port.len, hp, V, "LR24") : null;
  const sM = boxType === "sealed" ? closedBox(ts, eff, hp, null, V) : null;
  const curve = vM ? vM.curve : sM.curve;
  const maxC = curve.map((o) => {
    const lims = [(V * ts.Xmax) / o.xmm, vTherm, V];
    if (vM) lims.push((V * portMax) / o.vel);
    const L = Math.min(...lims);
    return { f: o.f, spl: o.spl + 20 * Math.log10(L / V), who: L === lims[0] ? "Xmax" : L === vTherm ? "thermal" : L === V ? "amp" : "port" };
  }).filter((o) => o.f <= 300);
  const near = (f) => maxC.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  const ref = vM ? vM.ref : sM.ref;
  const sens = ref - 20 * Math.log10(V / 2.83);
  const f3 = vM ? vM.f3 : sM.f3;
  // HF through a passive network: padded down to the woofer's level, so it only reaches its
  // program rating (2 x AES) at an amp power well above what the woofer sees.
  const hf = drv.hf;
  const pad = hf ? Math.max(0, hf.sens - (drv.lfSens || sens)) : 0;
  const hfLimW = hf ? (2 * hf.aes * hf.imp / 8) * Math.pow(10, pad / 10) : null;   // amp watts (8 Ω rating) at the HF limit
  const lb = ((2 * (dim.w * dim.h + dim.w * dim.d + dim.h * dim.d)) / 144) * 1.6 + drv.lb + 1;   // 1/2" birch ply ~1.6 lb/ft²
  const kick = near(60).spl, mid = near(150).spl;
  const tile = (k, v, u) => (
    <div key={k} className="bg-stone-50 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
      <div className="text-xl font-medium tabular-nums mt-0.5">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
    </div>
  );
  const F = [];
  if (Math.min(dim.w, dim.h) < drv.size + 1)
    F.push(["bad", "Driver won't fit", `An ${drv.size}″ coax needs about ${drv.size + 1}″ of baffle.`]);
  if (vM) {
    const pv = Math.max(...maxC.map((o) => o.who === "port" ? portMax : 0));
    F.push(vM.Fb < hp * 0.6 ? ["warn", `Tuned low (${vM.Fb.toFixed(0)} Hz)`, "Well below the highpass: the port does little. A shorter or wider port tunes higher."]
      : ["ok", `Tuned to ${vM.Fb.toFixed(0)} Hz`, `with a ${hp} Hz LR24 highpass to the subs.`]);
    if (pv) F.push(["warn", "Port-limited", `Port air speed reaches ${portMax} m/s somewhere below 300 Hz; a wider port helps.`]);
  } else {
    F.push(sM.Qtc > 0.8 ? ["warn", `Qtc ${sM.Qtc.toFixed(2)}`, "Peaky; a bigger box or a vent."] : sM.Qtc < 0.5 ? ["warn", `Qtc ${sM.Qtc.toFixed(2)}`, "Very damped: rolls off early. Good driver for a vented box."] : ["ok", `Qtc ${sM.Qtc.toFixed(2)}`, "Well damped."]);
  }
  F.push(f3 <= 85 ? ["ok", "Some kick", `${f3.toFixed(0)} Hz −3 dB with the highpass; the kick fundamental (50–70 Hz) is partly there and the subs fill the rest.`]
    : ["warn", "Little kick", `${f3.toFixed(0)} Hz −3 dB; the kick's attack comes through but its body is all subs.`]);
  if (hf) F.push(hfLimW < ampW
    ? ["warn", "HF limits first", `Through a ${pad.toFixed(0)} dB pad the HF reaches its ${2 * hf.aes} W program rating at about ${Math.round(hfLimW)} W of amp, under the ${ampW} W you've set.`]
    : ["ok", "HF has headroom", `Through a ${pad.toFixed(0)} dB pad the HF only reaches its program rating at about ${Math.round(hfLimW)} W of amp.`]);
  else F.push(["warn", "HF not modelled", "The HF section's specs aren't published on usspeaker."]);
  return (
    <main className="max-w-6xl mx-auto px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="md:col-span-3 flex flex-col gap-4">
        <p className="text-sm text-stone-600">Passive 8–10″ coaxial fills or booth monitors, highpassed to the subs. One amp channel each (or a pair in parallel).</p>
        <div className="grid gap-px rounded-lg overflow-hidden border border-stone-300 bg-stone-200" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
          {tile("Net volume", net.toFixed(0), "L")}
          {vM ? tile("Tuning Fb", vM.Fb.toFixed(0), "Hz") : tile("Qtc", sM.Qtc.toFixed(2), "")}
          {tile("F3", f3.toFixed(0), "Hz")}
          {tile("Max @ 60 Hz", kick.toFixed(1), "dB")}
          {tile("Max @ 150 Hz", mid.toFixed(1), "dB")}
          {tile("Weight", lb.toFixed(0), "lb")}
        </div>
        <ResponseChart fmax={300} series={[{ curve: maxC, label: drv.name, stroke: "#0f766e", tint: "rgba(15,118,110,0.07)" }]} marks={[{ f: hp, label: "HP" }, ...(vM ? [{ f: vM.Fb, label: "Fb" }] : [])]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
          {[
            ["Woofer sensitivity", `${sens.toFixed(1)} dB`, "2.83 V, half space, 1 m, modelled"],
            ["HF sensitivity", hf ? `${hf.sens} dB` : "—", hf ? `pad about ${pad.toFixed(0)} dB to match` : "not published"],
            ["HF coverage", hf && hf.cov ? `${hf.cov}° conical` : "—"],
            ["HF crossover", hf && hf.xo ? `${hf.xo} Hz or higher` : "—", "recommended minimum"],
            ["Max SPL at 100 Hz", `${near(100).spl.toFixed(1)} dB`, `sine, ${near(100).who}-limited`],
            ["Price", drv.price ? `$${drv.price}` : "—", drv.src],
          ].map(([k, v, n]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
              <span className="text-stone-500 shrink-0">{k}</span>
              <span className="text-right"><span className="font-medium tabular-nums">{v}</span>{n ? <span className="block text-xs text-stone-500">{n}</span> : null}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {F.map(([kind, head, body]) => (
            <div key={head} className="flex gap-2 items-start text-xs px-3 py-2 rounded border border-stone-300 bg-stone-50">
              <b className={`shrink-0 font-semibold ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
              <span className="text-stone-600">{body}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500"><span className="font-medium text-stone-600">{drv.name}.</span> {drv.note} Specs from usspeaker.com, Sep 2026. Box weight assumes 1/2″ birch. Displacement {ts.disp != null ? "as published" : `not published; ${disp} L assumed`}.</p>
      </div>
      <aside className="md:col-span-2">
        <Pick label="Coaxial driver" options={FILL_OPTIONS} value={drv} onChange={setDrv} />
        <div className="text-sm text-stone-500 mb-1">Box</div>
        <div className="flex gap-1 mb-2">
          {[["Vented", "vented"], ["Sealed", "sealed"]].map(([l, v]) => (
            <button key={v} onClick={() => setBoxType(v)} className={`px-3 py-1.5 rounded border text-sm ${boxType === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{l}</button>
          ))}
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
          <Slider label="Width" value={dim.w} min={9} max={20} step={0.5} unit="&#8243;" onChange={(v) => setD("w", v)} />
          <Slider label="Height" value={dim.h} min={9} max={28} step={0.5} unit="&#8243;" onChange={(v) => setD("h", v)} />
          <Slider label="Depth" value={dim.d} min={7} max={20} step={0.5} unit="&#8243;" onChange={(v) => setD("d", v)} />
          {boxType === "vented" && (<>
            <Slider label="Ports" value={port.n} min={1} max={3} step={1} unit="" onChange={(v) => setP("n", v)} />
            <Slider label="Port diameter" value={port.dia} min={1.5} max={5} step={0.25} unit="&#8243;" onChange={(v) => setP("dia", v)} />
            <Slider label="Port length" value={port.len} min={1} max={14} step={0.25} unit="&#8243;" onChange={(v) => setP("len", v)} />
            <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
          </>)}
          <div className="text-xs text-stone-500">{gross.toFixed(0)} L gross{boxType === "sealed" ? ", stuffed" : `, ${pArea.toFixed(1)} in² of port`}.</div>
        </div>
        <div className="rounded border border-stone-300 bg-white px-3 py-3">
          <Slider label="Highpass to the subs (LR24)" value={hp} min={50} max={160} step={5} unit=" Hz" onChange={setHp} />
          <Slider label="Amp power per box @ 8 Ω" value={ampW} min={25} max={800} step={25} unit=" W" onChange={setAmpW} />
          <div className="text-xs text-stone-500">A freed GXD4 channel with two 8 Ω fills in parallel gives about 300 W each.</div>
        </div>
      </aside>
    </main>
  );
}

function StackPlanner() {
  const viewOf = () => (window.location.hash === "#notes" ? "notes" : window.location.hash === "#fills" ? "fills" : "planner");
  const [view, setView] = useState(viewOf);
  useEffect(() => {
    const on = () => setView(viewOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [sub, setSub] = useState(SUB_OPTIONS.find((o) => o.id === "sbnero18"));
  const [mid, setMid] = useState(MID_OPTIONS.find((o) => o.id === "sbnero12"));
  const [horn, setHorn] = useState(HORN_OPTIONS.find((h) => h.id === "a400g2"));
  const [cd, setCd] = useState(CD_OPTIONS.find((c) => c.id === "de360"));
  const [midBox, setMidBox] = useState(MID_BOXES.find((o) => o.id === "b15"));   // last preset loaded
  const [mDim, setMDim] = useState({ ...MID_BOXES.find((o) => o.id === "b15").box });
  const [xoLo, setXoLo] = useState(120);         // sub -> mid crossover, LR24
  const [xoHi, setXoHi] = useState(900);         // mid -> horn crossover, LR24
  const [mAmpW, setMAmpW] = useState(400);       // amp power per mid channel, into 8 Ω
  const [tilt, setTilt] = useState(6);           // how much less the mid band needs than the sub band, dB
  const [hfAmpW, setHfAmpW] = useState(100);     // amp power per HF channel, rated into 8 Ω
  const [hfTilt, setHfTilt] = useState(6);       // how much less the horn band needs than the mid band, dB
  const setM = (k, v) => setMDim((p) => ({ ...p, [k]: v }));
  const plinth = 3; // fixed, matches the duct height
  const [cutaway, setCutaway] = useState(false);
  const [cabinet, setCabinet] = useState(CABINETS[0]);
  const [portStyle, setPortStyle] = useState("slots");
  const [layout, setLayout] = useState("stack");
  const format = FORMATS[0];   // 18″ sub + compression driver; mid is 12″ or 15″
  const [midSize, setMidSize] = useState(12);
  const [wall, setWall] = useState(0.75);   // side/top/bottom/back ply, in
  const [inset, setInset] = useState(0.75); // how far the baffles sit back from the frame front, in
  const [baffleColor, setBaffleColor] = useState("#e8b4a8");
  const [cabFinish, setCabFinish] = useState("birch");
  const [spacerH, setSpacerH] = useState(20);
  const [showDetails, setShowDetails] = useState(false);   // "tops on spacers": spacer height, in   // "birch", "walnut" or a paint hex
  // Every cabinet is custom; the preset list below is only a starting point.
  const [cDim, setCDim] = useState({ w: 28, h: 32, d: 24 });
  const [cVent, setCVent] = useState({ slotH: 3, nt: 2, dia: 6, throat: 3, len: 14 });
  const [hpf, setHpf] = useState(33);
  const [hpType, setHpType] = useState("BW24");   // sub highpass alignment
  const [ampW, setAmpW] = useState(800);   // amp power per sub channel, into 8 Ω
  const [portMax, setPortMax] = useState(20);   // peak port air speed allowed, m/s
  const setC = (k, v) => setCDim((p) => ({ ...p, [k]: v }));
  const setV = (k, v) => setCVent((p) => ({ ...p, [k]: v }));

  // ---- saved configurations, backed by the artifact's document store ----
  const [db, setDb] = useState(null);
  const [saved, setSaved] = useState(null);     // null = still loading
  const [cfgName, setCfgName] = useState("");
  const [cfgMsg, setCfgMsg] = useState("");
  const [selCfg, setSelCfg] = useState("");
  // Firebase (github.io build): signed-in users keep configs under users/{uid}/.
  const [fbUser, setFbUser] = useState(null);
  const fb = !(window.claude && window.claude.use) && window.firebase && window.PLANNER_FIREBASE ? window.firebase : null;
  useEffect(() => {
    let live = true;
    if (fb) {
      if (!fb.apps.length) fb.initializeApp(window.PLANNER_FIREBASE);
      const un = fb.auth().onAuthStateChanged((u) => {
        if (!live) return;
        setFbUser(u);
        if (u) {
          const fs = fb.firestore();
          setDb({ collection: (name) => fs.collection(`users/${u.uid}/${name}`) });
        } else { setDb(null); setSaved([]); }
      });
      return () => { live = false; un(); };
    }
    (async () => {
      try {
        const d = window.claude && window.claude.use ? await window.claude.use("db") : null;
        if (live) { setDb(d); if (!d) setSaved([]); }
      } catch { if (live) { setDb(null); setSaved([]); } }
    })();
    return () => { live = false; };
  }, []);
  const signIn = () => fb.auth().signInWithPopup(new fb.auth.GoogleAuthProvider()).catch(() => { setCfgMsg("Sign-in failed"); setTimeout(() => setCfgMsg(""), 2500); });
  const signOut = () => fb.auth().signOut();
  // One-time copy of the configs saved in the claude.ai artifact (data/configs-seed.json).
  const importSeed = async () => {
    if (!db) return;
    setCfgMsg("Importing…");
    try {
      const rows = await (await fetch("configs-seed.json")).json();
      const have = new Set((saved || []).map((c) => c.name));
      let n = 0;
      for (const { id, ...c } of rows) {
        if (have.has(c.name)) continue;
        await db.collection("configs").doc(id).set(c); n++;
      }
      setCfgMsg(n ? `Imported ${n}` : "Nothing new to import");
    } catch { setCfgMsg("Couldn't import"); }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  useEffect(() => {
    if (!db) return;
    const un = db.collection("configs").orderBy("savedAt", "desc").limit(50).onSnapshot(
      (snap) => setSaved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setSaved([])
    );
    return un;
  }, [db]);
  // In the tower layout the mid chamber is the sub's footprint, 15.5 in tall.
  const midDims = layout === "tower" ? { w: cDim.w, h: 15.5, d: cDim.d } : mDim;
  const midSel = { ...mid, box: midDims };
  const subList = SUB_OPTIONS.filter((o) => o.size === format.sub);
  const midList = MID_OPTIONS.filter((o) => (o.size || 12) === midSize);
  const boxList = MID_BOXES.filter((b) => (b.size || 12) === midSize && b.id !== "b13");
  const subBox = cDim;
  // Load a published cabinet into the sliders as a starting point.
  const startFrom = (cb) => {
    const d = cb.dims[format.sub];
    setCabinet(cb);
    setCDim({ w: d.w, h: d.h, d: d.d });
    const v = cb.vents[0];
    setPortStyle(v === "round1" || v === "round4" ? "round2" : v);
    if (v === "round1") setCVent((p) => ({ ...p, nt: 1, dia: 8, len: 11 }));
    else if (v === "round4") setCVent((p) => ({ ...p, nt: 4, dia: 4, len: 11.5 }));
    else if (v === "round2") setCVent((p) => ({ ...p, nt: 2, dia: 5, len: 9.8 }));
    else if (v === "folded") setCVent((p) => ({ ...p, slotH: 3, len: 15.75 }));
    else if (v === "vslots" || v === "vwide") setCVent((p) => ({ ...p, throat: 1.4, len: d.d - 3 }));
    else setCVent((p) => ({ ...p, slotH: 3, len: d.d - 4.5 }));
    if (cb.vent) setCVent((p) => ({ ...p, ...cb.vent }));   // published vent overrides the generic one
  };
  const subSel = { ...sub, box: subBox };
  useEffect(() => {
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (subList.length) setSub(pickOf(subList));
    if (midList.length) setMid(pickOf(midList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  // Switching 12/15 picks that size's default driver and box; restoring a config sets them itself.
  const skipSizeReset = useRef(true);
  useEffect(() => {
    if (skipSizeReset.current) { skipSizeReset.current = false; return; }
    const pickOf = (list) => list.find((o) => o.pick) || list[0];
    if (midList.length) setMid(pickOf(midList));
    if (boxList.length) { const b = pickOf(boxList); setMidBox(b); setMDim({ ...b.box }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midSize]);
  const mismatch = horn.exit !== cd.exit;

  // Port geometry, matching what the 3D view draws, so the table and the
  // model describe the same box.
  const PT = wall;
  const port = (() => {
    const iw = subBox.w - 2 * PT, ih = subBox.h - 2 * PT, idp = subBox.d - 2 * PT;
    {
      if (portStyle === "vslots" || portStyle === "vwide" || portStyle === "vslot1") {
        const n = portStyle === "vslot1" ? 1 : 2;
        const t = cVent.throat, area = n * t * (ih - 2 * 0.5), seg = (ih - 2 * 0.5) / 3;   // two 1/2\u2033 dividers per duct
        return { area, len: cVent.len, dh: (4 * (t * seg)) / (2 * (t + seg)),
                 desc: `${n === 1 ? "one side duct" : "two side ducts"}, ${t.toFixed(2)}\u2033 throat \u00d7 ${ih.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long` };
      }
      if (portStyle === "slots" || portStyle === "folded") {
        const h = cVent.slotH, area = h * (iw - 2 * PT), seg = (iw - 2 * PT) / 3;       // two 3/4\u2033 fins
        return { area, len: cVent.len, dh: (4 * (h * seg)) / (2 * (h + seg)),
                 desc: `letterbox, ${h.toFixed(2)}\u2033 \u00d7 ${iw.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long` + (portStyle === "folded" ? ", folded up the back wall" : "") };
      }
      const r = cVent.dia / 2;
      return { area: cVent.nt * Math.PI * r * r, len: cVent.len, dh: cVent.dia,
               desc: `${cVent.nt} \u00d7 ${cVent.dia.toFixed(2)}\u2033 round, ${cVent.len.toFixed(1)}\u2033 long` };
    }
    if (portStyle === "vslots" || portStyle === "vwide") {
      const throat = Math.round(((format.sub >= 18 ? 66 : 54) / (2 * ih)) * 100) / 100;
      const nDiv = 2, tDiv = 0.5;
      const area = 2 * (throat * ih - nDiv * throat * tDiv);
      const len = idp - PT - throat;                 // rear gap equals the throat width
      const seg = (ih - nDiv * tDiv) / (nDiv + 1);
      return { area, len, dh: (4 * (throat * seg)) / (2 * (throat + seg)),
               desc: `two ducts, ${throat.toFixed(2)}″ throat × ${ih.toFixed(1)}″, 20° flare to ${(throat + 0.43).toFixed(2)}″` };
    }
    if (portStyle === "folded") {
      const h = 3, w = iw, area = h * w, seg = w / 3;
      return { area, len: 15.75, dh: (4 * (h * seg)) / (2 * (h + seg)),
               desc: `letterbox, ${h}″ × ${w.toFixed(1)}″, folded up the back wall to 15.75″` };
    }
    if (portStyle === "slots") {
      const h = 3, w = iw, area = h * w, gap = h;
      const len = idp - gap - PT;
      const seg = w / 3;
      return { area, len, dh: (4 * (h * seg)) / (2 * (h + seg)),
               desc: `letterbox, ${h}″ × ${w.toFixed(1)}″, ${gap}″ turning gap` };
    }
    const n = portStyle === "round4" ? 4 : portStyle === "round1" ? 1 : 2;
    const r = portStyle === "round1" ? 4 : portStyle === "round4" ? 2 : 2.5;
    return { area: n * Math.PI * r * r, len: 11, dh: 2 * r,
             desc: `${n} × ${(2 * r).toFixed(0)}″ round, 11″ long` };
  })();

  const grossL = boxL(subBox.w, subBox.h, subBox.d, wall, inset);
  const ductL = (port.area * port.len * 16.387) / 1000;
  const netL = Math.max(20, grossL - (sub.ts ? sub.ts.disp : 10.5) - ductL - 3);
  const HPF = hpf, AMP_V = Math.sqrt(ampW * 8);
  const mdl = sub.ts ? boxModel(sub.ts, netL, port.area, port.len, HPF, AMP_V, hpType) : null;
  const lim = mdl ? (() => {
    // Every limit is expressed as amp output voltage: a sine at the amp's rated power into 8 \u03a9.
    // Port and cone limits use that sine's peaks. The thermal limit is program power, 2 \u00d7 AES: AES
    // noise has a 6 dB crest, so a sine with the same peak voltage carries twice the AES power, and
    // music with at least that crest factor keeps the voice coil's average at or under the AES rating.
    const vp = (AMP_V * portMax) / mdl.peakVel, vx = (AMP_V * 100) / mdl.xmaxPct, vt = Math.sqrt(2 * sub.ts.aes * 8);
    const L = Math.min(vp, vx, vt, AMP_V);
    const sc = 20 * Math.log10(L / AMP_V);
    return { who: L === vp ? "port air speed" : L === vx ? "cone travel (Xmax)" : L === vt ? "driver program rating" : "amplifier power",
             V: L, W: (L * L) / 8, vel: mdl.peakVel * L / AMP_V, xPct: mdl.xmaxPct * L / AMP_V,
             spl30: mdl.spl30 + sc, spl35: mdl.spl35 + sc, spl45: mdl.spl45 + sc };
  })() : null;
  // Max SPL for a sine at each frequency: each frequency meets its own port and excursion
  // limits, so 45 Hz is not held back by port speed at tuning. The broadband limit above is
  // what applies to music, which has energy at every frequency at once.
  const vThermal = Math.sqrt(2 * (sub.ts ? sub.ts.aes : 0) * 8);
  const maxAt = (o) => {
    const vp = (AMP_V * portMax) / o.vel, vx = (AMP_V * sub.ts.Xmax) / o.xmm;
    const V = Math.min(vp, vx, vThermal, AMP_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(V / AMP_V),
             who: V === vp ? "port" : V === vx ? "Xmax" : V === vThermal ? "thermal" : "amp" };
  };
  const maxCurve = mdl ? mdl.curve.map(maxAt) : null;
  const maxNear = (f) => maxCurve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

  // ---- mid-bass: sealed box ----
  const MID_V = Math.sqrt(mAmpW * 8);
  const midGrossL = boxL(midDims.w, midDims.h, midDims.d, wall, inset);
  const midDisp = mid.ts && mid.ts.disp != null ? mid.ts.disp : (mid.size === 15 ? 4 : 2.5);   // assumed where not published
  const midNetL = Math.max(5, midGrossL - midDisp);
  const midEffL = midNetL * 1.15;   // always lightly stuffed: ~15% more effective volume, and it damps box resonances
  const mMdl = mid.ts ? closedBox(mid.ts, midEffL, xoLo, xoHi, MID_V) : null;
  const vMidTherm = mid.ts ? Math.sqrt(2 * mid.ts.aes * 8) : 0;
  const midMaxAt = (o) => {
    const vx = (MID_V * mid.ts.Xmax) / o.xmm, V = Math.min(vx, vMidTherm, MID_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(V / MID_V), who: V === vx ? "Xmax" : V === vMidTherm ? "thermal" : "amp" };
  };
  const midMax = mMdl ? mMdl.curve.map(midMaxAt) : null;
  // 3/4" baffle at 2.3 lb/ft\u00b2, other panels and one brace at the chosen ply, plus 2 lb of hardware
  const midCabLb = ((midDims.w * midDims.h) * 2.3 + (midDims.w * midDims.h + 2 * midDims.w * midDims.d + 2 * midDims.h * midDims.d + midDims.w * midDims.d) * PLY_LB[wall]) / 144 + 2;
  const midLbLoaded = midCabLb + (mid.lb || 0);
  const midUseV = Math.min(vMidTherm, MID_V);   // most the mid is driven: amp or program rating
  const midNear = (f) => midMax.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
  // Sub through its lowpass at the crossover, for the system chart. Its own limits scale with the filter.
  const subSys = mdl ? mdl.curve.map((o) => {
    const g = lr24lp(o.f, xoLo);
    const vp = (AMP_V * portMax) / (o.vel * g), vx = (AMP_V * sub.ts.Xmax) / (o.xmm * g);
    const V = Math.min(vp, vx, vThermal, AMP_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(g) + 20 * Math.log10(V / AMP_V) };
  }) : null;
  const subAtXo = subSys ? subSys.reduce((b, o) => (Math.abs(o.f - xoLo) < Math.abs(b.f - xoLo) ? o : b)).spl : null;
  // What the mid actually has to match: the sub at its music limit (one drive level for
  // the whole band), through its lowpass, less the music-balance allowance.
  // ---- horn + compression driver ----
  // Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24
  // highpass at the crossover and a 12 dB/oct rolloff below the horn's loading limit.
  // Power: amp voltage into the driver's impedance, capped at program (2 x AES), derated
  // 6 dB per octave when crossing below the frequency the AES rating was measured at.
  const hf = cd.hf, hz = horn.hf || {};
  const hornModel = hf && hf.sens != null && hf.aes ? (() => {
    const imp = hf.imp || 8;
    const pAmp = (hfAmpW * 8) / imp;                      // same amp voltage into 8 or 16 Ω
    const derate = hf.aesXo && xoHi < hf.aesXo ? Math.pow(xoHi / hf.aesXo, 2) : 1;
    const pProg = 2 * hf.aes * derate;
    const P = Math.min(pAmp, pProg);
    const low = hz.lowHz || 0;
    const curve = [];
    for (let i = 0; i < 300; i++) {
      const f = 300 * Math.pow(20000 / 300, i / 299);
      const g = lr24hp(f, xoHi) * (low ? Math.min(1, Math.pow(f / low, 2)) : 1);
      curve.push({ f, spl: hf.sens + 10 * Math.log10(P) + 20 * Math.log10(g) });
    }
    return { curve, P, pAmp, pProg, derate, imp, who: P === pAmp ? "amp" : "program rating",
             flat: hf.sens + 10 * Math.log10(P) };
  })() : null;
  const hornAt = (f) => hornModel.curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b)).spl;
  // mid beamwidth at the horn crossover, as a rigid piston: -6 dB where ka sin(theta) = 2.2
  const midBeam = mid.ts ? (() => {
    const ka = (2 * Math.PI * xoHi / 343) * Math.sqrt(mid.ts.Sd / 10000 / Math.PI);
    return ka <= 2.2 ? 180 : 2 * Math.asin(2.2 / ka) * 180 / Math.PI;
  })() : null;
  // Horizontal beamwidth (-6 dB) against frequency. Mid: rigid piston as above. Horn: its rated
  // coverage down to Keele's pattern-control limit f = 25 000 / (mouth width m \u00d7 angle \u00b0),
  // widening in proportion below it. Rules of thumb, not measurements.
  const beamCurves = (() => {
    const hz0 = horn.hf || {};
    const fK = hz0.covH && horn.size ? 25000 / (horn.size.w * 0.0254 * hz0.covH) : null;
    const midB = [], hornB = [];
    for (let i = 0; i < 160; i++) {
      const f = 200 * Math.pow(10000 / 200, i / 159);
      if (mid.ts) { const ka = (2 * Math.PI * f / 343) * Math.sqrt(mid.ts.Sd / 10000 / Math.PI); midB.push({ f, spl: ka <= 2.2 ? 180 : 2 * Math.asin(2.2 / ka) * 180 / Math.PI }); }
      if (fK && f >= (hz0.lowHz || 0) * 0.7) hornB.push({ f, spl: Math.min(180, f >= fK ? hz0.covH : hz0.covH * fK / f) });
    }
    return { midB, hornB, fK };
  })();

  const subMusicAtXo = mdl && lim ? (() => {
    const o = mdl.curve.reduce((b, x) => (Math.abs(x.f - xoLo) < Math.abs(b.f - xoLo) ? x : b));
    return o.spl + 20 * Math.log10(lr24lp(o.f, xoLo)) + 20 * Math.log10(lim.V / AMP_V);
  })() : null;

  const portGeom = { ductH: cVent.slotH, nPorts: cVent.nt, portR: cVent.dia / 2, tubeLen: cVent.len, throat: cVent.throat };

  // One named snapshot of the whole system.
  const snapshot = () => ({
    format: format.id, sub: sub.id, mid: mid.id, midBox: midBox.id, cd: cd.id, horn: horn.id,
    cabinet: cabinet.id, portStyle, cDim, cVent, hpf, hpType, ampW, portMax, mDim, wall, inset, xoLo, xoHi, mAmpW, tilt, hfAmpW, hfTilt,
    layout, cutaway, baffleColor, cabFinish, spacerH,
    summary: `${sub.name} · ${subBox.w}×${subBox.h}×${subBox.d}″ · ${port.area.toFixed(0)} in² · ${mdl ? mdl.Fb.toFixed(1) + " Hz" : "—"}`
  });
  const restore = (c) => {
    const find = (list, id, fb) => list.find((o) => o.id === id) || fb;
    if (c.wall === 0.5 || c.wall === 0.75) setWall(c.wall); else setWall(0.75);
    setInset(typeof c.inset === "number" ? c.inset : 0.75);
    if (c.sub) setSub(find(SUB_OPTIONS, c.sub, sub));
    if (c.mid) { const m = find(MID_OPTIONS, c.mid, mid); skipSizeReset.current = (m.size || 12) !== midSize; setMidSize(m.size || 12); setMid(m); }
    if (c.midBox) setMidBox(find(MID_BOXES, c.midBox, midBox));
    if (c.cd) setCd(find(CD_OPTIONS, c.cd, cd));
    if (c.horn) setHorn(find(HORN_OPTIONS, c.horn, horn));
    if (c.cDim) setCDim(c.cDim);
    if (c.cVent) setCVent(c.cVent);
    if (typeof c.hpf === "number") setHpf(c.hpf);
    if (c.hpType && HP_TYPES[c.hpType]) setHpType(c.hpType);
    if (typeof c.ampW === "number") setAmpW(c.ampW);
    if (typeof c.portMax === "number") setPortMax(c.portMax);
    if (c.mDim) setMDim(c.mDim); else if (c.midBox) { const b = MID_BOXES.find((x) => x.id === c.midBox); if (b) setMDim({ ...b.box }); }
    if (typeof c.xoLo === "number") setXoLo(c.xoLo);
    if (typeof c.xoHi === "number") setXoHi(c.xoHi);
    if (typeof c.mAmpW === "number") setMAmpW(c.mAmpW);
    if (typeof c.tilt === "number") setTilt(c.tilt);
    if (typeof c.hfAmpW === "number") setHfAmpW(c.hfAmpW);
    if (typeof c.hfTilt === "number") setHfTilt(c.hfTilt);
    if (typeof c.cutaway === "boolean") setCutaway(c.cutaway);
    if (c.layout) setLayout(c.layout);
    if (c.baffleColor) setBaffleColor(c.baffleColor);
    setCabFinish(c.cabFinish || "birch");
    setSpacerH(typeof c.spacerH === "number" ? c.spacerH : 20);
    if (c.portStyle) setPortStyle(c.portStyle);
  };
  const saveCfg = async () => {
    const name = cfgName.trim();
    if (!db || !name) return;
    setCfgMsg("Saving…");
    try {
      await db.collection("configs").doc().set({ name, savedAt: Date.now(), ...snapshot() });
      setCfgName(""); setCfgMsg("Saved");
    } catch (e) {
      setCfgMsg(e && (e.code === "invalid_argument" || e.code === "permission-denied") ? "You don't have write access here" : "Couldn't save — try again");
    }
    setTimeout(() => setCfgMsg(""), 2500);
  };
  const delCfg = async (id) => {
    if (!db) return;
    try { await db.collection("configs").doc(id).delete(); }
    catch { setCfgMsg("Couldn't delete"); setTimeout(() => setCfgMsg(""), 2500); }
  };

  const subLbLoaded = ((subBox.w * subBox.h) * 2.3 + (subBox.w * subBox.h + 2 * subBox.w * subBox.d + 2 * subBox.h * subBox.d + 2 * subBox.w * subBox.d) * PLY_LB[wall]) / 144 + (sub.lb || 0) + 6;

  const subL = grossL;
  const midL = midGrossL;
  const subTopH = plinth + subBox.h;
  const isTower = layout === "tower";
  const baseH = layout === "satellite" ? 34 : layout === "pole" ? subTopH + spacerH : isTower ? subTopH : subTopH + 0.4;
  const archT = isTower && !!horn.profile && !horn.scaleX && subBox.w / 2 - 0.75 > horn.size.w / 2;
  const stackH = isTower ? baseH + 15.5 + (archT ? subBox.w - 0.75 : horn.size.h + 2) : baseH + midDims.h + 1.2 + horn.size.h + 2;
  const hornCenter = isTower ? baseH + 15.5 + (archT ? subBox.w / 2 - 0.75 : (horn.size.h + 2) / 2) : baseH + midDims.h + 1.2 + 1 + horn.size.h / 2;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <header className="px-8 pt-6 md:pt-8 pb-4 max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl leading-tight" aria-label="Speaker Planner">𝒮𝓅ℯ𝒶𝓀ℯ𝓇 𝒫𝓁𝒶𝓃𝓃ℯ𝓇</h1>
        <nav className="flex gap-1 mt-3" style={{ fontFamily: "system-ui, sans-serif" }} aria-label="Pages">
          {[["planner", "Planner", "#"], ["fills", "Fills", "#fills"], ["notes", "Notes", "#notes"]].map(([v, label, href]) => (
            <a key={v} href={href} aria-current={view === v ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); try { history.replaceState(null, "", v === "planner" ? " " : href); } catch {} setView(v); window.scrollTo(0, 0); }}
              className={`px-3 py-1.5 rounded border text-sm ${view === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</a>
          ))}
        </nav>
      </header>
      {view === "notes" ? <NotesPage /> : view === "fills" ? <FillsPage /> : <>

      {saved !== null && (
        <section className="max-w-6xl mx-auto px-8 pb-2" style={{ fontFamily: "system-ui, sans-serif" }}>
          <div className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-500 mr-1">Saved configurations</span>
              {db ? (<>
                <input value={cfgName} onChange={(e) => setCfgName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCfg(); }}
                  placeholder="Name this setup" maxLength={60}
                  className="px-3 py-1.5 rounded border border-stone-300 bg-white text-sm w-56 focus:outline-none focus:border-stone-900" />
                <button onClick={saveCfg} disabled={!cfgName.trim()}
                  className="px-3 py-1.5 rounded border text-sm border-stone-900 bg-stone-900 text-stone-50 disabled:opacity-35 disabled:cursor-not-allowed">Save current</button>
                {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
                {fbUser && (<span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
                  <button onClick={importSeed} className="hover:underline">Import saved configs</button>
                  <button onClick={signOut} className="hover:underline">Sign out</button>
                </span>)}
              </>) : fb ? (<>
                <button onClick={signIn}
                  className="px-3 py-1.5 rounded border text-sm border-stone-900 bg-stone-900 text-stone-50">Sign in with Google to save</button>
                {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
              </>) : (
                <span className="text-xs text-stone-500">Saving is unavailable in this view. Everything else works.</span>
              )}
            </div>
            {saved.length > 0 && (() => {
              const cur = saved.find((c) => c.id === selCfg);
              return (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={cur ? cur.id : ""} aria-label="Load a saved configuration"
                    onChange={(e) => { const c = saved.find((x) => x.id === e.target.value); setSelCfg(e.target.value); if (c) restore(c); }}
                    className="px-2 py-1.5 rounded border border-stone-300 bg-white text-sm min-w-0 max-w-full flex-1">
                    <option value="" disabled>Load a saved configuration ({saved.length})…</option>
                    {saved.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.savedAt ? ` · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</option>
                    ))}
                  </select>
                  {cur && <button onClick={() => { delCfg(cur.id); setSelCfg(""); }} aria-label={`Delete ${cur.name}`}
                    className="text-xs text-stone-400 hover:text-red-700 px-1">Delete</button>}
                  {cur && cur.summary && <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      <main className="max-w-6xl mx-auto px-8 pb-16 grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 flex flex-col gap-5">
        <section className="rounded-lg overflow-hidden border border-stone-300 bg-stone-50" style={{ height: "clamp(320px, 56vh, 560px)" }}>
          <StackView sub={subSel} mid={midSel} horn={horn} plinth={plinth} cutaway={cutaway} portStyle={portStyle} layout={layout} baffleColor={baffleColor} portGeom={portGeom} wall={wall} inset={inset} cabFinish={cabFinish} spacerH={spacerH} />
        </section>

        <section className="mt-1" style={{ fontFamily: "system-ui, sans-serif" }}>
          {mdl && lim && (
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200"
                 style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
              {[
                ["Net volume", netL.toFixed(0), "L"],
                ["Tuning Fb", mdl.Fb.toFixed(1), "Hz"],
                ["System F3", mdl.f3.toFixed(0), "Hz"],
                ["Max SPL @ 35 Hz", maxNear(35).spl.toFixed(1), "dB"],
                ["Weight", subLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
          )}
          {mdl && lim && <div className="mb-4"><ResponseChart fmax={20000} series={[{ curve: subSys, label: "Sub", stroke: "#292524", tint: "rgba(41,37,36,0.07)" }, ...(midMax ? [{ curve: midMax, label: "Mid-bass", stroke: "#b45309", tint: "rgba(180,83,9,0.06)" }] : []), ...(hornModel ? [{ curve: hornModel.curve, label: "Horn", stroke: "#0f766e", tint: "rgba(15,118,110,0.06)" }] : [])]} marks={[{ f: mdl.Fb, label: "Fb" }, { f: xoLo, label: "XO" }, { f: xoHi, label: "XO" }]} /></div>}
          {mdl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${grossL.toFixed(0)} L`],
                ["Port area", `${port.area.toFixed(1)} in²`, `${((port.area / (sub.ts.Sd / 6.4516)) * 100).toFixed(0)}% of cone area`],
                ["Hydraulic diameter", `${port.dh.toFixed(2)}″`, port.dh < 2 ? "low — flare the mouths" : "acceptable with flares"],
                ["Midband sensitivity", `${(mdl.ref - 20 * Math.log10(AMP_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[30, 35, 45, 60].map((f) => { const m = maxNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["First limit, music", lim.who, `at ${Math.round(lim.W / 10) * 10} W${lim.who === "cone travel (Xmax)" ? `, reached first at ${mdl.peakXF.toFixed(0)} Hz` : lim.who === "port air speed" ? `, reached first at ${mdl.peakVelF.toFixed(0)} Hz` : ""}; the two rows below are at this power`],
                ["Peak port velocity", `${lim.vel.toFixed(1)} m/s`, `at ${mdl.peakVelF.toFixed(0)} Hz, where port output peaks near Fb`],
                ["Peak excursion", `${(mdl.peakX * lim.V / AMP_V).toFixed(1)} mm`, `${lim.xPct.toFixed(0)}% of Xmax, at ${mdl.peakXF.toFixed(0)} Hz`],
              ].map(([k, v, note]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
                  <span className="text-stone-500 shrink-0">{k}</span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums">{v}</span>
                    {note ? <span className="block text-xs text-stone-500">{note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-600 ">
              {sub.name} can't be modelled yet: its parameters are incomplete. {sub.note}
            </p>
          )}
          {mdl && lim && (
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = [];
                const need = format.sub + 1.9;
                const nSide = portStyle === "vslot1" ? 1 : portStyle === "vslots" || portStyle === "vwide" ? 2 : 0;
                const clearW = subBox.w - nSide * (cVent.throat + 0.43 + PT);
                const clearH = subBox.h - (portStyle === "slots" || portStyle === "folded" ? cVent.slotH + PT : 0);
                if (Math.min(clearW, clearH) < need)
                  F.push(["bad", "Driver won't fit", `The baffle needs about ${need.toFixed(1)}″ clear; after the vents it has ${clearW.toFixed(1)}″ × ${clearH.toFixed(1)}″.`]);
                // longest duct each layout can hold, leaving an opening at least as wide as the duct
                const inD = subBox.d - PT, inH = subBox.h - 2 * PT, sH = cVent.slotH;
                const maxStraight = inD - sH;                                           // bottom slot
                const maxFold = (inD - (sH + PT) + sH / 2) + (inH - sH - 1);            // floor run + rise up the back
                const maxSide = inD - cVent.throat;                                     // side ducts
                const maxTube = subBox.d - 0.75 - 2 * PT - cVent.dia / 2;                // round tubes off the baffle
                const fit = portStyle === "slots" ? maxStraight : portStyle === "folded" ? maxFold
                  : portStyle.startsWith("round") ? maxTube : maxSide;
                if (cVent.len > fit)
                  F.push(["bad", "Duct too long", `${cVent.len.toFixed(1)}″ won't fit; this layout holds about ${fit.toFixed(1)}″.`
                    + (portStyle === "slots" && cVent.len <= maxFold ? " Switch to Bottom, folded." : "")]);
                F.push(subLbLoaded > 125
                  ? ["warn", "Over 125 lb", `${subLbLoaded.toFixed(0)} lb loaded. Past the one-person lift limit.`]
                  : ["ok", "Inside 125 lb", `${subLbLoaded.toFixed(0)} lb loaded.`]);
                F.push(lim.who === "port air speed"
                  ? ["warn", "Port-limited", `The vent chokes at ${Math.round(lim.W)} W, below the driver's ${2 * sub.ts.aes} W program rating. Open the port up or lengthen it.`]
                  : lim.who === "cone travel (Xmax)"
                  ? ["warn", "Excursion-limited", `The cone reaches Xmax at ${Math.round(lim.W)} W (first at ${mdl.peakXF.toFixed(0)} Hz), below the ${2 * sub.ts.aes} W program rating. A bigger box or higher tuning helps; a bigger port does not.`]
                  : lim.who === "amplifier power"
                  ? ["warn", "Amp-limited", `The ${ampW} W amp runs out before the port, the cone or the driver's ${2 * sub.ts.aes} W program rating (2 \u00d7 ${sub.ts.aes} W AES).`]
                  : ["ok", "Thermally limited", `Reaches its ${2 * sub.ts.aes} W program rating (2 \u00d7 ${sub.ts.aes} W AES) before the port or the cone gives out.`]);
                return F.map(([kind, head, body]) => (
                  <div key={head} className="flex gap-2 items-start text-xs px-3 py-2 rounded border border-stone-300 bg-stone-50">
                    <b className={`shrink-0 font-semibold ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
          )}
          <p className="text-xs text-stone-500 mt-3">
            Modelled, not measured. Verify the tuning with an impedance sweep on the prototype before cutting birch.
          </p>
        </section>

        <section className="mt-2" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Mid-bass</h2>
          {mMdl ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200"
                 style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
              {[
                ["Net volume", midNetL.toFixed(0), "L"],
                ["Box resonance Fc", mMdl.Fc.toFixed(0), "Hz"],
                ["Box F3", mMdl.f3.toFixed(0), "Hz"],
                [`Max SPL @ ${xoLo} Hz`, midNear(xoLo).spl.toFixed(1), "dB"],
                ["Weight", midLbLoaded.toFixed(0), "lb"],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
              {[
                ["Gross internal", `${midGrossL.toFixed(0)} L`, `acts like ${midEffL.toFixed(0)} L stuffed`],
                ["Qtc", mMdl.Qtc.toFixed(2), mMdl.Qtc > 0.8 ? "peaky" : mMdl.Qtc < 0.5 ? "very damped" : "well damped"],
                ["Midband sensitivity", `${(mMdl.ref - 20 * Math.log10(MID_V / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
                ...[xoLo, 200, 500].map((f) => { const m = midNear(f);
                  return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
                ["Peak excursion", `${(mMdl.peakX * midUseV / MID_V).toFixed(1)} mm`, `${(mMdl.peakX * midUseV / MID_V / mid.ts.Xmax * 100).toFixed(0)}% of Xmax at ${Math.round(midUseV * midUseV / 8)} W, with the ${xoLo} Hz highpass`],
              ].map(([k, v, note]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-stone-200 py-1">
                  <span className="text-stone-500 shrink-0">{k}</span>
                  <span className="text-right">
                    <span className="font-medium tabular-nums">{v}</span>
                    {note ? <span className="block text-xs text-stone-500">{note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              {(() => {
                const F = [];
                const need = midSize + 1.2;
                if (Math.min(midDims.w, midDims.h) < need)
                  F.push(["bad", "Driver won't fit", `A ${midSize}\u2033 driver needs about ${need.toFixed(1)}\u2033 of baffle; the smallest face is ${Math.min(midDims.w, midDims.h)}\u2033.`]);
                F.push(mMdl.Qtc > 0.8 ? ["warn", `Qtc ${mMdl.Qtc.toFixed(2)}`, "Peaky and loose; the box is small for this driver."]
                  : mMdl.Qtc < 0.5 ? ["warn", `Qtc ${mMdl.Qtc.toFixed(2)}`, "Very damped. Fine above the crossover, but the box could be smaller."]
                  : ["ok", `Qtc ${mMdl.Qtc.toFixed(2)}`, "Well damped."]);
                if (mMdl.f3 > xoLo)
                  F.push(["warn", "Rolls off above the crossover", `The box is 3 dB down at ${mMdl.f3.toFixed(0)} Hz, above the ${xoLo} Hz crossover. Raise the crossover or use more volume.`]);
                const xPct = mMdl.peakX * midUseV / MID_V / mid.ts.Xmax * 100;
                F.push(xPct > 100
                  ? ["warn", "Excursion-limited", `The cone reaches Xmax at ${Math.round(Math.pow(MID_V * 100 / (mMdl.peakX / mid.ts.Xmax * 100), 2) / 8)} W, below ${vMidTherm < MID_V ? `its ${2 * mid.ts.aes} W program rating` : `the ${mAmpW} W amp`}. A higher crossover helps.`]
                  : vMidTherm < MID_V
                  ? ["ok", "Thermally limited", `Reaches its ${2 * mid.ts.aes} W program rating (2 \u00d7 ${mid.ts.aes} W AES) before Xmax; the ${mAmpW} W amp has more than it can use.`]
                  : ["ok", "Amp-limited", `The ${mAmpW} W amp runs out before Xmax or the ${2 * mid.ts.aes} W program rating.`]);
                if (subMusicAtXo != null) {
                  const need = subMusicAtXo - tilt, m = midNear(xoLo), gap = m.spl - need;
                  // amp power that would close the gap, if the amp is what's short
                  const wNeed = Math.pow(MID_V * Math.pow(10, -gap / 20), 2) / 8;
                  F.push(gap < -0.5
                    ? ["warn", "Mid runs out first", `${(-gap).toFixed(1)} dB short at ${xoLo} Hz of the sub at its music limit, less ${tilt} dB for the mid band. ` +
                        (m.who === "amp" ? (wNeed <= 2 * mid.ts.aes ? `About ${Math.ceil(wNeed / 25) * 25} W per mid channel would cover it.` : "More amp won't get there: it passes the driver's program rating first.")
                        : m.who === "thermal" ? "A driver with more power handling, or a higher crossover." : "A higher crossover or a driver with more excursion.")]
                    : ["ok", "Keeps up with the sub", `${gap.toFixed(1)} dB to spare at ${xoLo} Hz against the sub at its music limit, less ${tilt} dB for the mid band.` +
                        (m.who === "amp" && gap > 1 ? ` About ${Math.max(25, Math.ceil(wNeed / 25) * 25)} W per mid channel would still cover it.` : "")]);
                }
                return F.map(([kind, head, body]) => (
                  <div key={head} className="flex gap-2 items-start text-xs px-3 py-2 rounded border border-stone-300 bg-stone-50">
                    <b className={`shrink-0 font-semibold ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
            <p className="text-xs text-stone-500 mt-3">Sealed, LR24 crossovers at {xoLo} Hz and {xoHi} Hz. Coil inductance isn't modelled, so the top octave reads a little high.</p>
          </>) : (
            <p className="text-sm text-stone-600">{mid.name} can't be modelled yet: its parameters are incomplete. {mid.note}</p>
          )}
        </section>

        <section className="mt-2" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-3" style={{ fontFamily: "Georgia, serif" }}>Horn</h2>
          {hornModel ? (<>
            <div className="grid gap-px mb-4 rounded-lg overflow-hidden border border-stone-300 bg-stone-200"
                 style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
              {[
                ["Sensitivity", hf.sens.toFixed(1), "dB"],
                ["Power used", Math.round(hornModel.P), "W"],
                ["Max SPL", hornModel.flat.toFixed(1), "dB"],
                ["Coverage", hz.covH ? `${hz.covH}\u00b0\u00d7${hz.covV || "?"}\u00b0` : "\u2014", ""],
                ["Mid beam at XO", midBeam ? Math.round(midBeam) : "\u2014", midBeam ? "\u00b0" : ""],
              ].map(([k, v, u]) => (
                <div key={k} className="bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-stone-500 font-semibold">{k}</div>
                  <div className="text-xl font-medium tabular-nums mt-0.5">{v}<span className="text-xs text-stone-500 ml-0.5">{u}</span></div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <ResponseChart fmin={200} fmax={10000} top={180} bot={0} step={30} H={220} yLabel="horizontal beamwidth, °"
                series={[...(beamCurves.midB.length ? [{ curve: beamCurves.midB, label: `Mid-bass ${midSize}″`, stroke: "#b45309", tint: "rgba(180,83,9,0)" }] : []), ...(beamCurves.hornB.length ? [{ curve: beamCurves.hornB, label: horn.name, stroke: "#0f766e", tint: "rgba(15,118,110,0)" }] : [])]}
                marks={[{ f: xoHi, label: "XO" }, ...(beamCurves.fK ? [{ f: beamCurves.fK, label: "horn control" }] : [])]} />
              <p className="text-xs text-stone-500 mt-1">How wide each driver spreads sound. Best when the two lines cross near the XO line. Estimated, not measured.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {(() => {
                const F = [];
                if (hf.minXo && xoHi < hf.minXo)
                  F.push(["warn", "Below the driver's minimum crossover", `${xoHi} Hz against ${hf.minXo} Hz recommended. Power is derated here and distortion rises; check measurements before relying on it.`]);
                if (hz.minXo && xoHi < hz.minXo)
                  F.push(["warn", "Below the horn's crossover range", `${horn.name} is specified from about ${hz.minXo} Hz.`]);
                if (hz.lowHz && hz.lowHz > xoHi * 0.8)
                  F.push(["warn", "Horn stops loading near the crossover", `Loading falls away below about ${hz.lowHz} Hz, so the driver works harder right where it's crossed.`]);
                F.push(hornModel.who === "amp"
                  ? ["ok", "Amp-limited", `${Math.round(hornModel.pAmp)} W into ${hornModel.imp} \u03a9 from the ${hfAmpW} W amp, under the ${Math.round(hornModel.pProg)} W program limit${hornModel.derate < 1 ? " (derated for the low crossover)" : ""}.`]
                  : ["ok", "Program-limited", `Capped at ${Math.round(hornModel.pProg)} W: 2 \u00d7 ${hf.aes} W AES${hornModel.derate < 1 ? `, derated ${(-10 * Math.log10(hornModel.derate)).toFixed(1)} dB because ${xoHi} Hz is below the ${hf.aesXo} Hz the rating assumes` : ""}.`]);
                if (midMax) {
                  const need = midNear(xoHi).spl - hfTilt, gap = hornAt(xoHi) - need;
                  const wNeed = hfAmpW * Math.pow(10, -gap / 10);
                  F.push(gap < -0.5
                    ? ["warn", "Horn runs out first", `${(-gap).toFixed(1)} dB short at ${xoHi} Hz of the mid at its limit, less ${hfTilt} dB for the HF band. ` + (hornModel.who === "amp" && wNeed * 8 / hornModel.imp <= hornModel.pProg ? `About ${Math.ceil(wNeed / 25) * 25} W per HF channel would cover it.` : "The driver's rating is the limit: raise the crossover or pick a more sensitive driver.")]
                    : ["ok", "Keeps up with the mid", `${gap.toFixed(1)} dB to spare at ${xoHi} Hz against the mid, less ${hfTilt} dB for the HF band.`]);
                }
                if (midBeam && hz.covH && midBeam < hz.covH * 0.75)
                  F.push(["warn", "Mid narrower than the horn at the crossover", `About ${Math.round(midBeam)}\u00b0 against the horn's ${hz.covH}\u00b0: the mid is already beaming, so off-axis sound dips just below the crossover. A lower crossover or a smaller mid meets the horn.`]);
                if (beamCurves.fK && xoHi < beamCurves.fK * 0.85)
                  F.push(["warn", "Horn wider than rated at the crossover", `${horn.name} holds ${hz.covH}\u00b0 down to about ${Math.round(beamCurves.fK / 10) * 10} Hz (from its ${horn.size.w}\u2033 mouth); at ${xoHi} Hz it spreads wider.`]);
                if (midBeam && hz.covH && midBeam > hz.covH * 1.4)
                  F.push(["warn", "Mid much wider than the horn at the crossover", `About ${Math.round(midBeam)}\u00b0 against the horn's ${hz.covH}\u00b0: off-axis energy steps down through the crossover. A higher crossover narrows the mid, a wider horn meets it; a 12\u2033 at this frequency is still close to omnidirectional.`]);
                return F.map(([kind, head, body]) => (
                  <div key={head} className="flex gap-2 items-start text-xs px-3 py-2 rounded border border-stone-300 bg-stone-50">
                    <b className={`shrink-0 font-semibold ${kind === "ok" ? "text-green-800" : kind === "warn" ? "text-amber-700" : "text-red-700"}`}>{head}</b>
                    <span className="text-stone-600">{body}</span>
                  </div>
                ));
              })()}
            </div>
            <p className="text-xs text-stone-500 mt-3">From datasheet sensitivity and power, not a T/S model. Sensitivity reference: {hf.sensRef || "the maker's reference horn"}. On {horn.name} it may differ by a few dB. Below-rating crossover derating (6 dB per octave) is a rule of thumb.</p>
          </>) : (
            <p className="text-sm text-stone-600">{cd.name} can't be modelled yet: sensitivity or power rating missing.</p>
          )}
        </section>

        </div>

        <aside className="md:col-span-2" style={{ fontFamily: "system-ui, sans-serif" }}>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Plywood (baffles stay 3/4″)</div>
            <div className="flex gap-1">
              {[[0.75, "3/4″ birch"], [0.5, "1/2″ birch, braced"]].map(([t, label]) => (
                <button key={t} onClick={() => setWall(t)} className={`px-3 py-1.5 rounded border text-sm ${wall === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            <div className="mt-3"><Slider label="Baffle inset" value={inset} min={0} max={1.5} step={0.25} unit="&#8243;" onChange={setInset} /></div>
          </div>
          <Pick label="Sub driver" options={subList} value={sub} onChange={setSub} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet finish</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {Object.entries(CAB_FINISHES).map(([k, f]) => (
                <button key={k} title={f.name} onClick={() => setCabFinish(k)}
                  className={`px-2.5 h-7 rounded-full border-2 text-xs ${cabFinish === k ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: f.swatch, color: k === "walnut" ? "#f5f5f4" : "#1c1917" }}>{f.name}</button>
              ))}
              {SWATCHES.map(([hex, name]) => (
                <button key={hex} title={`Painted: ${name}`} onClick={() => setCabFinish(hex)}
                  className={`w-7 h-7 rounded-full border-2 ${cabFinish.toLowerCase() === hex ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: hex }} />
              ))}
              <label className="w-7 h-7 rounded-full border-2 border-stone-300 overflow-hidden cursor-pointer relative" title="Custom paint">
                <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
                <input type="color" value={CAB_FINISHES[cabFinish] ? "#ffffff" : cabFinish} onChange={(e) => setCabFinish(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
              </label>
              <span className="text-xs text-stone-500 ml-1 tabular-nums">{CAB_FINISHES[cabFinish] ? CAB_FINISHES[cabFinish].name : `painted ${cabFinish}`}</span>
            </div>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Baffle colour</div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {SWATCHES.map(([hex, name]) => (
                <button
                  key={hex}
                  title={name}
                  onClick={() => setBaffleColor(hex)}
                  className={`w-7 h-7 rounded-full border-2 ${baffleColor.toLowerCase() === hex ? "border-stone-900" : "border-stone-300"}`}
                  style={{ background: hex }}
                />
              ))}
              <label className="w-7 h-7 rounded-full border-2 border-stone-300 overflow-hidden cursor-pointer relative" title="Custom">
                <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
                <input
                  type="color"
                  value={baffleColor}
                  onChange={(e) => setBaffleColor(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
              <span className="text-xs text-stone-500 ml-1 tabular-nums">{baffleColor}</span>
            </div>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">View</div>
            <div className="flex gap-1">
              {[["Finished", false], ["Cutaway", true]].map(([label, v]) => (
                <button key={label} onClick={() => setCutaway(v)} className={`px-3 py-2 rounded border text-sm ${cutaway === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Layout</div>
            <div className="flex gap-1">
              {[["Two stacks", "stack"], ["Tops on spacers", "pole"], ["Tower", "tower"], ["One sub + satellites", "satellite"]].map(([label, v]) => (
                <button key={v} onClick={() => setLayout(v)} className={`px-3 py-2 rounded border text-sm ${layout === v ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            {layout === "pole" && <div className="mt-3"><Slider label="Spacer height" value={spacerH} min={4} max={36} step={1} unit="&#8243;" onChange={setSpacerH} /></div>}
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Cabinet</div>
            <div className="rounded border border-stone-300 bg-white px-3 py-3">
              <Slider label="Width"  value={cDim.w} min={18} max={40} step={0.5} unit="&#8243;" onChange={(v) => setC("w", v)} />
              <Slider label="Height" value={cDim.h} min={18} max={42} step={0.5} unit="&#8243;" onChange={(v) => setC("h", v)} />
              <Slider label="Depth"  value={cDim.d} min={14} max={32} step={0.5} unit="&#8243;" onChange={(v) => setC("d", v)} />
            </div>
            <div className="text-xs text-stone-500 mt-2 mb-1">Start from a published cabinet</div>
            <select
              value=""
              onChange={(e) => { const cb = CABINETS.find((c) => c.id === e.target.value); if (cb) startFrom(cb); e.target.value = ""; }}
              className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500 focus:outline-none focus:border-stone-900">
              <option value="">Load dimensions and vent&hellip;</option>
              {CABINETS.map((cb) => {
                const dd = cb.dims[format.sub];
                return <option key={cb.id} value={cb.id}>{cb.name} — {dd.w} × {dd.h} × {dd.d}&#8243;</option>;
              })}
            </select>
          </div>
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Vent</div>
            <div className="flex flex-wrap gap-1">
              {[["Rectangular", !portStyle.startsWith("round"), "slots"], ["Round tubes", portStyle.startsWith("round"), "round2"]].map(([label, on, v]) => (
                <button key={label} onClick={() => { if (!on) setPortStyle(v); }} className={`px-3 py-2 rounded border text-sm ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>
              ))}
            </div>
            {!portStyle.startsWith("round") && (
              <div className="flex flex-wrap gap-1 mt-1">
                {[["slots", "Bottom"], ["folded", "Bottom, folded"], ["vslots", "Both sides"], ["vslot1", "One side"]].map(([v, label]) => {
                  const on = portStyle === v || (v === "vslots" && portStyle === "vwide");
                  return <button key={v} onClick={() => setPortStyle(v)} className={`px-3 py-1.5 rounded border text-xs ${on ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{label}</button>;
                })}
              </div>
            )}
            <div className="rounded border border-stone-300 bg-white px-3 py-3 mt-2">
              {(portStyle === "slots" || portStyle === "folded") &&
                <Slider label="Slot height" value={cVent.slotH} min={1.5} max={9} step={0.25} unit="&#8243;" onChange={(v) => setV("slotH", v)} />}
              {(portStyle === "vslots" || portStyle === "vwide" || portStyle === "vslot1") &&
                <Slider label="Duct throat" value={cVent.throat} min={1} max={portStyle === "vslot1" ? 10 : 7} step={0.25} unit="&#8243;" onChange={(v) => setV("throat", v)} />}
              {portStyle.startsWith("round") && <>
                <Slider label="Tubes" value={cVent.nt} min={1} max={6} step={1} unit="" onChange={(v) => setV("nt", v)} />
                <Slider label="Tube diameter" value={cVent.dia} min={3} max={10} step={0.25} unit="&#8243;" onChange={(v) => setV("dia", v)} />
              </>}
              <Slider label="Duct length" value={cVent.len} min={3} max={30} step={0.5} unit="&#8243;" onChange={(v) => setV("len", v)} />
              <Slider label={`Highpass (${hpType})`} value={hpf} min={20} max={50} step={1} unit=" Hz" onChange={setHpf} />
              <div className="flex flex-wrap gap-1 -mt-1 mb-3">
                {Object.keys(HP_TYPES).map((t) => (
                  <button key={t} onClick={() => setHpType(t)} className={`px-2.5 py-1 rounded border text-xs ${hpType === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{t}</button>
                ))}
              </div>
              <Slider label="Port velocity limit" value={portMax} min={12} max={30} step={0.5} unit=" m/s" onChange={setPortMax} />
              <Slider label="Amp power per channel @ 8 Ω" value={ampW} min={200} max={3000} step={50} unit=" W" onChange={setAmpW} />
              <div className="text-xs text-stone-500">{port.desc}. {port.area.toFixed(1)} in&#178;.</div>
            </div>
          </div>
          <div className="mb-2">
            <div className="text-sm text-stone-500 mb-1">Mid-bass size</div>
            <div className="flex gap-1">
              {[12, 15].map((n) => (
                <button key={n} onClick={() => setMidSize(n)} className={`px-3 py-1.5 rounded border text-sm ${midSize === n ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 hover:border-stone-500"}`}>{n}″</button>
              ))}
            </div>
          </div>
          <Pick label={`Mid-bass ${midSize}"`} options={midList} value={mid} onChange={setMid} />
          <div className="mb-5">
            <div className="text-sm text-stone-500 mb-1">Mid-bass cabinet (sealed)</div>
            <div className="rounded border border-stone-300 bg-white px-3 py-3">
              {layout === "tower" ? (
                <div className="text-xs text-stone-500 mb-3">Tower layout: the mid chamber is the sub's footprint, {cDim.w}″ × 15.5″ × {cDim.d}″.</div>
              ) : (<>
                <Slider label="Width"  value={mDim.w} min={10} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("w", v)} />
                <Slider label="Height" value={mDim.h} min={10} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("h", v)} />
                <Slider label="Depth"  value={mDim.d} min={8} max={24} step={0.5} unit="&#8243;" onChange={(v) => setM("d", v)} />
              </>)}
              <Slider label="Crossover, sub to mid" value={xoLo} min={60} max={250} step={5} unit=" Hz" onChange={setXoLo} />
              <Slider label="Crossover, mid to horn" value={xoHi} min={500} max={2000} step={50} unit=" Hz" onChange={setXoHi} />
              <Slider label="Mid amp power per channel @ 8 Ω" value={mAmpW} min={50} max={2000} step={25} unit=" W" onChange={setMAmpW} />
              <Slider label="Music balance: mid band needs less by" value={tilt} min={0} max={12} step={1} unit=" dB" onChange={setTilt} />
              <div className="text-xs text-stone-500">0 dB asks the mid to match the sub flat out. Bass-heavy music usually carries 6–10 dB less from 200 Hz to 1 kHz than at 40–60 Hz.</div>
            </div>
            {layout !== "tower" && (<>
              <div className="text-xs text-stone-500 mt-2 mb-1">Start from a preset box</div>
              <select value="" onChange={(e) => { const b = MID_BOXES.find((x) => x.id === e.target.value); if (b) { setMidBox(b); setMDim({ ...b.box }); } e.target.value = ""; }}
                className="w-full px-3 py-2 rounded border border-stone-300 bg-white text-sm hover:border-stone-500 focus:outline-none focus:border-stone-900">
                <option value="">Load dimensions&hellip;</option>
                {boxList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>)}
          </div>
          <Pick label="Compression driver" options={CD_OPTIONS} value={cd} onChange={setCd} />
          <Pick label="Horn" options={HORN_OPTIONS} value={horn} onChange={setHorn} />
          <div className="rounded border border-stone-300 bg-white px-3 py-3 mb-4">
            <Slider label="HF amp power per channel @ 8 Ω" value={hfAmpW} min={10} max={500} step={5} unit=" W" onChange={setHfAmpW} />
            <Slider label="Music balance: HF band needs less by" value={hfTilt} min={0} max={12} step={1} unit=" dB" onChange={setHfTilt} />
            <div className="text-xs text-stone-500">16 Ω drivers draw half the power from the same amp.</div>
          </div>
          {mismatch && <div className="text-sm text-red-700 mb-4">Horn throat and driver exit don't match ({horn.exit}" vs {cd.exit}").</div>}
        </aside>


        <section className="md:col-span-5 mt-6" style={{ fontFamily: "system-ui, sans-serif" }}>
          <h2 className="text-xl mb-2" style={{ fontFamily: "Georgia, serif" }}>Totals for the current selection</h2>
          {(() => {
            const subBoxLb = subLbLoaded - (sub.lb || 0); // same estimate as the stats row
            const midBoxLb = midCabLb;   // same estimate as the mid-bass stats row
            const rows = [
              ["Sub column", sub.price, sub.lb, subBoxLb, subBox.h],
              ["Mid-bass box", mid.price, mid.lb, midBoxLb, midDims.h],
              ["Compression driver", cd.price, cd.lb || 0, 0, 0],
              ["Horn", horn.price, (horn.lb || 0) + 1, 0, horn.size.h + 1],
            ];
            const sum = (i) => rows.reduce((a, r) => a + (r[i] || 0), 0);
            const stackLb = sum(2) + sum(3) + (plinth ? 6 : 0);
            return (
              <div className="overflow-x-auto max-w-3xl"><table className="text-sm w-full min-w-[340px] border-collapse">
                <thead><tr className="text-stone-500 text-left border-b border-stone-300">
                  <th className="py-1 pr-4 font-normal">Per stack</th><th className="py-1 pr-4 font-normal text-right">Drivers $</th><th className="py-1 pr-4 font-normal text-right">Driver lb</th><th className="py-1 pr-4 font-normal text-right">Cabinet lb</th><th className="py-1 pr-4 font-normal text-right">Box lb</th><th className="py-1 font-normal text-right">Height in</th>
                </tr></thead>
                <tbody>
                  {rows.map(([n, pr, dl, cl, h]) => (
                    <tr key={n} className="border-b border-stone-200"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
                  ))}
                  <tr className="font-medium"><td className="py-1 pr-4">One stack{plinth ? ` + ${plinth}" plinth` : ""}</td><td className="py-1 pr-4 text-right tabular-nums">${sum(1).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(sum(3) + (plinth ? 6 : 0)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td><td className="py-1 text-right tabular-nums">{stackH.toFixed(0)}</td></tr>
                  <tr className="font-medium text-stone-900"><td className="py-1 pr-4">Pair</td><td className="py-1 pr-4 text-right tabular-nums">${(2 * sum(1)).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * sum(2)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * (sum(3) + (plinth ? 6 : 0))).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * stackLb).toFixed(0)}</td><td></td></tr>
                </tbody>
              </table></div>
            );
          })()}
          <p className="text-xs text-stone-500 mt-2">Cabinet weight: 3/4" birch baffles (2.3 lb/ft²), other panels {wall === 0.5 ? '1/2" birch (1.6 lb/ft²)' : '3/4" birch'}; the sub allows two braces and 6 lb of hardware, the mid box one brace. Particleboard runs ~30% heavier. Driver weights are approximate where the datasheet wasn't checked. Heaviest single lift is the sub column.</p>
        </section>
        <div className="md:col-span-5 mt-4" style={{ fontFamily: "system-ui, sans-serif" }}>
          <button onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}
            className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:border-stone-500">{showDetails ? "Hide" : "Show"} sub, mid-bass and horn details</button>
        </div>
        {showDetails && <section className="md:col-span-5 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ fontFamily: "system-ui, sans-serif" }}>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "Georgia, serif" }}>Sub</h2>
            <p className="text-sm text-stone-700">
              {sub.name} in a {subBox.w}×{subBox.h}×{subBox.d} in cabinet, {grossL.toFixed(0)} L gross, {netL.toFixed(0)} L net.
              Vent: {port.desc}. 3/4″ baffle set {inset}″ behind the frame, {wall === 0.5 ? "1/2″" : "3/4″"} birch walls, 1/4″ roundovers on the front edges.
            </p>
          </div>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "Georgia, serif" }}>Mid-bass cube</h2>
            <p className="text-sm text-stone-700">
              {mid.name} in a {midDims.w}×{midDims.h}×{midDims.d} in sealed box, gross {midL.toFixed(0)} L, lightly stuffed.
              Covers {xoLo} Hz to {xoHi} Hz. Same construction, flush-mounted driver.
            </p>
            {mid.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{mid.name}.</span> {mid.note}</p>}
          </div>
          <div>
            <h2 className="text-xl mb-2" style={{ fontFamily: "Georgia, serif" }}>Horn</h2>
            <p className="text-sm text-stone-700">
              {horn.name} with {cd.name}, crossed at {xoHi} Hz (maker suggests {horn.xo}). Sits on a short block so the mouth clears the cube.
              Total stack height about {stackH.toFixed(0)} in, horn centre at {hornCenter.toFixed(0)} in.
            </p>
            {cd.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{cd.name}.</span> {cd.note}</p>}
            {horn.note && <p className="text-sm text-stone-600 mt-2"><span className="font-medium text-stone-700">{horn.name}.</span> {horn.note}</p>}
          </div>
        </section>}

      </main>
      </>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(StackPlanner));
