"use client";

import { downloadExcel } from "@/lib/excel-export";
import { JOB_STATUS_LABELS } from "@/lib/job-status";
import { formatTTD, fromCents } from "@/lib/money";

export type ActiveJobExportRow = {
  number: string;
  title: string;
  customerName: string;
  quotationNumber: string | null;
  startDate: string;
  endDate: string;
  contract: number;
  labour: number;
  materials: number;
  expenses: number;
  profit: number;
  status: string;
  notes: string;
  employees: string;
};

export function JobsActiveExport({
  jobs,
}: {
  jobs: ActiveJobExportRow[];
}) {
  const headers = [
    "Job",
    "Title",
    "Customer",
    "Quotation",
    "Start",
    "End",
    "Contract (TTD)",
    "Labour (TTD)",
    "Materials (TTD)",
    "Expenses (TTD)",
    "Profit (TTD)",
    "Status",
    "Employees",
    "Notes",
  ];

  function money(cents: number) {
    return fromCents(cents);
  }

  function statusLabel(status: string) {
    return JOB_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  }

  return (
    <div className="row report-export-bar no-print" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() =>
          downloadExcel({
            filename: "cbmanagement-active-jobs.xlsx",
            sheetName: "Active jobs",
            headers,
            rows: jobs.map((j) => [
              j.number,
              j.title,
              j.customerName,
              j.quotationNumber,
              j.startDate,
              j.endDate,
              money(j.contract),
              money(j.labour),
              money(j.materials),
              money(j.expenses),
              money(j.profit),
              statusLabel(j.status),
              j.employees,
              j.notes,
            ]),
          })
        }
      >
        Export Excel
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}

export function JobsActivePrintDocument({
  jobs,
  companyName,
}: {
  jobs: ActiveJobExportRow[];
  companyName: string;
}) {
  function statusLabel(status: string) {
    return JOB_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  }

  return (
    <div className="print-only jobs-print-doc">
      <h1>Active jobs</h1>
      <p className="muted">
        {companyName}
        {jobs.length ? ` · ${jobs.length} active job${jobs.length === 1 ? "" : "s"}` : ""}
      </p>
      {jobs.length === 0 ? (
        <p>No active jobs.</p>
      ) : (
        jobs.map((j) => (
          <section key={j.number} className="jobs-print-card">
            <h2>
              {j.number} — {j.title}
            </h2>
            <p>
              <strong>Customer:</strong> {j.customerName}
              {j.quotationNumber ? (
                <>
                  {" "}
                  · <strong>Quotation:</strong> {j.quotationNumber}
                </>
              ) : null}
            </p>
            <p>
              <strong>Engagement:</strong> {j.startDate} → {j.endDate} · <strong>Status:</strong>{" "}
              {statusLabel(j.status)}
            </p>
            <p>
              <strong>Contract:</strong> {formatTTD(j.contract)} · <strong>Labour:</strong>{" "}
              {formatTTD(j.labour)} · <strong>Materials:</strong> {formatTTD(j.materials)} ·{" "}
              <strong>Expenses:</strong> {formatTTD(j.expenses)} · <strong>Profit:</strong>{" "}
              {formatTTD(j.profit)}
            </p>
            {j.employees ? (
              <p>
                <strong>Employees:</strong> {j.employees}
              </p>
            ) : null}
            <p>
              <strong>Notes</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{j.notes || "—"}</p>
          </section>
        ))
      )}
    </div>
  );
}
