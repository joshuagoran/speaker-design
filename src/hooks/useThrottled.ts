import { useEffect, useRef, useState } from "react";

/**
 * `value` while `on` is off; while it is on, `value` at most every `ms`: each change waits out the rest of the time since
 * the last one taken, and the latest change wins.
 */
export function useThrottled<T>(value: T, on: boolean, ms: number): T {
  const [kept, setKept] = useState(value);
  const last = useRef(0);
  // off, it follows the value (a render-time update: React renders again before it paints)
  if (!on && kept !== value) setKept(value);
  useEffect(() => {
    if (!on) return;
    const take = () => {
      last.current = performance.now();
      setKept(value);
    };
    const timer = window.setTimeout(take, Math.max(0, ms - (performance.now() - last.current)));
    return () => window.clearTimeout(timer);
  }, [value, on, ms]);
  return on ? kept : value;
}

/** `value` while `hold` is off; while it is on, the value it had when the hold began. */
export function useHeld<T>(value: T, hold: boolean): T {
  const [kept, setKept] = useState(value);
  if (!hold && kept !== value) setKept(value);
  return hold ? kept : value;
}
