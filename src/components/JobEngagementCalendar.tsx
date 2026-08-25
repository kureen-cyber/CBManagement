"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateJobEngagement } from "@/app/actions";
import { formatAppDate, formatAppMonthYear } from "@/lib/timezone";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function JobEngagementCalendar({
  jobId,
  jobNumber,
  initialStart,
  initialEnd,
}: {
  jobId: string;
  jobNumber: string;
  initialStart?: string | null;
  initialEnd?: string | null;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [startDate, setStartDate] = useState<string | null>(initialStart || null);
  const [endDate, setEndDate] = useState<string | null>(initialEnd || null);
  const [picking, setPicking] = useState<"start" | "end">(
    initialStart && !initialEnd ? "end" : "start",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const count = daysInMonth(viewYear, viewMonth);
    const out: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let day = 1; day <= count; day++) {
      const iso = toIsoDate(new Date(viewYear, viewMonth, day));
      out.push({ day, iso });
    }
    return out;
  }, [viewYear, viewMonth]);

  const monthLabel = formatAppMonthYear(new Date(viewYear, viewMonth, 1));

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function onPick(iso: string) {
    setError(null);
    if (picking === "start") {
      setStartDate(iso);
      setEndDate(null);
      setPicking("end");
      return;
    }
    if (!startDate) {
      setStartDate(iso);
      setPicking("end");
      return;
    }
    if (parseIso(iso) < parseIso(startDate)) {
      setStartDate(iso);
      setEndDate(null);
      setPicking("end");
      return;
    }
    setEndDate(iso);
    setPicking("start");
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Select both a start and end date on the calendar");
      return;
    }
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    setError(null);
    startTransition(async () => {
      const result = await updateJobEngagement(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.push(`/jobs/${jobId}`);
      router.refresh();
    });
  }

  const start = startDate ? parseIso(startDate) : null;
  const end = endDate ? parseIso(endDate) : null;

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="info-banner">
        Set the period of engagement for <strong>{jobNumber}</strong>. Click a start date,
        then an end date on the calendar.
      </div>

      <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={picking === "start" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
          onClick={() => setPicking("start")}
        >
          Start: {startDate ? formatAppDate(parseIso(startDate)) : "Select"}
        </button>
        <button
          type="button"
          className={picking === "end" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
          onClick={() => setPicking("end")}
        >
          End: {endDate ? formatAppDate(parseIso(endDate)) : "Select"}
        </button>
      </div>

      <div className="engagement-calendar panel" style={{ padding: "1rem" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftMonth(-1)}>
            ← Prev
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftMonth(1)}>
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
            const date = parseIso(cell.iso);
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
                onClick={() => onPick(cell.iso)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <div className="badge badge-danger">{error}</div> : null}

      <div className="row" style={{ gap: "0.5rem" }}>
        <button className="btn btn-primary" type="submit" disabled={pending || !startDate || !endDate}>
          {pending ? "Saving…" : "Save period of engagement"}
        </button>
      </div>
    </form>
  );
}
