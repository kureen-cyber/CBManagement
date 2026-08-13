export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const HOME_LAYOUTS = [
  { value: "RETAIL", label: "Retail", description: "POS-first tiles: sales, customers, stock" },
  {
    value: "RETAIL_SERVICE",
    label: "Retail & service",
    description: "Mixed home: POS plus jobs, quotes, and invoices",
  },
] as const;
export type HomeLayout = (typeof HOME_LAYOUTS)[number]["value"];

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

export function parseLanguage(value: unknown): LanguageCode {
  const v = String(value || "en").toLowerCase();
  if (v === "es" || v === "fr") return v;
  return "en";
}

export function parseHomeLayout(value: unknown): HomeLayout {
  return value === "RETAIL_SERVICE" ? "RETAIL_SERVICE" : "RETAIL";
}
