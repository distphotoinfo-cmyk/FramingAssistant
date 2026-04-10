import React, { createContext, useContext, useMemo } from "react";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { resolveTheme, type AppTheme } from "./tokens";

const AppThemeContext = createContext<AppTheme>(resolveTheme("dark"));

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const colorMode = useAppSettingsStore((state) => state.colorMode);
  const theme = useMemo(() => resolveTheme(colorMode), [colorMode]);

  return <AppThemeContext.Provider value={theme}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
