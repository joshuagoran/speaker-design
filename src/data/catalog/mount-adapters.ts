// Adapters between a compression driver and a horn whose throats meet differently: a bolt-on driver on a screw-on
// horn, or a screw-on driver on a bolt-on horn. src/lib/data.ts picks the one a pair needs from its two mounts.
// To add an entry, append an object literal to the table. The type annotation makes the compiler check it exactly.
// Prices are US dollars from US vendors only; `src` names the vendor and the month the price was read, or says why
// there is none (price null).
// Never drop a part because a spec is missing: use null where the type allows it and say what is missing in `note`.
// Pure data: no logic, no derived fields.
// Fields: id, name, lb, driver (the driver's mount it takes) and horn (the horn's mount it fits), price $, src, note.
// The 3-D view leaves out an adapter's length.
import type { MountAdapter } from "../../types";

export const MOUNT_ADAPTERS: readonly MountAdapter[] = [
  {
    id: "b2sa",
    // GUESS: Parts Express lists 0.25 lb shipping; no net weight published
    lb: 0.25,
    name: "Eminence B2S-A",
    driver: "bolts",
    horn: "thread",
    price: 14.99,
    src: "Parts Express, Oct 2026",
    note: '[Parts Express, Oct 2026] Cast aluminum, made in the USA. Turns a 2- or 3-bolt 1" driver into a 1-3/8"-18 TPI screw-on one: 1/4-20 holes on the 3" (76 mm) 2-bolt circle and M6 on the 2-1/4" (57 mm) 3-bolt circle; the outer thread fits nearly all screw-on horns, stepping the 1" exit to the horn\'s 0.94" throat. Hardware not included. Length not published. Parts Express #290-563.',
  },
  {
    id: "s2ba",
    // GUESS: Parts Express lists 0.25 lb shipping; no net weight published
    lb: 0.25,
    name: "Eminence S2B-A",
    driver: "thread",
    horn: "bolts",
    price: 14.99,
    src: "Parts Express, Oct 2026",
    note: '[Parts Express, Oct 2026] Cast aluminum, made in the USA. Lets a 1-3/8"-18 TPI screw-on 1" driver bolt to a 2- or 3-bolt horn: the inner thread takes the driver; 1/4-20 holes on the 3" (76 mm) 2-bolt circle and M6 on the 2-1/4" (57 mm) 3-bolt circle face the horn. Hardware not included. Length not published. Parts Express #290-561.',
  },
];
