/** Plan tiers for CBManagement feature gating. */

export const PLAN_TIERS = ["FREE_RETAIL", "STANDARD"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const FREE_RETAIL_MAX_POS_REGISTERS = 2;
/** Free retail receipts older than this many days are hidden. */
export const FREE_RETAIL_RECEIPT_RETENTION_DAYS = 30;

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  FREE_RETAIL: "Free Retail",
  STANDARD: "Standard",
};

/** Modules available on the free retail onboarding tier. */
export const FREE_RETAIL_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/customers", label: "Customers" },
  { href: "/inventory", label: "Items / Inventory" },
  { href: "/payments", label: "Payments" },
  { href: "/employees", label: "Employees" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

const FREE_RETAIL_ALLOWED = new Set(FREE_RETAIL_NAV.map((i) => i.href));

/** Paths blocked on free retail (and prefixes under them). */
export const FREE_RETAIL_BLOCKED_PREFIXES = [
  "/quotations",
  "/jobs",
  "/invoices",
  "/expenses",
  "/suppliers",
] as const;

export function parsePlanTier(value: unknown): PlanTier {
  const v = String(value || "").toUpperCase();
  if (v === "FREE_RETAIL" || v === "STANDARD") return v;
  return "STANDARD";
}

export function tierFromBusinessType(businessType: string): PlanTier {
  return String(businessType).toUpperCase() === "RETAIL" ? "FREE_RETAIL" : "STANDARD";
}

export function isFreeRetailTier(tier: PlanTier): boolean {
  return tier === "FREE_RETAIL";
}

export function isPathAllowedForTier(tier: PlanTier, pathname: string): boolean {
  if (!isFreeRetailTier(tier)) return true;
  if (FREE_RETAIL_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  // Allow POS receipts under /pos
  if (pathname.startsWith("/pos")) return true;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/customers")) return true;
  if (pathname.startsWith("/inventory")) return true;
  if (pathname.startsWith("/payments")) return true;
  if (pathname.startsWith("/employees")) return true;
  if (pathname.startsWith("/reports")) return true;
  if (pathname === "/" || pathname.startsWith("/api/")) return true;
  // Localhost demo helper
  if (pathname.startsWith("/demo-tier")) return true;
  return FREE_RETAIL_ALLOWED.has(pathname as (typeof FREE_RETAIL_NAV)[number]["href"]);
}

export function receiptVisibleSince(tier: PlanTier, now = new Date()): Date | null {
  if (!isFreeRetailTier(tier)) return null;
  const d = new Date(now);
  d.setDate(d.getDate() - FREE_RETAIL_RECEIPT_RETENTION_DAYS);
  return d;
}

/** True only on local development hosts (never production). */
export function isLocalhostDemoHost(host?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const h = String(host || "").toLowerCase();
  return (
    h.startsWith("localhost") ||
    h.startsWith("127.0.0.1") ||
    h.startsWith("[::1]") ||
    h.endsWith(".localhost")
  );
}
