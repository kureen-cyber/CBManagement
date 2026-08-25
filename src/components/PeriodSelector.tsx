"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import {
  buildPeriodSearchParams,
  parseIsoDate,
  toIsoDate,
  type ResolvedDateRange,
} from "@/lib/date-range";
import { formatAppDate } from "@/lib/timezone";
import { FREE_TIER_MAX_TRANSACTION_DAYS, REPORT_PERIODS, type ReportPeriodId } from "@/lib/tier";

function CalendarIcon() {
  return (
    <svg
      className="period-card-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="7" y="13" width="3" height="3" rx="0.6" fill="currentColor" />
      <rect x="14" y="13" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

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
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const initialMonth = range.monthKey
    ? range.monthKey.split("-").map(Number)
    : [range.start.getFullYear(), range.start.getMonth() + 1];
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialMonth[0]!);
  const [viewMonth, setViewMonth] = useState(initialMonth[1]! - 1);
  const [pickStart, setPickStart] = useState<string | null>(range.fromIso ?? null);
  const [pickEnd, setPickEnd] = useState<string | null>(range.toIso ?? null);
  const [pickingEnd, setPickingEnd] = useState(false);

  useEffect(() => {
    setPickStart(range.fromIso ?? null);
    setPickEnd(range.toIso ?? null);
    setPickingEnd(false);
    if (range.monthKey) {
      const [y, m] = range.monthKey.split("-").map(Number);
      setViewYear(y!);
      setViewMonth(m! - 1);
    } else {
      setViewYear(range.start.getFullYear());
      setViewMonth(range.start.getMonth());
    }
  }, [range]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const calendarRange = useMemo(() => {
    if (range.mode === "custom") return { start: range.fromIso, end: range.toIso };
    if (range.mode === "month" && range.monthKey) {
      const [y, m] = range.monthKey.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const last = new Date(y!, m!, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      return { start, end };
    }
    return {
      start: toIsoDate(range.start),
      end: toIsoDate(range.end),
    };
  }, [range]);

  function navigate(params: URLSearchParams) {
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function applyPreset(periodId: ReportPeriodId) {
    setOpen(false);
    navigate(buildPeriodSearchParams({ period: periodId }));
  }

  function applyMonth(year: number, month: number) {
    setOpen(false);
    navigate(
      buildPeriodSearchParams({
        monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
      }),
    );
  }

  function applyCustom(from: string, to: string) {
    setOpen(false);
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
  const cardStart = formatAppDate(range.start);
  const cardEnd = formatAppDate(range.end);

  return (
    <div className="period-selector stack" style={{ gap: "0.75rem" }} ref={rootRef}>
      {range.clamped ? (
        <div className="period-clamp-banner" role="status">
          Free tiers are capped at {freeMaxDays} days. Your selection was adjusted to fit that window.
        </div>
      ) : null}

      <div className="period-card-wrap">
        <button
          type="button"
          className={open ? "period-range-card open" : "period-range-card"}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarIcon />
          <span className="period-range-text">
            <span className="period-range-label">Period</span>
            <strong className="period-range-dates">
              {cardStart} – {cardEnd}
            </strong>
          </span>
          <span className="period-range-chevron" aria-hidden="true">
            {open ? "▴" : "▾"}
          </span>
        </button>

        {open ? (
          <div id={panelId} className="period-calendar-panel" role="region" aria-label="Choose period">
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
              <button
                type="button"
                className="period-chip"
                onClick={() => applyMonth(new Date().getFullYear(), new Date().getMonth())}
              >
                This month
              </button>
            </div>

            <p className="muted" style={{ margin: "0.65rem 0 0.5rem", fontSize: "0.82rem" }}>
              Click the month name for the full month, or pick a start and end date.
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
              <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
                Start: {formatAppDate(parseIsoDate(pickStart))} — pick an end date
              </p>
            ) : null}

            {isFree ? (
              <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
                Free tiers can view up to {freeMaxDays} days.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
