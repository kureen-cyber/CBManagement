"use client";

import { useEffect } from "react";

/** Applies saved theme class on the document root. */
export function ThemeScript({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return null;
}
