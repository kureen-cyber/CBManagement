import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  isFreeTier,
  parseReportPeriod,
  resolveReportRange,
  type PlanTier,
  type ReportPeriodId,
} from "@/lib/tier";
import { formatAppDate, formatAppMonthYear } from "@/lib/timezone";

export type DateRangeParams = {
  period?: string;
  /** YYYY-MM — any calendar month */
  month?: string;
  from?: string;
  to?: string;
};

export type DateRangeMode = "preset" | "month" | "custom";

export type ResolvedDateRange = {
  start: Date;
  end: Date;
  label: string;
  clamped: boolean;
  mode: DateRangeMode;
  periodId?: ReportPeriodId;
  monthKey?: string;
  fromIso?: string;
  toIso?: string;
};

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseMonthKey(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month: month - 1 };
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function clampRangeForTier(
  tier: PlanTier,
  start: Date,
  end: Date,
): { start: Date; end: Date; clamped: boolean } {
  if (!isFreeTier(tier)) return { start, end, clamped: false };
  const maxStart = new Date(end);
  maxStart.setDate(maxStart.getDate() - (FREE_TIER_MAX_TRANSACTION_DAYS - 1));
  maxStart.setHours(0, 0, 0, 0);
  if (start >= maxStart) return { start, end, clamped: false };
  return { start: maxStart, end, clamped: true };
}

export function resolvePageDateRange(
  tier: PlanTier,
  params: DateRangeParams,
  now = new Date(),
): ResolvedDateRange {
  const fromRaw = params.from?.trim();
  const toRaw = params.to?.trim();
  if (fromRaw && toRaw) {
    const startRaw = parseIsoDate(fromRaw);
    const endRaw = parseIsoDate(toRaw);
    if (startRaw && endRaw && startRaw <= endRaw) {
      const end = endOfDay(endRaw);
      const { start, clamped } = clampRangeForTier(tier, startRaw, end);
      const endLabel = parseIsoDate(toIsoDate(endRaw))!;
      return {
        start,
        end,
        clamped,
        mode: "custom",
        fromIso: toIsoDate(startRaw),
        toIso: toIsoDate(endLabel),
        label: `${formatAppDate(start)} – ${formatAppDate(endLabel)}`,
      };
    }
  }

  const monthParsed = params.month ? parseMonthKey(params.month) : null;
  if (monthParsed) {
    const { year, month } = monthParsed;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = endOfDay(new Date(year, month + 1, 0));
    const { start: cs, end: ce, clamped } = clampRangeForTier(tier, start, end);
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    return {
      start: cs,
      end: ce,
      clamped,
      mode: "month",
      monthKey,
      label: formatAppMonthYear(start),
    };
  }

  const periodId = parseReportPeriod(params.period);
  const resolved = resolveReportRange(tier, periodId, now);
  return {
    start: resolved.start,
    end: resolved.end,
    label: resolved.label,
    clamped: resolved.clamped,
    mode: periodId === "month" ? "month" : "preset",
    periodId,
    monthKey: periodId === "month" ? monthKeyFromDate(now) : undefined,
  };
}

export function buildPeriodSearchParams(input: {
  period?: ReportPeriodId;
  monthKey?: string;
  from?: string;
  to?: string;
}): URLSearchParams {
  const sp = new URLSearchParams();
  if (input.from && input.to) {
    sp.set("from", input.from);
    sp.set("to", input.to);
    return sp;
  }
  if (input.monthKey) {
    sp.set("month", input.monthKey);
    return sp;
  }
  if (input.period) {
    sp.set("period", input.period);
  }
  return sp;
}

export async function readDateRangeFromSearchParams(
  searchParams: Promise<DateRangeParams> | DateRangeParams,
  tier: PlanTier,
): Promise<ResolvedDateRange> {
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  return resolvePageDateRange(tier, params);
}
