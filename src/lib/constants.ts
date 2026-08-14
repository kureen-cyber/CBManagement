export const NAV_ITEMS = [
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
  { href: "/settings", label: "Settings" },
] as const;

export const EXPENSE_CATEGORIES = [
  "Materials",
  "Transport",
  "Equipment",
  "Utilities",
  "Rent",
  "Fuel",
  "Subcontractor",
  "Office",
  "Other",
] as const;

/** Categories for inventory items and fixed-price services on POS */
export const PRODUCT_CATEGORIES = [
  "General",
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
