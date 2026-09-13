import { prisma } from "@/lib/prisma";

export const DEFERRED_PAYMENT_CODE = "DEFERRED";
export const DEFERRED_PAYMENT_LABEL = "Deferred payment";
export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

export type ReceivableSource = "POS" | "SERVICE";

export type ReceivableRow = {
  id: string;
  source: ReceivableSource;
  number: string;
  customerId: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balance: number;
  dueDate: Date | null;
  updatedAt: Date;
};

/** Ensure the company has a Walk-in Customer row for deferred POS receivables. */
export async function ensureWalkInCustomer(companyId: string) {
  const existing = await prisma.customer.findFirst({
    where: { companyId, name: WALK_IN_CUSTOMER_NAME },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.customer.create({
    data: {
      companyId,
      name: WALK_IN_CUSTOMER_NAME,
      notes: "Auto-created for POS walk-ins",
    },
  });
}

export async function fetchOutstandingReceivables(companyId: string): Promise<ReceivableRow[]> {
  const [invoices, sales] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      },
      include: { customer: true },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        status: "COMPLETED",
        isRefund: false,
      },
      include: { customer: true },
      orderBy: [{ dueDate: "asc" }, { soldAt: "desc" }],
    }),
  ]);

  const invoiceRows: ReceivableRow[] = invoices
    .map((inv) => ({
      id: inv.id,
      source: "SERVICE" as const,
      number: inv.number,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: Math.max(0, inv.total - inv.amountPaid),
      dueDate: inv.dueDate,
      updatedAt: inv.updatedAt,
    }))
    .filter((row) => row.balance > 0);

  const saleRows: ReceivableRow[] = sales
    .map((sale) => ({
      id: sale.id,
      source: "POS" as const,
      number: sale.number,
      customerId: sale.customerId || "",
      customerName: sale.customer?.name || WALK_IN_CUSTOMER_NAME,
      total: sale.total,
      amountPaid: sale.amountPaid,
      balance: Math.max(0, sale.total - sale.amountPaid),
      dueDate: sale.dueDate,
      updatedAt: sale.updatedAt,
    }))
    .filter((row) => row.balance > 0);

  return [...invoiceRows, ...saleRows].sort((a, b) => {
    const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

export function receivableSourceLabel(source: ReceivableSource): string {
  return source === "POS" ? "POS" : "Service";
}
