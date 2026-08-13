"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCompany } from "@/lib/company";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";

export async function updateGeneralSettings(formData: FormData) {
  const company = await getCompany();
  const theme = parseTheme(formData.get("theme"));
  const language = parseLanguage(formData.get("language"));
  const homeLayout = parseHomeLayout(formData.get("homeLayout"));
  const businessName = String(formData.get("businessName") || "").trim();

  await prisma.company.update({
    where: { id: company.id },
    data: {
      theme,
      language,
      homeLayout,
      ...(businessName ? { name: businessName } : {}),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("cbm_theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  cookieStore.set("cbm_lang", language, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  cookieStore.set("cbm_home_layout", homeLayout, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/pos");
}

export async function updateTaxSettings(formData: FormData) {
  const company = await getCompany();
  const taxEnabled = formData.get("taxEnabled") === "on";
  const vatPct = Number(formData.get("vatPercent") ?? 12.5);
  const vatRate = Number.isFinite(vatPct) ? Math.max(0, Math.min(100, vatPct)) / 100 : 0.125;

  await prisma.company.update({
    where: { id: company.id },
    data: { taxEnabled, vatRate },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/invoices");
}

export async function updatePrinterSettings(formData: FormData) {
  const company = await getCompany();
  const receiptPrinting = formData.get("receiptPrinting") === "on";
  const printerName = String(formData.get("printerName") || "").trim() || null;

  await prisma.company.update({
    where: { id: company.id },
    data: { receiptPrinting, printerName },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
}
