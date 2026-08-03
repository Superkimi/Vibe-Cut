"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { TranslationKey } from "@/i18n";

export type ThemeId = "light" | "dark" | "lilac";

export const themeOptions = [
  { id: "light", labelKey: "theme.light" },
  { id: "dark", labelKey: "theme.dark" },
  { id: "lilac", labelKey: "theme.lilac" },
] as const satisfies ReadonlyArray<{ id: ThemeId; labelKey: TranslationKey }>;

const STORAGE_KEY = "vibe-cut-theme";
const DEFAULT_THEME: ThemeId = "light";

function isTheme(value: string | null): value is ThemeId {
  return value === "light" || value === "dark" || value === "lilac";
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const onThemeChange = () => onStoreChange();
    window.addEventListener("vibecut:theme-change", onThemeChange);
    window.addEventListener("storage", onThemeChange);
    return () => {
      window.removeEventListener("vibecut:theme-change", onThemeChange);
      window.removeEventListener("storage", onThemeChange);
    };
  }, []);
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  const setTheme = useCallback((next: ThemeId) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new CustomEvent("vibecut:theme-change", { detail: next }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
