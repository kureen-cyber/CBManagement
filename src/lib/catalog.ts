import { prisma } from "@/lib/prisma";
import { ensureStoresForCompany, seedDefaultCategoriesForStore } from "@/lib/store";

export const DEFAULT_PAYMENT_TYPES: { code: string; label: string; sortOrder: number }[] = [
  { code: "CASH", label: "Cash", sortOrder: 0 },
  { code: "DEBIT", label: "Debit card", sortOrder: 1 },
  { code: "CREDIT", label: "Credit card", sortOrder: 2 },
  { code: "CHEQUE", label: "Cheque", sortOrder: 3 },
  { code: "BANK", label: "Bank transfer", sortOrder: 4 },
];

/** Ensure a company has default payment methods (idempotent). */
export async function ensureDefaultPaymentTypes(companyId: string) {
  const count = await prisma.paymentType.count({ where: { companyId } });
  if (count > 0) return;
  await prisma.paymentType.createMany({
    data: DEFAULT_PAYMENT_TYPES.map((p) => ({
      companyId,
      code: p.code,
      label: p.label,
      sortOrder: p.sortOrder,
      active: true,
    })),
  });
}

/**
 * Seed starter inventory categories for a store when empty.
 * All stores share the same default list; each store can edit independently.
 */
export async function ensureDefaultInventoryCategories(
  companyId: string,
  storeId?: string | null,
) {
  const stores = await ensureStoresForCompany(companyId);
  const targetStoreId = storeId || stores[0]?.id;
  if (!targetStoreId) return;
  await seedDefaultCategoriesForStore(companyId, targetStoreId);
}

export function slugPaymentCode(label: string): string {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 32) || "CUSTOM"
  );
}
