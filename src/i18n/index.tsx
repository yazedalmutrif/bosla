import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar } from "./ar";
import { en, type Dict } from "./en";
import { storage } from "../lib/storage";

export type UiLang = "ar" | "en";
export const DICTS: Record<UiLang, Dict> = { ar, en };

interface I18n {
  lang: UiLang;
  dir: "rtl" | "ltr";
  t: Dict;
  setLang: (l: UiLang) => void;
  toggle: () => void;
  fmtDate: (iso: string) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): UiLang {
  if (typeof window === "undefined") return "ar"; // build-time prerender
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl === "ar" || fromUrl === "en") return fromUrl;
  const saved = storage.get("lang");
  if (saved === "ar" || saved === "en") return saved;
  return document.documentElement.lang === "en" ? "en" : "ar";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(initialLang);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    storage.set("lang", lang);
  }, [lang]);

  const setLang = useCallback((l: UiLang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((l) => (l === "ar" ? "en" : "ar")), []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: DICTS[lang],
      setLang,
      toggle,
      fmtDate: (iso: string) => {
        const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
        if (Number.isNaN(d.getTime())) return iso;
        return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(d);
      },
    }),
    [lang, setLang, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
