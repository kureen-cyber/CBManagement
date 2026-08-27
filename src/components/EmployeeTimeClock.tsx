"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clockInEmployee,
  clockOutEmployee,
  updateTimeEntryPayment,
} from "@/app/actions";
import { formatTTD, fromCents } from "@/lib/money";
import { formatAppDate, formatAppDateTimeInZone } from "@/lib/timezone";
import { Panel } from "@/components/ui";

export type EmployeeTimeRow = {
  id: string;
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  hours: number;
  hourlyRate: number;
  paymentAmount: number | null;
};

function formatClockTime(value: string | null) {
  if (!value) return "—";
  return formatAppDateTimeInZone(value, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function paymentForEntry(row: EmployeeTimeRow, employeeRate: number) {
  const rate = row.hourlyRate > 0 ? row.hourlyRate : employeeRate;
  if (rate > 0 && row.clockOutAt) {
    return Math.round(row.hours * rate);
  }
  return row.paymentAmount;
}

export function EmployeeTimeClock({
  employeeId,
  employeeRate,
  hasOpenShift,
  entries,
}: {
  employeeId: string;
  employeeRate: number;
  hasOpenShift: boolean;
  entries: EmployeeTimeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const noRate = employeeRate <= 0;

  function refresh() {
    router.refresh();
  }

  function onClockIn() {
    setError(null);
    const fd = new FormData();
    fd.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await clockInEmployee(fd);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not clock in");
      }
    });
  }

  function onClockOut() {
    setError(null);
    const fd = new FormData();
    fd.set("employeeId", employeeId);
    startTransition(async () => {
      try {
        await clockOutEmployee(fd);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not clock out");
      }
    });
  }

  function onSavePayment(e: FormEvent<HTMLFormElement>, entryId: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", entryId);
    startTransition(async () => {
      try {
        await updateTimeEntryPayment(fd);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save payment");
      }
    });
  }

  return (
    <div className="stack">
      {error ? (
        <div className="info-banner" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <div className="row" style={{ gap: "0.65rem" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || hasOpenShift}
          onClick={onClockIn}
        >
          {pending && !hasOpenShift ? "Working…" : "Clock In"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || !hasOpenShift}
          onClick={onClockOut}
        >
          {pending && hasOpenShift ? "Working…" : "Clock Out"}
        </button>
        {hasOpenShift ? (
          <span className="badge badge-ok">Currently clocked in</span>
        ) : (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Not clocked in
          </span>
        )}
      </div>

      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Clocked in</th>
              <th>Clocked out</th>
              <th>Hours worked</th>
              <th>Payment for period</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              const open = Boolean(row.clockInAt && !row.clockOutAt);
              const payment = paymentForEntry(row, employeeRate);
              return (
                <tr key={row.id}>
                  <td>{formatAppDate(row.date)}</td>
                  <td>{formatClockTime(row.clockInAt)}</td>
                  <td>{open ? "—" : formatClockTime(row.clockOutAt)}</td>
                  <td>{open ? "—" : `${row.hours.toFixed(2)} h`}</td>
                  <td>
                    {open ? (
                      <span className="muted">—</span>
                    ) : noRate ? (
                      <form
                        className="row"
                        style={{ gap: "0.35rem", flexWrap: "nowrap" }}
                        onSubmit={(e) => onSavePayment(e, row.id)}
                      >
                        <input
                          name="paymentAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={
                            row.paymentAmount != null ? String(fromCents(row.paymentAmount)) : ""
                          }
                          placeholder="0.00"
                          style={{ width: "6.5rem" }}
                          disabled={pending}
                        />
                        <button className="btn btn-secondary btn-sm" type="submit" disabled={pending}>
                          Save
                        </button>
                      </form>
                    ) : payment != null ? (
                      <span className="money">{formatTTD(payment)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No working records yet — use Clock In to start.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
