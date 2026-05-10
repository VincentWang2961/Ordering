"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import en from "@/i18n/en.json";
import zhCN from "@/i18n/zh-CN.json";
import zhTW from "@/i18n/zh-TW.json";

type Locale = "en" | "zh-CN" | "zh-TW";
interface Messages {
  [key: string]: string | Messages;
}

const messages: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
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
    let value: string | Messages | undefined = messages[locale];
    for (const key of keys) {
      value = typeof value === "object" ? value[key] : undefined;
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
