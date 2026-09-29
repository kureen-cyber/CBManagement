"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { JobNotesPanel } from "@/components/JobNotesPanel";
import { JobReceiptsPanel } from "@/components/JobReceiptsPanel";

type Tab = "overview" | "notes" | "receipts";

export function JobDetailTabs({
  overview,
  jobId,
  notes,
  receipts,
}: {
  overview: ReactNode;
  jobId: string;
  jobNumber?: string;
  notes: string;
  receipts: { id: string; label: string | null; receiptData: string; createdAt: string }[];
  /** @deprecated Employees are managed only on the Employees page. */
  employees?: unknown;
  /** @deprecated Employees are managed only on the Employees page. */
  assignments?: unknown;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="stack">
      <div className="settings-subtabs no-print" role="tablist">
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
          aria-selected={tab === "notes"}
          className={tab === "notes" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("notes")}
        >
          Notes
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
      {tab === "notes" ? <JobNotesPanel key={notes} jobId={jobId} notes={notes} /> : null}
      {tab === "receipts" ? <JobReceiptsPanel jobId={jobId} receipts={receipts} /> : null}
    </div>
  );
}
