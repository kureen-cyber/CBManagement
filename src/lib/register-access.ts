export const POS_REGISTER_COOKIE = "cbm_pos_register";

export type RegisterAccess = {
  registerId: string | null;
  isPrimary: boolean;
  /** Limited cashier: POS + stock only */
  isLimitedCashier: boolean;
  canVoidTickets: boolean;
  canEditDiscounts: boolean;
  canManageInventory: boolean;
  canRefund: boolean;
};

export const LIMITED_CASHIER_NAV = [
  { href: "/pos", label: "POS" },
  { href: "/inventory", label: "Stock levels" },
] as const;

export const LIMITED_CASHIER_ALLOWED: Set<string> = new Set(
  LIMITED_CASHIER_NAV.map((i) => i.href),
);

export function isLimitedCashierPathAllowed(pathname: string): boolean {
  if (LIMITED_CASHIER_ALLOWED.has(pathname)) return true;
  if (pathname.startsWith("/pos/")) return true;
  return false;
}

/** Primary = lowest sortOrder, then oldest createdAt. */
export function pickPrimaryRegisterId(
  registers: { id: string; sortOrder: number; createdAt: Date }[],
): string | null {
  if (!registers.length) return null;
  const sorted = [...registers].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]?.id ?? null;
}

export function resolveRegisterAccess(
  registers: { id: string; sortOrder: number; createdAt: Date }[],
  activeRegisterId: string | null | undefined,
): RegisterAccess {
  const primaryId = pickPrimaryRegisterId(registers);
  const activeId = activeRegisterId || null;
  const known = activeId ? registers.some((r) => r.id === activeId) : false;
  const registerId = known ? activeId : primaryId;
  const isPrimary = !registerId || registerId === primaryId;
  const isLimitedCashier = Boolean(registerId && !isPrimary);

  return {
    registerId,
    isPrimary,
    isLimitedCashier,
    canVoidTickets: isPrimary,
    canEditDiscounts: isPrimary,
    canManageInventory: isPrimary,
    canRefund: true,
  };
}
