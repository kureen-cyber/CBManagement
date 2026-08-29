import { prisma } from "@/lib/prisma";

export const MANAGER_OWNER_CUSTOMER_NAME = "Manager/Owner";
export const MANAGER_OWNER_PAYEE_ID = "manager-owner";

export const PAYMENT_KIND_SALARY = "SALARY";
export const PAYMENT_KIND_OPERATIONAL = "OPERATIONAL";

export function isOwnerDrawingsCustomer(name: string | null | undefined): boolean {
  return String(name || "").trim().toLowerCase() === MANAGER_OWNER_CUSTOMER_NAME.toLowerCase();
}

export function isSalaryPayment(payment: {
  kind?: string | null;
  notes?: string | null;
  employeeId?: string | null;
  customer?: { name?: string | null } | null;
}): boolean {
  if (String(payment.kind || "").toUpperCase() === PAYMENT_KIND_SALARY) return true;
  if (payment.employeeId) return true;
  if (isOwnerDrawingsCustomer(payment.customer?.name)) return true;
  const notes = String(payment.notes || "").toLowerCase();
  return notes.includes("owner drawing") || notes.startsWith("salary —") || notes.startsWith("salary -");
}

/** System customer used only for Manager/Owner salary drawings — hidden from CRM lists. */
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
      notes: "System payee for owner/manager drawings — not a CRM customer",
    },
  });
}

/** Customers shown in CRM / operational payment pickers (excludes Manager/Owner). */
export function excludeSystemCustomers<T extends { name: string }>(customers: T[]): T[] {
  return customers.filter((c) => !isOwnerDrawingsCustomer(c.name));
}
