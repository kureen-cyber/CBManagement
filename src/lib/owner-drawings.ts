import { prisma } from "@/lib/prisma";

/** @deprecated Legacy system customer — kept for classifying old payments only. */
export const MANAGER_OWNER_CUSTOMER_NAME = "Manager/Owner";

export const OWNER_SYSTEM_ROLE = "OWNER";
export const MANAGER_SYSTEM_ROLE = "MANAGER";
export const OWNER_POSITION_LABEL = "Owner";
export const MANAGER_POSITION_LABEL = "Manager";

export const PAYMENT_KIND_SALARY = "SALARY";
export const PAYMENT_KIND_OPERATIONAL = "OPERATIONAL";

export function isOwnerDrawingsCustomer(name: string | null | undefined): boolean {
  return String(name || "").trim().toLowerCase() === MANAGER_OWNER_CUSTOMER_NAME.toLowerCase();
}

export function isOwnerEmployee(
  employee: { systemRole?: string | null } | null | undefined,
): boolean {
  return String(employee?.systemRole || "").toUpperCase() === OWNER_SYSTEM_ROLE;
}

export function isManagerEmployee(
  employee: { systemRole?: string | null } | null | undefined,
): boolean {
  return String(employee?.systemRole || "").toUpperCase() === MANAGER_SYSTEM_ROLE;
}

export function isSystemEmployee(
  employee: { systemRole?: string | null } | null | undefined,
): boolean {
  return isOwnerEmployee(employee) || isManagerEmployee(employee);
}

export function employeeDisplayName(employee: {
  firstName: string;
  lastName: string;
  role?: string | null;
}): string {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  return name || employee.role || "Employee";
}

export function isOwnerDrawingPayment(payment: {
  employee?: { systemRole?: string | null } | null;
  customer?: { name?: string | null } | null;
  notes?: string | null;
}): boolean {
  if (isOwnerEmployee(payment.employee)) return true;
  if (isOwnerDrawingsCustomer(payment.customer?.name)) return true;
  const notes = String(payment.notes || "").trim().toLowerCase();
  return notes === "owner drawing";
}

export function isSalaryPayment(payment: {
  kind?: string | null;
  notes?: string | null;
  employeeId?: string | null;
  employee?: { systemRole?: string | null } | null;
  customer?: { name?: string | null } | null;
}): boolean {
  if (String(payment.kind || "").toUpperCase() === PAYMENT_KIND_SALARY) return true;
  if (payment.employeeId && !isOwnerEmployee(payment.employee)) return true;
  if (isOwnerDrawingsCustomer(payment.customer?.name)) return true;
  const notes = String(payment.notes || "").toLowerCase();
  return notes.includes("owner drawing") || notes.startsWith("salary —") || notes.startsWith("salary -");
}

async function ensureSystemEmployee(
  companyId: string,
  systemRole: typeof OWNER_SYSTEM_ROLE | typeof MANAGER_SYSTEM_ROLE,
  firstName: string,
  role: string,
) {
  const existing = await prisma.employee.findFirst({
    where: { companyId, systemRole },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.employee.create({
    data: {
      companyId,
      firstName,
      lastName: "",
      role,
      systemRole,
      active: true,
    },
  });
}

/** Default Owner and Manager positions — created on signup and ensured for existing tenants. */
export async function ensureDefaultLeadershipEmployees(companyId: string) {
  const [owner, manager] = await Promise.all([
    ensureSystemEmployee(companyId, OWNER_SYSTEM_ROLE, OWNER_POSITION_LABEL, OWNER_POSITION_LABEL),
    ensureSystemEmployee(
      companyId,
      MANAGER_SYSTEM_ROLE,
      MANAGER_POSITION_LABEL,
      MANAGER_POSITION_LABEL,
    ),
  ]);
  return { owner, manager };
}

/** Prisma filter for CRM customer counts (excludes legacy system customer). */
export function crmCustomerCountWhere(companyId: string) {
  return {
    companyId,
    NOT: { name: MANAGER_OWNER_CUSTOMER_NAME },
  };
}

/** Customers shown in CRM / operational payment pickers (excludes legacy system customer). */
export function excludeSystemCustomers<T extends { name: string }>(customers: T[]): T[] {
  return customers.filter((c) => !isOwnerDrawingsCustomer(c.name));
}

/** Regular staff for assignment pickers (excludes default Owner/Manager positions). */
export function excludeSystemEmployees<T extends { systemRole?: string | null }>(
  employees: T[],
): T[] {
  return employees.filter((e) => !isSystemEmployee(e));
}
