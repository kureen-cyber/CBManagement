import { prisma } from "@/lib/prisma";

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

/** Supplier purchases treated as amounts owed (simplified AP ledger). */
export async function fetchOutstandingPayables(companyId: string): Promise<PayableRow[]> {
  const purchases = await prisma.supplierPurchase.findMany({
    where: { companyId },
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
