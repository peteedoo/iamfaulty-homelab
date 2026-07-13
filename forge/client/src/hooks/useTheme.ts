import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type ThemeId } from "../themes";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    applyTheme(id);
  }, []);

  return { theme, setTheme };
}
