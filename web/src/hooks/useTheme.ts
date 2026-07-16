import { useCallback, useEffect, useState } from "react";
import type { ThemePref } from "../types";

const STORAGE_KEY = "bdmcp_theme";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolveDark(pref: ThemePref): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** System/Light/Dark preference, persisted and applied to <html data-theme>. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  const apply = useCallback((p: ThemePref) => {
    document.documentElement.setAttribute("data-theme", resolveDark(p) ? "dark" : "light");
  }, []);

  // Re-apply when the preference changes.
  useEffect(() => apply(pref), [pref, apply]);

  // Follow the OS live while on "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref, apply]);

  const setTheme = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    setPref(p);
  }, []);

  return { pref, setTheme };
}
