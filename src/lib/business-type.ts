export const BUSINESS_TYPES = ["RETAIL", "SERVICE", "BOTH"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RETAIL: "Retail business",
  SERVICE: "Service business",
  BOTH: "Both retail and service",
};

export function parseBusinessType(value: unknown): BusinessType {
  const v = String(value || "").toUpperCase();
  if (v === "RETAIL" || v === "SERVICE" || v === "BOTH") return v;
  return "BOTH";
}

export function isRetailOnly(type: BusinessType): boolean {
  return type === "RETAIL";
}

export function isServiceFocused(type: BusinessType): boolean {
  return type === "SERVICE" || type === "BOTH";
}

/** Nav items shown for each business type (Loyverse-style retail keeps POS front-and-center). */
export function navForBusinessType(type: BusinessType) {
  const retail = [
    { href: "/", label: "Dashboard" },
    { href: "/pos", label: "POS" },
    { href: "/customers", label: "Customers" },
    { href: "/inventory", label: "Inventory" },
    { href: "/payments", label: "Payments" },
    { href: "/expenses", label: "Expenses" },
    { href: "/reports", label: "Reports" },
    { href: "/demo", label: "Demo" },
  ] as const;

  const service = [
    { href: "/", label: "Dashboard" },
    { href: "/customers", label: "Customers" },
    { href: "/quotations", label: "Quotations" },
    { href: "/jobs", label: "Jobs" },
    { href: "/invoices", label: "Invoices" },
    { href: "/payments", label: "Payments" },
    { href: "/expenses", label: "Expenses" },
    { href: "/inventory", label: "Inventory" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/employees", label: "Employees" },
    { href: "/reports", label: "Reports" },
    { href: "/demo", label: "Demo" },
  ] as const;

  const both = [
    { href: "/", label: "Dashboard" },
    { href: "/pos", label: "POS" },
    { href: "/customers", label: "Customers" },
    { href: "/quotations", label: "Quotations" },
    { href: "/jobs", label: "Jobs" },
    { href: "/invoices", label: "Invoices" },
    { href: "/payments", label: "Payments" },
    { href: "/expenses", label: "Expenses" },
    { href: "/inventory", label: "Inventory" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/employees", label: "Employees" },
    { href: "/reports", label: "Reports" },
    { href: "/demo", label: "Demo" },
  ] as const;

  if (type === "RETAIL") return retail;
  if (type === "SERVICE") return service;
  return both;
}
