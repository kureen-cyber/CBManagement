"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
  RECEIPT_LOGO_MAX_BYTES,
} from "@/lib/settings";
import {
  FREE_RETAIL_MAX_POS_REGISTERS,
  isFreeRetailTier,
  parsePlanTier,
} from "@/lib/tier";

const LOGO_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

async function fileToDataUrl(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!LOGO_MIME.has(file.type)) {
    throw new Error("Logo must be a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > RECEIPT_LOGO_MAX_BYTES) {
    throw new Error("Logo must be 300KB or smaller");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

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

export async function updateReceiptSettings(formData: FormData) {
  const { companyId } = await requireCompany();

  const receiptHeader = String(formData.get("receiptHeader") || "").trim() || null;
  const receiptFooter = String(formData.get("receiptFooter") || "").trim() || null;
  const receiptShowCustomer = formData.get("receiptShowCustomer") === "on";
  const receiptShowComments = formData.get("receiptShowComments") === "on";
  const receiptLanguage = parseLanguage(formData.get("receiptLanguage"));
  const removeLogo = formData.get("removeLogo") === "on";

  const data: {
    receiptHeader: string | null;
    receiptFooter: string | null;
    receiptShowCustomer: boolean;
    receiptShowComments: boolean;
    receiptLanguage: string;
    receiptLogoData?: string | null;
  } = {
    receiptHeader,
    receiptFooter,
    receiptShowCustomer,
    receiptShowComments,
    receiptLanguage,
  };

  if (removeLogo) {
    data.receiptLogoData = null;
  } else {
    const logo = formData.get("receiptLogo");
    if (logo instanceof File && logo.size > 0) {
      try {
        data.receiptLogoData = await fileToDataUrl(logo);
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Could not upload logo",
        };
      }
    }
  }

  await prisma.company.update({
    where: { id: companyId },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true as const };
}

export async function updateFeatureSettings(formData: FormData) {
  const { companyId } = await requireCompany();
  await prisma.company.update({
    where: { id: companyId },
    data: {
      featureOpenTickets: formData.get("featureOpenTickets") === "on",
      featureLowStockEmail: formData.get("featureLowStockEmail") === "on",
      featureOutOfStockWarn: formData.get("featureOutOfStockWarn") === "on",
    },
  });
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  return { ok: true as const };
}

export async function addPaymentType(formData: FormData) {
  const { companyId } = await requireCompany();
  const { slugPaymentCode, ensureDefaultPaymentTypes } = await import("@/lib/catalog");
  await ensureDefaultPaymentTypes(companyId);

  const label = String(formData.get("label") || "").trim();
  if (!label) return { error: "Enter a payment method name" };
  let code = slugPaymentCode(label);
  const existing = await prisma.paymentType.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (existing) {
    code = `${code}_${Date.now().toString(36).slice(-4)}`.slice(0, 32);
  }
  const maxSort = await prisma.paymentType.aggregate({
    where: { companyId },
    _max: { sortOrder: true },
  });
  await prisma.paymentType.create({
    data: {
      companyId,
      code,
      label,
      active: true,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/payments");
  revalidatePath("/expenses");
  return { ok: true as const };
}

export async function togglePaymentType(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "on";
  const row = await prisma.paymentType.findFirst({ where: { id, companyId } });
  if (!row) return { error: "Payment type not found" };
  await prisma.paymentType.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true as const };
}

export async function deletePaymentType(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "");
  const row = await prisma.paymentType.findFirst({ where: { id, companyId } });
  if (!row) return { error: "Payment type not found" };
  await prisma.paymentType.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true as const };
}

export async function addInventoryCategory(formData: FormData) {
  const { companyId } = await requireCompany();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Enter a category name" };
  const exists = await prisma.inventoryCategory.findFirst({
    where: { companyId, name: { equals: name, mode: "insensitive" } },
  });
  if (exists) return { error: "That category already exists" };
  await prisma.inventoryCategory.create({ data: { companyId, name } });
  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return { ok: true as const };
}

export async function deleteInventoryCategory(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "");
  const row = await prisma.inventoryCategory.findFirst({ where: { id, companyId } });
  if (!row) return { error: "Category not found" };
  await prisma.inventoryCategory.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return { ok: true as const };
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
