"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import {
  buildPeriodSearchParams,
  parseIsoDate,
  type ResolvedDateRange,
} from "@/lib/date-range";
import { formatAppDate } from "@/lib/timezone";
import { FREE_TIER_MAX_TRANSACTION_DAYS, REPORT_PERIODS, type ReportPeriodId } from "@/lib/tier";

export function PeriodSelector({
  basePath,
  range,
  isFree,
  freeMaxDays = FREE_TIER_MAX_TRANSACTION_DAYS,
}: {
  basePath: string;
  range: ResolvedDateRange;
  isFree: boolean;
  freeMaxDays?: number;
}) {
  const router = useRouter();
  const initialMonth = range.monthKey
    ? range.monthKey.split("-").map(Number)
    : [range.start.getFullYear(), range.start.getMonth() + 1];
  const [viewYear, setViewYear] = useState(initialMonth[0]!);
  const [viewMonth, setViewMonth] = useState(initialMonth[1]! - 1);
  const [pickStart, setPickStart] = useState<string | null>(range.fromIso ?? null);
  const [pickEnd, setPickEnd] = useState<string | null>(range.toIso ?? null);
  const [pickingEnd, setPickingEnd] = useState(false);

  const calendarRange = useMemo(() => {
    if (range.mode === "custom") return { start: range.fromIso, end: range.toIso };
    if (range.mode === "month" && range.monthKey) {
      const [y, m] = range.monthKey.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(y!, m!, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      return { start, end };
    }
    return { start: null, end: null };
  }, [range]);

  function navigate(params: URLSearchParams) {
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function applyPreset(periodId: ReportPeriodId) {
    navigate(buildPeriodSearchParams({ period: periodId }));
  }

  function applyMonth(year: number, month: number) {
    navigate(
      buildPeriodSearchParams({
        monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
      }),
    );
  }

  function applyCustom(from: string, to: string) {
    navigate(buildPeriodSearchParams({ from, to }));
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function onPickDay(iso: string) {
    if (!pickingEnd || !pickStart) {
      setPickStart(iso);
      setPickEnd(null);
      setPickingEnd(true);
      return;
    }
    if (parseIsoDate(iso)! < parseIsoDate(pickStart)!) {
      setPickStart(iso);
      setPickEnd(null);
      setPickingEnd(true);
      return;
    }
    setPickEnd(iso);
    setPickingEnd(false);
    applyCustom(pickStart, iso);
  }

  const displayStart = pickStart ?? calendarRange.start;
  const displayEnd = pickEnd ?? calendarRange.end;

  return (
    <div className="period-selector stack" style={{ gap: "0.85rem" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <strong>{range.label}</strong>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.15rem" }}>
            {formatAppDate(range.start)} – {formatAppDate(range.end)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => applyMonth(new Date().getFullYear(), new Date().getMonth())}
        >
          This month
        </button>
      </div>

      {range.clamped ? (
        <div className="period-clamp-banner" role="status">
          Free tiers are capped at {freeMaxDays} days. Your selection was adjusted to fit that window.
        </div>
      ) : null}

      <div className="period-chooser" role="group" aria-label="Quick period">
        {REPORT_PERIODS.map((p) => {
          const disabled = isFree && !p.freeAllowed;
          const active = range.mode === "preset" && range.periodId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={active ? "period-chip active" : "period-chip"}
              disabled={disabled}
              title={disabled ? `Upgrade to unlock ${p.label.toLowerCase()}` : undefined}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
              {disabled ? <span className="period-chip-note">Standard+</span> : null}
            </button>
          );
        })}
      </div>

      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Click a month name to view that full month, or click two dates on the calendar for a custom
        range.
      </p>

      <MonthCalendar
        viewYear={viewYear}
        viewMonth={viewMonth}
        rangeStart={displayStart}
        rangeEnd={displayEnd}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        onSelectMonth={() => applyMonth(viewYear, viewMonth)}
        onPickDay={onPickDay}
      />

      {pickStart && !pickEnd && pickingEnd ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Start: {pickStart ? formatAppDate(parseIsoDate(pickStart)) : "—"} — pick an end date
        </p>
      ) : null}

      {isFree ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Last 90 days is available on Standard plans. Free tiers can view up to {freeMaxDays} days.
        </p>
      ) : null}
    </div>
  );
}
