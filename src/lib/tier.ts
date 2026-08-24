/** Plan tiers for CBManagement feature gating. */

export const PLAN_TIERS = ["FREE_RETAIL", "STANDARD"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * When false, every module and limit behaves as Standard / unrestricted.
 * Keep false while the product is in development so all sidebar items and
 * pages are visible. Re-enable after testing and development are complete.
 */
export const TIER_GATING_ENABLED = false;

export const FREE_RETAIL_MAX_POS_REGISTERS = 2;
export const STANDARD_MAX_POS_REGISTERS = 4;
/** Free retail: one store; Standard: up to five. */
export const FREE_RETAIL_MAX_STORES = 1;
export const STANDARD_MAX_STORES = 5;
/** Free tiers may only view transactions within this many past days. */
export const FREE_TIER_MAX_TRANSACTION_DAYS = 31;
/** @deprecated use FREE_TIER_MAX_TRANSACTION_DAYS */
export const FREE_RETAIL_RECEIPT_RETENTION_DAYS = FREE_TIER_MAX_TRANSACTION_DAYS;

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  FREE_RETAIL: "Free Retail",
  STANDARD: "Standard",
};

/** Modules available on the free retail onboarding tier (when gating is on). */
export const FREE_RETAIL_NAV = [
  { href: "/home", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/inventory", label: "Inventory" },
  { href: "/customers", label: "Customers" },
  { href: "/payments", label: "Payments" },
  { href: "/employees", label: "Employees" },
  { href: "/expenses", label: "Expenses" },
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

export type ReportPeriodId = "7" | "14" | "31" | "90" | "month";

export const REPORT_PERIODS: {
  id: ReportPeriodId;
  label: string;
  days: number | "month";
  freeAllowed: boolean;
}[] = [
  { id: "7", label: "Last 7 days", days: 7, freeAllowed: true },
  { id: "14", label: "Last 14 days", days: 14, freeAllowed: true },
  { id: "31", label: "Last 31 days", days: 31, freeAllowed: true },
  { id: "month", label: "This calendar month", days: "month", freeAllowed: true },
  { id: "90", label: "Last 90 days", days: 90, freeAllowed: false },
];

export function parsePlanTier(value: unknown): PlanTier {
  const v = String(value || "").toUpperCase();
  if (v === "FREE_RETAIL" || v === "STANDARD") return v;
  return "STANDARD";
}

export function tierFromBusinessType(businessType: string): PlanTier {
  // During open testing, always Standard so new accounts are unrestricted.
  if (!TIER_GATING_ENABLED) return "STANDARD";
  return String(businessType).toUpperCase() === "RETAIL" ? "FREE_RETAIL" : "STANDARD";
}

export function maxPosRegistersForTier(tier: PlanTier): number {
  if (!TIER_GATING_ENABLED) return STANDARD_MAX_POS_REGISTERS;
  return isFreeRetailTier(tier) ? FREE_RETAIL_MAX_POS_REGISTERS : STANDARD_MAX_POS_REGISTERS;
}

export function isFreeRetailTier(tier: PlanTier): boolean {
  if (!TIER_GATING_ENABLED) return false;
  return tier === "FREE_RETAIL";
}

/** Free retail and future free tiers share the 31-day transaction window. */
export function isFreeTier(tier: PlanTier): boolean {
  if (!TIER_GATING_ENABLED) return false;
  return tier === "FREE_RETAIL";
}

export function isPathAllowedForTier(tier: PlanTier, pathname: string): boolean {
  if (!TIER_GATING_ENABLED) return true;
  if (!isFreeRetailTier(tier)) return true;
  if (FREE_RETAIL_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (pathname.startsWith("/pos")) return true;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/customers")) return true;
  if (pathname.startsWith("/inventory")) return true;
  if (pathname.startsWith("/payments")) return true;
  if (pathname.startsWith("/employees")) return true;
  if (pathname.startsWith("/reports")) return true;
  if (pathname === "/home" || pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/demo-tier")) return true;
  return FREE_RETAIL_ALLOWED.has(pathname as (typeof FREE_RETAIL_NAV)[number]["href"]);
}

export function receiptVisibleSince(tier: PlanTier, now = new Date()): Date | null {
  if (!isFreeTier(tier)) return null;
  const d = new Date(now);
  d.setDate(d.getDate() - FREE_TIER_MAX_TRANSACTION_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseReportPeriod(value: unknown): ReportPeriodId {
  const v = String(value || "");
  if (v === "7" || v === "14" || v === "31" || v === "90" || v === "month") return v;
  return "31";
}

export function resolveReportRange(
  tier: PlanTier,
  periodId: ReportPeriodId,
  now = new Date(),
): { start: Date; end: Date; label: string; clamped: boolean } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const period = REPORT_PERIODS.find((p) => p.id === periodId) || REPORT_PERIODS[2]!;
  let clamped = false;
  let days: number;

  if (period.days === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    if (isFreeTier(tier) && spanDays > FREE_TIER_MAX_TRANSACTION_DAYS) {
      const capped = new Date(end);
      capped.setDate(capped.getDate() - (FREE_TIER_MAX_TRANSACTION_DAYS - 1));
      capped.setHours(0, 0, 0, 0);
      return {
        start: capped,
        end,
        label: `Last ${FREE_TIER_MAX_TRANSACTION_DAYS} days (month capped)`,
        clamped: true,
      };
    }
    return { start, end, label: period.label, clamped: false };
  }

  days = period.days;
  if (isFreeTier(tier) && (!period.freeAllowed || days > FREE_TIER_MAX_TRANSACTION_DAYS)) {
    days = FREE_TIER_MAX_TRANSACTION_DAYS;
    clamped = true;
  }

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return {
    start,
    end,
    label: clamped ? `Last ${days} days (free tier max)` : period.label,
    clamped,
  };
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
