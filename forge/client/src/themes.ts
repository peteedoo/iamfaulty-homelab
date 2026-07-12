export type ThemeId = "cursor" | "light" | "dracula" | "gruvbox" | "oled";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "cursor", label: "Cursor" },
  { id: "light", label: "Light" },
  { id: "dracula", label: "Dracula" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "oled", label: "OLED" },
];

const STORAGE_KEY = "forge-theme";

export function getStoredTheme(): ThemeId {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (THEMES.some((t) => t.id === raw)) return raw as ThemeId;
  return "cursor";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(STORAGE_KEY, id);
}
