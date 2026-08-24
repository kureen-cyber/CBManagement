"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { InvoiceAssignEmployeesPanel } from "@/components/InvoiceAssignEmployeesPanel";

type Tab = "invoice" | "employees";

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

export function InvoiceDetailTabs({
  invoiceView,
  invoiceId,
  jobNumber,
  employees,
  assignments,
}: {
  invoiceView: ReactNode;
  invoiceId: string;
  jobNumber: string | null;
  employees: EmployeeOption[];
  assignments: Assignment[];
}) {
  const [tab, setTab] = useState<Tab>("invoice");

  return (
    <div className="stack">
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "invoice"}
          className={tab === "invoice" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("invoice")}
        >
          Invoice
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
      </div>

      {tab === "invoice" ? invoiceView : null}
      {tab === "employees" ? (
        <InvoiceAssignEmployeesPanel
          invoiceId={invoiceId}
          jobNumber={jobNumber}
          employees={employees}
          assignments={assignments}
        />
      ) : null}
    </div>
  );
}
