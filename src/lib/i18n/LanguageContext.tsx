"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
} from "react";
import { translations, Language, TranslationKey } from "./translations";

const STORAGE_KEY = "tfn_lang";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

function getServerSnapshot(): Language {
  return "id";
}

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "id",
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => translations.id[key] || (key as string),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // localStorage is read through an external store — no effect, no cascading renders.
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((newLang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // storage unavailable
    }
    listeners.forEach((notify) => notify());
  }, []);

  const toggleLang = useCallback(() => {
    setLang(getSnapshot() === "id" ? "en" : "id");
  }, [setLang]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang]?.[key] || translations.id[key] || (key as string);
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-none font-mono-data text-[11px] font-bold border border-subtle overflow-hidden ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      <button
        type="button"
        onClick={() => setLang("id")}
        className={`px-2 py-0.5 transition-colors cursor-pointer ${
          lang === "id"
            ? "bg-fight-red text-ink font-black"
            : "bg-charcoal text-ink-muted hover:text-ink"
        }`}
        title="Bahasa Indonesia (Utama)"
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2 py-0.5 transition-colors cursor-pointer ${
          lang === "en"
            ? "bg-fight-red text-ink font-black"
            : "bg-charcoal text-ink-muted hover:text-ink"
        }`}
        title="English (Secondary)"
      >
        EN
      </button>
    </div>
  );
}
