import { prisma } from "@/lib/prisma";

export const MANAGER_OWNER_CUSTOMER_NAME = "Manager/Owner";

export function isOwnerDrawingsCustomer(name: string): boolean {
  return name.trim().toLowerCase() === MANAGER_OWNER_CUSTOMER_NAME.toLowerCase();
}

/** System customer used on Payments for owner drawings. */
export async function ensureManagerOwnerCustomer(companyId: string) {
  const existing = await prisma.customer.findFirst({
    where: { companyId, name: MANAGER_OWNER_CUSTOMER_NAME },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.customer.create({
    data: {
      companyId,
      name: MANAGER_OWNER_CUSTOMER_NAME,
      notes: "Auto-created for owner/manager drawings on Payments",
    },
  });
}
