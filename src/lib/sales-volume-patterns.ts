import { prisma } from "@/lib/prisma";
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

/**
 * Aggregate completed POS sales by weekday and hour of day (Trinidad time).
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
    select: { soldAt: true, total: true },
  });

  const weekdayTotals = new Map<string, { amount: number; count: number }>();
  for (const w of WEEKDAY_ORDER) weekdayTotals.set(w.key, { amount: 0, count: 0 });

  const hourTotals = Array.from({ length: 24 }, () => ({ amount: 0, count: 0 }));

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
  }

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
  };
}
