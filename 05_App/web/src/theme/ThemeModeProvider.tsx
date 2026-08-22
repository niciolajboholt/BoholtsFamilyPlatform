import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { CssBaseline, ThemeProvider } from "@mui/material";
import type { PaletteMode } from "@mui/material";

import { createAppTheme } from "./theme";
import type { ThemeModeContextValue, ThemeModePreference } from "./ThemeModeContext";
import { ThemeModeContext } from "./ThemeModeContext";

const storageKey = "boholts-theme-mode-preference";

const themeColorByMode: Record<PaletteMode, string> = {
  light: "#2F6B4F",
  dark: "#17191A",
};

function readStoredPreference(): ThemeModePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    // localStorage utilgængelig (privat browsing) — falder tilbage til
    // systemets indstilling for denne session.
    return "system";
  }
}

function getSystemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeModePreference>(
    readStoredPreference,
  );

  const [systemPrefersDark, setSystemPrefersDark] = useState(
    getSystemPrefersDark,
  );

  // Følger systemets lys/mørk-indstilling live, mens "system" er valgt —
  // så appen selv skifter tema, hvis brugeren fx slår mørk tilstand til på
  // telefonen om aftenen, uden at skulle genindlæse appen.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange(event: MediaQueryListEvent) {
      setSystemPrefersDark(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  function setPreference(nextPreference: ThemeModePreference) {
    setPreferenceState(nextPreference);

    try {
      window.localStorage.setItem(storageKey, nextPreference);
    } catch {
      // Storage utilgængelig — valget gælder stadig resten af sessionen.
    }
  }

  const resolvedMode: PaletteMode =
    preference === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : preference;

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

  // Native browser-UI (adressefelt-farve på mobil, scrollbars/formularer på
  // desktop) følger ikke MUI's tema af sig selv — begge dele opdateres
  // eksplicit her, så de matcher, uanset om brugeren valgte tilstanden
  // manuelt eller den kommer fra "system".
  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedMode;

    const themeColorMeta = document.querySelector(
      'meta[name="theme-color"]',
    );
    themeColorMeta?.setAttribute("content", themeColorByMode[resolvedMode]);
  }, [resolvedMode]);

  const contextValue = useMemo<ThemeModeContextValue>(
    () => ({ preference, resolvedMode, setPreference }),
    [preference, resolvedMode],
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
