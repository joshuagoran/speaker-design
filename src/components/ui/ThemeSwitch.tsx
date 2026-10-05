import { THEME_CHOICES } from "../../constants/themes";
import { useThemeChoice } from "../../hooks/useTheme";
import { ToggleButton } from "./ToggleButton";

/** System / Light / Dark buttons in the header: follow the device's setting, or pin a theme (kept per browser). */
export function ThemeSwitch() {
  const [choice, setChoice] = useThemeChoice();
  return (
    <div className="flex gap-1" role="group" aria-label="Theme">
      {THEME_CHOICES.map(([c, label]) => (
        <ToggleButton key={c} size="xs" onClick={() => setChoice(c)} on={choice === c}>
          {label}
        </ToggleButton>
      ))}
    </div>
  );
}
