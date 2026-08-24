"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { JobAssignEmployeesPanel } from "@/components/JobAssignEmployeesPanel";
import { JobReceiptsPanel } from "@/components/JobReceiptsPanel";

type Tab = "overview" | "employees" | "receipts";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  hourlyRate: number;
};

type Assignment = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  hourlyRate: number;
};

export function JobDetailTabs({
  overview,
  jobId,
  jobNumber,
  receipts,
  employees,
  assignments,
}: {
  overview: ReactNode;
  jobId: string;
  jobNumber: string;
  receipts: { id: string; label: string | null; receiptData: string; createdAt: string }[];
  employees: EmployeeOption[];
  assignments: Assignment[];
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="stack">
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={tab === "overview" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "employees"}
          className={tab === "employees" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("employees")}
        >
          Assign employee/s
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "receipts"}
          className={tab === "receipts" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("receipts")}
        >
          Upload receipts
        </button>
      </div>

      {tab === "overview" ? overview : null}
      {tab === "employees" ? (
        <JobAssignEmployeesPanel
          jobId={jobId}
          jobNumber={jobNumber}
          employees={employees}
          assignments={assignments}
        />
      ) : null}
      {tab === "receipts" ? <JobReceiptsPanel jobId={jobId} receipts={receipts} /> : null}
    </div>
  );
}
