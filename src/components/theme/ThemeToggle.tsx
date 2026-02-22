import type { UiMode } from "../../lib/theme/mode-controller";

export interface ThemeToggleProps {
  mode: UiMode;
  onToggle: () => void;
  disabled?: boolean;
}

export const ThemeToggle = (props: ThemeToggleProps) => {
  const label = () => (props.mode === "dark" ? "Switch to light mode" : "Switch to dark mode");

  return (
    <button
      type="button"
      class="theme-toggle"
      onClick={() => props.onToggle()}
      disabled={props.disabled}
      aria-label={label()}
      aria-pressed={props.mode === "light"}
    >
      <span aria-hidden="true">{props.mode === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
};

export default ThemeToggle;
