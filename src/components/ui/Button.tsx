import { useId } from "react";
import { BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES, HOVER_TRANSITION } from "./buttonStyles";
import type { ButtonSize, ButtonVariant } from "./buttonStyles";
import { Tooltip } from "./Tooltip";

/** A button's own attributes, less `title`: a tip shows in the shared `Tooltip` (`tip`), never the browser's. */
interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** its tooltip (control names `**name**` in semibold); while it is disabled, the reason why */
  tip?: string;
}

/** Disabled = gray fill with dark text (readable), never faded with opacity */
export function Button({ variant = "secondary", size = "md", className = "", tip, ...p }: Props) {
  const tipId = useId();
  const button = (
    <button
      type="button"
      aria-describedby={tip ? tipId : undefined}
      {...p}
      className={`rounded border ${HOVER_TRANSITION} ${BUTTON_SIZE_CLASSES[size]} ${BUTTON_VARIANT_CLASSES[variant]} disabled:border-stone-300 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed ${className}`}
    />
  );
  return tip ? (
    <Tooltip control tip={tip} describes={tipId}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
