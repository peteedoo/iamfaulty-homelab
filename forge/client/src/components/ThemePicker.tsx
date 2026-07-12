import { THEMES, type ThemeId } from "../themes";
import "./ThemePicker.css";

interface Props {
  theme: ThemeId;
  onChange: (id: ThemeId) => void;
}

export function ThemePicker({ theme, onChange }: Props) {
  return (
    <div className="theme-picker">
      <label className="theme-label" htmlFor="theme-select">
        Theme
      </label>
      <select
        id="theme-select"
        className="theme-select"
        value={theme}
        onChange={(e) => onChange(e.target.value as ThemeId)}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
