import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import { storage } from "@/src/utils/storage";
import { Lang, StringKey, isRTL, strings } from "./index";

type Ctx = {
  lang: Lang | null;
  setLang: (l: Lang) => Promise<void>;
  t: (k: StringKey) => string;
  ready: boolean;
};

const LangCtx = createContext<Ctx>({
  lang: null,
  setLang: async () => {},
  t: (k) => String(k),
  ready: false,
});

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>("novaaq_lang", "");
      if (saved === "en" || saved === "ur") {
        setLangState(saved);
        try {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(isRTL(saved));
        } catch {}
      }
      setReady(true);
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    await storage.setItem("novaaq_lang", l);
    try {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(isRTL(l));
    } catch {}
    setLangState(l);
  }, []);

  const t = useCallback(
    (k: StringKey) => (lang ? strings[lang][k] : strings.en[k]) as string,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, ready }), [lang, setLang, t, ready]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
};

export const useLang = () => useContext(LangCtx);
