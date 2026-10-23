import { useEffect, useRef, useState } from "react";
import { HOVER_TRANSITION } from "./buttonStyles";
import { Icon, IconButton } from "./IconButton";
import { MarkedText, plainText } from "./MarkedText";

/** One option in a `ToggleMenu`: its name, whether it is on, and what turns it on or off. */
export interface ToggleMenuItem {
  label: string;
  on: boolean;
  onToggle: () => void;
}

interface Props {
  /** the menu's name: its button's label and tip */
  label: string;
  /** the button's icon: a 16 px SVG drawn in `currentColor` */
  icon: React.ReactNode;
  items: readonly ToggleMenuItem[];
}

/**
 * An icon button that opens a menu of options, each turned on or off with a click (a check mark shows it on). The menu
 * stays open while options change; Escape, a click outside it, or the button closes it. Up and Down move between the
 * options.
 */
export function ToggleMenu({ label, icon, items }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // the first option takes focus when the menu opens; a click outside closes it
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector("button")?.focus();
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  /** Escape closes the menu (and nothing under it, such as an expanded view); Up and Down move between the options */
  const keys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector("button")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const options = [...(menu.current?.querySelectorAll("button") ?? [])];
    const at = options.findIndex((o) => o === document.activeElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  };
  return (
    <div ref={root} className="relative" onKeyDown={open ? keys : undefined}>
      <IconButton label={label} menuOpen={open} onClick={() => setOpen((v) => !v)}>
        {icon}
      </IconButton>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={plainText(label)}
          className="absolute right-0 top-full mt-1 z-20 w-max rounded border border-stone-300 bg-panel py-1 shadow-dialog"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.on}
              onClick={item.onToggle}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-stone-300/50 focus-visible:bg-stone-300/50 ${HOVER_TRANSITION}`}
            >
              <span className="w-4 shrink-0">{item.on && <CheckIcon />}</span>
              <MarkedText text={item.label} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The check mark: an option that is on. */
function CheckIcon() {
  return (
    <Icon>
      <path d="M3 8.5l3 3 7-7" />
    </Icon>
  );
}
