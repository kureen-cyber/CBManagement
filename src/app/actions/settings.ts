"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";
import {
  FREE_RETAIL_MAX_POS_REGISTERS,
  isFreeRetailTier,
  parsePlanTier,
} from "@/lib/tier";

export async function updateGeneralSettings(formData: FormData) {
  const { companyId } = await requireCompany();
  const theme = parseTheme(formData.get("theme"));
  const language = parseLanguage(formData.get("language"));
  const homeLayout = parseHomeLayout(formData.get("homeLayout"));
  const businessName = String(formData.get("businessName") || "").trim();

  await prisma.company.update({
    where: { id: companyId },
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
  const { companyId } = await requireCompany();
  const taxEnabled = formData.get("taxEnabled") === "on";
  const vatPct = Number(formData.get("vatPercent") ?? 12.5);
  const vatRate = Number.isFinite(vatPct) ? Math.max(0, Math.min(100, vatPct)) / 100 : 0.125;

  await prisma.company.update({
    where: { id: companyId },
    data: { taxEnabled, vatRate },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/invoices");
}

export async function updatePrinterSettings(formData: FormData) {
  const { companyId } = await requireCompany();
  const receiptPrinting = formData.get("receiptPrinting") === "on";
  const printerName = String(formData.get("printerName") || "").trim() || null;

  await prisma.company.update({
    where: { id: companyId },
    data: { receiptPrinting, printerName },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
}

/** Save up to two named POS registers (free retail limit). */
export async function updatePosRegisters(formData: FormData) {
  const { companyId, company } = await requireCompany();
  const tier = parsePlanTier(company.planTier);
  const max = isFreeRetailTier(tier) ? FREE_RETAIL_MAX_POS_REGISTERS : FREE_RETAIL_MAX_POS_REGISTERS;

  const names = [1, 2, 3, 4]
    .map((n) => String(formData.get(`register${n}`) || "").trim())
    .filter(Boolean)
    .slice(0, max);

  if (names.length === 0) {
    return { error: "Name at least one POS register" };
  }

  const unique = new Set(names.map((n) => n.toLowerCase()));
  if (unique.size !== names.length) {
    return { error: "POS register names must be unique" };
  }

  const existing = await prisma.posRegister.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  // Update / create in order; delete extras beyond saved names
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const row = existing[i];
    if (row) {
      await prisma.posRegister.update({
        where: { id: row.id },
        data: { name },
      });
    } else {
      await prisma.posRegister.create({
        data: { companyId, name },
      });
    }
  }

  const extras = existing.slice(names.length);
  for (const row of extras) {
    // Detach sales then delete register
    await prisma.sale.updateMany({
      where: { posRegisterId: row.id },
      data: { posRegisterId: null },
    });
    await prisma.posRegister.delete({ where: { id: row.id } });
  }

  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true as const, count: names.length };
}
