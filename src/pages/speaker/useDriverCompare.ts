import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  compareRows,
  driverOptions,
  optionKey,
  ownOption,
  type CompareOrigin,
  type DriverCompareRun,
} from "../../lib/speaker/driverCompare";
import { runDriverCompare } from "../../lib/speaker/runDriverCompare";
import { isOptimizerCancel } from "../../lib/makeOptimizerRunner";
import { hornById } from "../../lib/data";
import { driverName } from "../../lib/speaker/driverLists";
import type {
  DriverCompareOption,
  DriverCompareTarget,
  SpeakerDriver,
  SpeakerSpec,
} from "../../types";

/** The comparison open on a driver entry: the entry, and the part it opened on. */
export type OpenCompare = DriverCompareTarget & { origin: CompareOrigin };

/** How many options one worker request runs: the table fills a few rows at a time. */
const CHUNK = 4;
/** The most runs the cache keeps; past it, it drops the runs of other designs. */
const CACHE_MAX = 3000;

/** An option's name: the driver's, and its horn's after a "+" where it pairs with one. */
const nameOf = (kind: SpeakerDriver["kind"], o: DriverCompareOption) => {
  const driver = driverName({ kind, driverId: o.driverId });
  const horn = o.hornId === null ? undefined : hornById(o.hornId);
  return horn ? `${driver} + ${horn.name}` : driver;
};

/**
 * The key of everything an option's run reads but the option: the spec with the entry's part and horn left out. A run
 * cached under it stays good while only that entry's part changes (a Use, then another).
 */
function restKey(spec: SpeakerSpec, t: DriverCompareTarget): string {
  const chambers = spec.cabinet.chambers.map((c, k) =>
    k !== t.chamber
      ? c
      : {
          ...c,
          drivers: c.drivers.map((d, j) =>
            j === t.entry ? { ...d, driverId: "", horn: d.horn && { ...d.horn, hornId: "" } } : d,
          ),
        },
  );
  return JSON.stringify([{ ...spec.cabinet, chambers }, spec.bands, spec.input]);
}

/**
 * The driver comparison for the open entry (null: closed): its options, each run through the page's model in the worker
 * while it is open (a few at a time, cached per option), and the rows with their checks.
 */
export function useDriverCompare(spec: SpeakerSpec, open: OpenCompare | null) {
  const driver = open ? spec.cabinet.chambers[open.chamber]?.drivers[open.entry] : undefined;
  const target = useMemo(
    () => (open && driver ? { chamber: open.chamber, entry: open.entry } : null),
    [open, driver],
  );
  const options = useMemo(
    () => (driver ? driverOptions(driver, open?.origin) : []),
    [driver, open?.origin],
  );
  const rest = useMemo(
    () => (target ? restKey(spec, target) : ""),
    [spec.cabinet, spec.bands, spec.input, target],
  );
  const cache = useRef(new Map<string, DriverCompareRun>());
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const runOf = (o: DriverCompareOption) => cache.current.get(`${rest}|${optionKey(o)}`);
  // the worker reads the spec as it is when the run starts
  const specNow = useRef(spec);
  specNow.current = spec;
  useEffect(() => {
    if (!target) return;
    // over the cap, drop the runs of other designs first, so the rows on show keep theirs
    if (cache.current.size > CACHE_MAX)
      for (const key of cache.current.keys())
        if (!key.startsWith(`${rest}|`)) cache.current.delete(key);
    const missing = options.filter((o) => !cache.current.has(`${rest}|${optionKey(o)}`));
    if (!missing.length) return;
    const ctl = new AbortController();
    const spec0 = specNow.current;
    (async () => {
      for (let i = 0; i < missing.length; i += CHUNK) {
        const chunk = missing.slice(i, i + CHUNK);
        const runs = await runDriverCompare(
          { spec: spec0, target, options: chunk },
          { signal: ctl.signal },
        );
        chunk.forEach((o, k) => {
          const run = runs[k];
          if (run) cache.current.set(`${rest}|${optionKey(o)}`, run);
        });
        bump();
      }
    })().catch((e: unknown) => {
      // a canceled run is the block closing or the design changing; anything else goes to the browser's error report
      if (!isOptimizerCancel(e)) reportError(e);
    });
    return () => ctl.abort();
  }, [target, options, rest]);
  const yours = driver ? optionKey(ownOption(driver)) : "";
  const rows = useMemo(() => {
    if (!driver) return [];
    return compareRows(options, runOf, {
      kind: driver.kind,
      yours,
      nameOf: (o) => nameOf(driver.kind, o),
    });
    // `version` brings in the runs the worker posted since
  }, [version, options, rest, yours]);
  return {
    driver,
    rows,
    /** some option has no run yet */
    pending: options.some((o) => !runOf(o)),
  };
}
