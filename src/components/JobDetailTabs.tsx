"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { JobReceiptsPanel } from "@/components/JobReceiptsPanel";

type Tab = "overview" | "receipts";

export function JobDetailTabs({
  overview,
  jobId,
  receipts,
}: {
  overview: ReactNode;
  jobId: string;
  receipts: { id: string; label: string | null; receiptData: string; createdAt: string }[];
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
          aria-selected={tab === "receipts"}
          className={tab === "receipts" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("receipts")}
        >
          Upload receipts
        </button>
      </div>

      {tab === "overview" ? overview : null}
      {tab === "receipts" ? <JobReceiptsPanel jobId={jobId} receipts={receipts} /> : null}
    </div>
  );
}
