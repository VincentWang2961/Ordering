"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Locale = "en" | "zh-CN" | "zh-TW";

const messages: Record<Locale, Record<string, any>> = {
  en: require("@/i18n/en.json"),
  "zh-CN": require("@/i18n/zh-CN.json"),
  "zh-TW": require("@/i18n/zh-TW.json"),
};

interface LangContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string) => string;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  const t = (path: string): string => {
    const keys = path.split(".");
    let value: any = messages[locale];
    for (const key of keys) {
      value = value?.[key];
    }
    return typeof value === "string" ? value : path;
  };

  return (
    <LangContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LangProvider");
  return ctx;
}
