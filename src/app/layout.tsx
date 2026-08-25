import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Manrope } from "next/font/google";
import { parseTheme, themeColorScheme } from "@/lib/settings";
import { ensureAppTimezone } from "@/lib/timezone";
import "./globals.css";

ensureAppTimezone();

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CBManagement — Run Your Entire Business From One Place",
  description:
    "Simple, affordable business operating system for small businesses in Trinidad & Tobago and the Caribbean.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get("cbm_theme")?.value);
  const lang = cookieStore.get("cbm_lang")?.value || "en";
  const colorScheme = themeColorScheme(theme);

  return (
    <html lang={lang} data-theme={theme} style={{ colorScheme }}>
      <body className={`${fraunces.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
