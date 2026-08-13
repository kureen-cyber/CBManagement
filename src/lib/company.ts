import { prisma } from "@/lib/prisma";
import { parseBusinessType, type BusinessType } from "@/lib/business-type";

export async function getCompany() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "My Business",
        currency: "TTD",
        vatRate: 0.125,
        businessType: "BOTH",
        theme: "light",
        language: "en",
        homeLayout: "RETAIL",
        receiptPrinting: true,
      },
    });
  }
  return company;
}

/** Ensure company name/type match the signed-in user's account metadata. */
export async function syncCompanyFromUser(user: {
  user_metadata?: Record<string, unknown> | null;
} | null) {
  const meta = user?.user_metadata ?? {};
  const businessName = String(meta.business_name || meta.full_name || "").trim();
  const businessType = parseBusinessType(meta.business_type);

  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: businessName || "My Business",
        currency: "TTD",
        vatRate: 0.125,
        businessType,
        theme: "light",
        language: "en",
        homeLayout: businessType === "RETAIL" ? "RETAIL" : "RETAIL_SERVICE",
        receiptPrinting: true,
      },
    });
    return company;
  }

  const updates: { name?: string; businessType?: BusinessType } = {};

  if (businessName && company.name !== businessName) {
    updates.name = businessName;
  }

  if (meta.business_type && company.businessType !== businessType) {
    updates.businessType = businessType;
  }

  if (Object.keys(updates).length > 0) {
    company = await prisma.company.update({
      where: { id: company.id },
      data: updates,
    });
  }

  return company;
}
