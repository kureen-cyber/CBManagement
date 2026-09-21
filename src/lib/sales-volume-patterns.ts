import { prisma } from "@/lib/prisma";
import { isOwnerDrawingsCustomer } from "@/lib/owner-drawings";
import { WALK_IN_CUSTOMER_NAME } from "@/lib/receivables";
import { APP_TIMEZONE } from "@/lib/timezone";

export type SalesVolumeBar = {
  key: string;
  label: string;
  /** Sales total in cents */
  amount: number;
  /** Number of completed sales */
  count: number;
};

export type SalesVolumePatterns = {
  byWeekday: SalesVolumeBar[];
  byHour: SalesVolumeBar[];
  /** Only customers (including Walk-in) with sales in the period. */
  byCustomer: SalesVolumeBar[];
};

const WEEKDAY_ORDER = [
  { key: "Mon", label: "Mon" },
  { key: "Tue", label: "Tue" },
  { key: "Wed", label: "Wed" },
  { key: "Thu", label: "Thu" },
  { key: "Fri", label: "Fri" },
  { key: "Sat", label: "Sat" },
  { key: "Sun", label: "Sun" },
] as const;

const WEEKDAY_FROM_SHORT: Record<string, string> = {
  Mon: "Mon",
  Tue: "Tue",
  Wed: "Wed",
  Thu: "Thu",
  Fri: "Fri",
  Sat: "Sat",
  Sun: "Sun",
};

function appWeekdayAndHour(d: Date): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);

  const weekdayRaw = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hourRaw = parts.find((p) => p.type === "hour")?.value || "0";
  const weekday = WEEKDAY_FROM_SHORT[weekdayRaw] || "Mon";
  const hour = Math.min(23, Math.max(0, Number.parseInt(hourRaw, 10) || 0));
  return { weekday, hour };
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function customerBarIdentity(name: string | null | undefined, customerId: string | null): {
  key: string;
  label: string;
} | null {
  const trimmed = String(name || "").trim();
  if (isOwnerDrawingsCustomer(trimmed)) return null;
  if (
    !customerId ||
    !trimmed ||
    trimmed.toLowerCase() === WALK_IN_CUSTOMER_NAME.toLowerCase() ||
    trimmed.toLowerCase() === "walk-in"
  ) {
    return { key: "walk-in", label: "Walk-in" };
  }
  return { key: customerId, label: trimmed };
}

/**
 * Aggregate completed POS sales by weekday, hour of day, and customer (Trinidad time).
 */
export async function fetchSalesVolumePatterns(
  companyId: string,
  start: Date,
  end: Date,
): Promise<SalesVolumePatterns> {
  const sales = await prisma.sale.findMany({
    where: {
      companyId,
      status: "COMPLETED",
      isRefund: false,
      soldAt: { gte: start, lte: end },
    },
    select: { soldAt: true, total: true, customerId: true, customer: { select: { name: true } } },
  });

  const weekdayTotals = new Map<string, { amount: number; count: number }>();
  for (const w of WEEKDAY_ORDER) weekdayTotals.set(w.key, { amount: 0, count: 0 });

  const hourTotals = Array.from({ length: 24 }, () => ({ amount: 0, count: 0 }));
  const customerTotals = new Map<string, { label: string; amount: number; count: number }>();

  for (const sale of sales) {
    const { weekday, hour } = appWeekdayAndHour(sale.soldAt);
    const day = weekdayTotals.get(weekday);
    if (day) {
      day.amount += sale.total;
      day.count += 1;
    }
    const slot = hourTotals[hour]!;
    slot.amount += sale.total;
    slot.count += 1;

    const identity = customerBarIdentity(sale.customer?.name, sale.customerId);
    if (!identity) continue;
    const prev = customerTotals.get(identity.key);
    if (prev) {
      prev.amount += sale.total;
      prev.count += 1;
    } else {
      customerTotals.set(identity.key, {
        label: identity.label,
        amount: sale.total,
        count: 1,
      });
    }
  }

  const byCustomer = [...customerTotals.entries()]
    .filter(([, t]) => t.count > 0)
    .sort((a, b) => b[1].amount - a[1].amount || a[1].label.localeCompare(b[1].label))
    .map(([key, t]) => ({ key, label: t.label, amount: t.amount, count: t.count }));

  return {
    byWeekday: WEEKDAY_ORDER.map((w) => {
      const t = weekdayTotals.get(w.key)!;
      return { key: w.key, label: w.label, amount: t.amount, count: t.count };
    }),
    byHour: hourTotals.map((t, hour) => ({
      key: String(hour),
      label: hourLabel(hour),
      amount: t.amount,
      count: t.count,
    })),
    byCustomer,
  };
}
