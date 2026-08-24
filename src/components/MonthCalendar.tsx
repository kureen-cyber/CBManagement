"use client";

import { useMemo } from "react";
import { parseIsoDate, toIsoDate } from "@/lib/date-range";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MonthCalendar({
  viewYear,
  viewMonth,
  rangeStart,
  rangeEnd,
  onPickDay,
  onPrevMonth,
  onNextMonth,
  onSelectMonth,
}: {
  viewYear: number;
  viewMonth: number;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  onPickDay: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth?: () => void;
}) {
  const today = new Date();

  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const count = daysInMonth(viewYear, viewMonth);
    const out: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let day = 1; day <= count; day++) {
      out.push({ day, iso: toIsoDate(new Date(viewYear, viewMonth, day)) });
    }
    return out;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-TT", {
    month: "long",
    year: "numeric",
  });

  const start = rangeStart ? parseIsoDate(rangeStart) : null;
  const end = rangeEnd ? parseIsoDate(rangeEnd) : null;

  return (
    <div className="engagement-calendar panel" style={{ padding: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPrevMonth}>
          ← Prev
        </button>
        {onSelectMonth ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSelectMonth}>
            {monthLabel}
          </button>
        ) : (
          <strong>{monthLabel}</strong>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onNextMonth}>
          Next →
        </button>
      </div>
      <div className="engagement-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="muted">
            {d}
          </div>
        ))}
      </div>
      <div className="engagement-grid">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="engagement-day empty" />;
          const date = parseIsoDate(cell.iso)!;
          const isStart = start && sameDay(date, start);
          const isEnd = end && sameDay(date, end);
          const inRange =
            start && end && date >= start && date <= end && !isStart && !isEnd;
          const isToday = sameDay(date, today);
          return (
            <button
              key={cell.iso}
              type="button"
              className={[
                "engagement-day",
                isStart || isEnd ? "selected" : "",
                inRange ? "in-range" : "",
                isToday ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onPickDay(cell.iso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
