import { useCallback, useEffect, useState } from "react";
import { loadCards, loadMyIssuers } from "./data";
import type { CardPage } from "./data";
import type { Card, MyIssuersData } from "./types";

const NO_CARDS: Card[] = [];
const NO_ISSUERS: MyIssuersData = {};

/** Run an async loader once per stable loader identity. */
export function useAsyncData<T>(loader: () => Promise<T>, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loader().then((value) => {
      if (!active) return;
      setData(value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loader]);

  return { data, loading };
}

export function useCards(kind: CardPage = "gallery", enabled = true) {
  const [cards, setCards] = useState<Card[]>(NO_CARDS);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setCards(NO_CARDS);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadCards(kind).then((value) => {
      if (!active) return;
      setCards(value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind, enabled]);

  return { cards, loading };
}

export function useMyIssuers() {
  const loader = useCallback(loadMyIssuers, []);
  return useAsyncData(loader, NO_ISSUERS);
}

export function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint,
  );
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

const THEME_KEY = "bankcard-theme";

export function useTheme() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#0d1310" : "#f4f6f3");
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // Storage can be unavailable in private mode; the theme still applies.
    }
  }, [dark]);

  return [dark, () => setDark((value) => !value)] as const;
}
