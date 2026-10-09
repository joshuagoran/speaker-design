/** How a compression driver meets a horn's throat, by id, as the page names each: bolts on a circle, or a thread. */
export const THROAT_MOUNT_NAMES = { bolts: "bolt-on", thread: "screw-on" } as const;

/** The screw-on throat threads, by id, as the page names each (1-inch drivers and horns share the one standard). */
export const THROAT_THREAD_NAMES = { "1-3/8-18": "1-3/8″-18 TPI" } as const;

/** The mount kinds' ids (`THROAT_MOUNT_NAMES`), for code that compares them. */
export const BOLT_MOUNT = "bolts" satisfies keyof typeof THROAT_MOUNT_NAMES;
export const THREAD_MOUNT = "thread" satisfies keyof typeof THROAT_MOUNT_NAMES;
