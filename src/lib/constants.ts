export const NAV_ITEMS = [
  { href: "/home", label: "Dashboard" },
  { href: "/pos", label: "POS" },
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

/** Common units for supplier procurement lines and inventory. */
export const SUPPLY_UNITS = [
  "each",
  "kg",
  "lb",
  "g",
  "case",
  "dozen",
  "pack",
  "box",
  "m",
  "L",
  "bag",
] as const;

/** Supply database item classification for quotations and expenses. */
export const SUPPLY_TYPES = [
  { value: "MATERIAL", label: "Material" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "EQUIPMENT_RENTAL", label: "Equipment rental" },
] as const;

export type SupplyType = (typeof SUPPLY_TYPES)[number]["value"];

export function supplyTypeLabel(type: string): string {
  return SUPPLY_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Suggestion chips only — users can type any expense category. */
export const EXPENSE_CATEGORIES = [
  "Materials",
  "Transport",
  "Equipment",
  "Equipment rental",
  "Utilities",
  "Rent",
  "Fuel",
  "Subcontractor",
  "Office",
  "Other",
] as const;

/** Suggestion chips only — users can type any product/service category name. */
export const PRODUCT_CATEGORIES = [
  "General",
  "Grocery",
  "Personal hygiene",
  "Gift items",
  "Retail",
  "Food & drink",
  "Electronics",
  "Clothing",
  "Hardware",
  "Beauty",
  "Service — labour",
  "Service — repair",
  "Service — consult",
  "Service — fixed price",
  "Other",
] as const;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      !url.includes("YOUR_PROJECT") &&
      key !== "YOUR_ANON_KEY" &&
      url.length > 10 &&
      key.length > 10,
  );
}

/** Demo browsing is off in production builds, even if an env var is set by mistake. */
export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  return false;
}
