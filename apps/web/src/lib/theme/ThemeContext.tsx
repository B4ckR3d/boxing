"use client";

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "tfn_theme";
// Read on the server by src/app/layout.tsx to render <html class> correctly in the first byte
// of HTML — that is what removes the flash of the wrong theme without any inline JS.
const COOKIE_NAME = "tfn_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function readCookie(): Theme | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)tfn_theme=(dark|light)\b/);
    return (match?.[1] as Theme | undefined) ?? null;
  } catch {
    return null;
  }
}

// localStorage is the source of truth on the client; the cookie (written by the server on every
// visit) is the fallback so a visitor who never toggled still matches the SSR-rendered class.
function getSnapshot(): Theme {
  return readStored() ?? readCookie() ?? "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

function persist(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage unavailable
  }
  try {
    document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // cookies unavailable — the next SSR render falls back to dark
  }
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((newTheme: Theme) => {
    persist(newTheme);
    applyTheme(newTheme);
    listeners.forEach((notify) => notify());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, [setTheme]);

  // Bring the DOM in line with the resolved client theme and mirror it into both stores.
  // No state is set here — useSyncExternalStore already owns the value.
  useEffect(() => {
    const resolved = getSnapshot();
    applyTheme(resolved);
    persist(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-1.5 border border-subtle bg-charcoal text-ink hover:text-fight-red hover:border-fight-red transition-colors flex items-center justify-center cursor-pointer ${className}`}
      title={theme === "dark" ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
      aria-label="Toggle dark/light mode"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-ink" />
      ) : (
        <Moon className="w-4 h-4 text-ink-muted" />
      )}
    </button>
  );
}
