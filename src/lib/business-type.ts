import { NAV_ITEMS } from "@/lib/constants";
import { TIER_GATING_ENABLED } from "@/lib/tier";

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

/** Full app menu (development order). Used while viewing restrictions are off. */
export const FULL_APP_NAV = NAV_ITEMS;

/** Nav items shown for each business type once tier/module gating is re-enabled. */
export function navForBusinessType(type: BusinessType) {
  // During development, every account sees the full sidebar.
  if (!TIER_GATING_ENABLED) return [...FULL_APP_NAV];

  const retail = [
    { href: "/home", label: "Dashboard" },
    { href: "/pos", label: "POS" },
    { href: "/inventory", label: "Inventory" },
    { href: "/customers", label: "Customers" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/payments", label: "Payments" },
    { href: "/employees", label: "Employees" },
    { href: "/expenses", label: "Expenses" },
    { href: "/reports", label: "Reports" },
    { href: "/marketing", label: "Marketing" },
    { href: "/analytics", label: "Analytics" },
    { href: "/financial-reports", label: "Financial Reports" },
    { href: "/settings", label: "Settings" },
    { href: "/ai-assistant", label: "AI Assistant" },
  ] as const;

  const service = [
    { href: "/home", label: "Dashboard" },
    { href: "/inventory", label: "Inventory" },
    { href: "/customers", label: "Customers" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/quotations", label: "Quotations" },
    { href: "/jobs", label: "Jobs" },
    { href: "/invoices", label: "Invoices" },
    { href: "/payments", label: "Payments" },
    { href: "/employees", label: "Employees" },
    { href: "/expenses", label: "Expenses" },
    { href: "/reports", label: "Reports" },
    { href: "/marketing", label: "Marketing" },
    { href: "/analytics", label: "Analytics" },
    { href: "/financial-reports", label: "Financial Reports" },
    { href: "/settings", label: "Settings" },
    { href: "/ai-assistant", label: "AI Assistant" },
  ] as const;

  const both = [...FULL_APP_NAV];

  if (type === "RETAIL") return retail;
  if (type === "SERVICE") return service;
  return both;
}
