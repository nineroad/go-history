import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { localeSchema, type Locale } from "../../shared/contracts";
import { dictionaries, type MessageKey } from "./messages";

const Context = createContext<{ locale: Locale; t: (key: MessageKey) => string }>({
  locale: "en", t: (key) => dictionaries.en[key],
});
export const languageNames: Record<Locale, string> = {
  en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文", ja: "日本語", ko: "한국어",
};
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { locale: param } = useParams();
  const result = localeSchema.safeParse(param);
  const locale = result.success ? result.data : "en";
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <Context.Provider value={{ locale, t: (key) => dictionaries[locale][key] }}>{children}</Context.Provider>;
}
export const useLocale = () => useContext(Context);
