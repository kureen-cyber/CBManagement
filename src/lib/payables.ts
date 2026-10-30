import { prisma } from "@/lib/prisma";
import { DEFERRED_PAYMENT_LABEL } from "@/lib/receivables";

export type PayableRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  reference: string;
  description: string;
  amount: number;
  dueDate: Date;
  purchasedAt: Date;
};

/**
 * Outstanding payables from deferred supplier payments only.
 * Supply-database purchase logs are reference/forecast and are not AP.
 * Existing supply-log rows stay in the database unchanged.
 */
export async function fetchOutstandingPayables(companyId: string): Promise<PayableRow[]> {
  const purchases = await prisma.supplierPurchase.findMany({
    where: {
      companyId,
      OR: [
        { name: { contains: DEFERRED_PAYMENT_LABEL, mode: "insensitive" } },
        { notes: { contains: DEFERRED_PAYMENT_LABEL, mode: "insensitive" } },
      ],
    },
    include: { supplier: true },
    orderBy: [{ purchasedAt: "desc" }],
  });

  return purchases.map((p) => ({
    id: p.id,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    reference: p.id.slice(-8).toUpperCase(),
    description: p.name,
    amount: p.totalCost,
    dueDate: p.purchasedAt,
    purchasedAt: p.purchasedAt,
  }));
}

export function payablesTotal(rows: PayableRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
