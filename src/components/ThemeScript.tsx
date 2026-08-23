"use client";

import { useEffect } from "react";
import { type Theme, themeColorScheme } from "@/lib/settings";

/** Applies saved theme class on the document root. */
export function ThemeScript({ theme }: { theme: Theme }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = themeColorScheme(theme);
  }, [theme]);
  return null;
}
