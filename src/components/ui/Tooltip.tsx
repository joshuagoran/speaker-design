import { useEffect, useId, useRef, useState } from "react";

/** Term with a tooltip. Opens on hover, keyboard focus or tap; Esc or a tap elsewhere closes it. */
export function Tooltip({ tip, children, className = "" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    setFlip(!!r && r.left + 288 > window.innerWidth - 8);
    const off = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  return (
    <span
      ref={ref}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="cursor-help border-b-2 border-dotted border-soft"
      >
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute z-30 top-full mt-1 w-max max-w-[18rem] rounded bg-stone-900 text-stone-50 text-xs font-normal normal-case tracking-normal leading-snug px-2 py-1.5 text-left ${flip ? "right-0" : "left-0"}`}
        >
          {tip}
        </span>
      )}
    </span>
  );
}
