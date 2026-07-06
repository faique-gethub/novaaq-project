import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, Ad } from "@/src/services/api";
import { authService } from "@/src/services/auth";

type Ctx = {
  maybeShow: () => Promise<Ad | null>;
  markShown: (adId: string) => Promise<void>;
  resetCounter: () => void;
};

const AdCtx = createContext<Ctx>({
  maybeShow: async () => null,
  markShown: async () => {},
  resetCounter: () => {},
});

export const AdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const counterRef = useRef(0);
  const [screensPerAd, setScreensPerAd] = useState(5);
  const [ads, setAds] = useState<Ad[]>([]);

  const refresh = useCallback(async () => {
    try {
      const cfg = await api.getAdConfig();
      setScreensPerAd(cfg.screens_per_ad);
      const list = await api.listAds({ active_only: true });
      setAds(list);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const maybeShow = useCallback(async (): Promise<Ad | null> => {
    const user = await authService.currentUser();
    if (!user || user.role === "admin") return null; // don't show ads to admin

    counterRef.current += 1;
    if (counterRef.current % screensPerAd !== 0) return null;

    try {
      const list = await api.listAds({ active_only: true });
      setAds(list);
      if (list.length === 0) return null;
      return list[Math.floor(Math.random() * list.length)];
    } catch {
      return null;
    }
  }, [screensPerAd]);

  const markShown = useCallback(async (adId: string) => {
    try {
      await api.viewAd(adId);
    } catch {}
  }, []);

  const resetCounter = useCallback(() => {
    counterRef.current = 0;
  }, []);

  const value = useMemo(
    () => ({ maybeShow, markShown, resetCounter }),
    [maybeShow, markShown, resetCounter],
  );

  return <AdCtx.Provider value={value}>{children}</AdCtx.Provider>;
};

export const useAds = () => useContext(AdCtx);