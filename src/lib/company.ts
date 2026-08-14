import { prisma } from "@/lib/prisma";
import { parseBusinessType, type BusinessType } from "@/lib/business-type";
import { createClient } from "@/lib/supabase/server";
import { tierFromBusinessType, type PlanTier } from "@/lib/tier";

type AuthUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
};

function metaBusinessName(user: AuthUser | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  return String(meta.business_name || meta.full_name || "").trim();
}

function metaBusinessType(user: AuthUser | null | undefined): BusinessType {
  return parseBusinessType(user?.user_metadata?.business_type);
}

/** Resolve the signed-in user's company. Creates one on first login/signup. */
export async function ensureCompanyForUser(user: AuthUser) {
  const existing = await prisma.companyMember.findUnique({
    where: { userId: user.id },
    include: { company: true },
  });
  if (existing?.company) {
    const expected = tierFromBusinessType(existing.company.businessType);
    if (existing.company.businessType === "RETAIL" && existing.company.planTier !== expected) {
      return prisma.company.update({
        where: { id: existing.company.id },
        data: { planTier: expected },
      });
    }
    return existing.company;
  }

  const businessName = metaBusinessName(user) || "My Business";
  const businessType = metaBusinessType(user);
  const planTier = tierFromBusinessType(businessType);
  const normalized = businessName.toLowerCase();

  // Claim a legacy orphan company when the name matches (original owner's data).
  // Also: if this is the first membership after the tenancy migration and there is
  // exactly one orphan company, claim it so the primary operator keeps historical data.
  // Never auto-claim unmatched orphans once any membership exists — that was the leak.
  const orphans = await prisma.company.findMany({
    where: { members: { none: {} } },
    orderBy: { createdAt: "asc" },
  });
  const totalMembers = await prisma.companyMember.count();
  const claim =
    orphans.find((c) => c.name.trim().toLowerCase() === normalized) ||
    (totalMembers === 0 && orphans.length === 1 ? orphans[0] : undefined);

  if (claim) {
    await prisma.companyMember.create({
      data: { userId: user.id, companyId: claim.id, role: "OWNER" },
    });
    return prisma.company.update({
      where: { id: claim.id },
      data: {
        name: businessName,
        businessType,
        planTier,
        homeLayout: businessType === "RETAIL" ? "RETAIL" : claim.homeLayout,
      },
    });
  }

  const company = await prisma.company.create({
    data: {
      name: businessName,
      currency: "TTD",
      vatRate: 0.125,
      businessType,
      planTier,
      theme: "light",
      language: "en",
      homeLayout: businessType === "RETAIL" ? "RETAIL" : "RETAIL_SERVICE",
      receiptPrinting: true,
    },
  });

  await prisma.companyMember.create({
    data: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  return company;
}

/**
 * Current signed-in company. Prefer this over findFirst.
 * Throws if there is no authenticated user.
 */
export async function requireCompany() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    throw new Error("Unauthorized");
  }
  const company = await ensureCompanyForUser(user);
  return { user, company, companyId: company.id };
}

/** @deprecated Use requireCompany() — kept for gradual call-site updates. */
export async function getCompany() {
  const { company } = await requireCompany();
  return company;
}

/** Ensure membership exists; only update the user's own company settings. */
export async function syncCompanyFromUser(user: AuthUser | null) {
  if (!user?.id) {
    const fallback = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (fallback) return fallback;
    return prisma.company.create({
      data: {
        name: "My Business",
        currency: "TTD",
        vatRate: 0.125,
        businessType: "BOTH",
        planTier: "STANDARD",
        theme: "light",
        language: "en",
        homeLayout: "RETAIL",
        receiptPrinting: true,
      },
    });
  }

  return ensureCompanyForUser(user);
}

export async function updateOwnCompany(
  companyId: string,
  data: {
    name?: string;
    businessType?: BusinessType;
    planTier?: PlanTier;
    homeLayout?: string;
    theme?: string;
    language?: string;
    taxEnabled?: boolean;
    vatRate?: number;
    receiptPrinting?: boolean;
    printerName?: string | null;
  },
) {
  return prisma.company.update({
    where: { id: companyId },
    data,
  });
}
