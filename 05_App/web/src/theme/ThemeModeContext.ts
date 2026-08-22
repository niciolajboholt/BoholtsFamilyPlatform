import { createContext, useContext } from "react";

import type { PaletteMode } from "@mui/material";

export type ThemeModePreference = "light" | "dark" | "system";

export interface ThemeModeContextValue {
  preference: ThemeModePreference;
  resolvedMode: PaletteMode;
  setPreference: (preference: ThemeModePreference) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(
  null,
);

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useThemeMode skal bruges inden i ThemeModeProvider.");
  }

  return context;
}
