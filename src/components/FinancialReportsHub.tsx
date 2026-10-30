"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export type FinancialSection = "income" | "balance" | "supply" | "employee" | "bank";

const ACCOUNTING_SECTIONS: { id: FinancialSection; label: string }[] = [
  { id: "income", label: "Income Statement" },
  { id: "balance", label: "Balance Sheet" },
];

const REFERENCE_SECTIONS: { id: FinancialSection; label: string }[] = [
  { id: "supply", label: "Supply" },
  { id: "employee", label: "Employee" },
  { id: "bank", label: "Bank" },
];

export function FinancialReportsHub({
  activeSection,
  children,
}: {
  activeSection: FinancialSection | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectSection(section: FinancialSection) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("section", section);
    if (section !== "income") {
      next.delete("view");
      next.delete("month");
    }
    if (section !== "bank") {
      next.delete("bankTab");
    }
    router.replace(`/financial-reports?${next.toString()}`);
  }

  return (
    <div className="stack">
      <div className="stack" style={{ gap: "0.65rem" }}>
        <div>
          <div className="muted" style={{ fontSize: "0.78rem", marginBottom: "0.35rem" }}>
            Accounting
          </div>
          <div className="financial-reports-nav" role="tablist" aria-label="Accounting reports">
            {ACCOUNTING_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSection === s.id}
                className={activeSection === s.id ? "settings-subtab active" : "settings-subtab"}
                onClick={() => selectSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="muted" style={{ fontSize: "0.78rem", marginBottom: "0.35rem" }}>
            Reference / forecasting (does not post to the books)
          </div>
          <div
            className="financial-reports-nav"
            role="tablist"
            aria-label="Reference and forecasting"
          >
            {REFERENCE_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSection === s.id}
                className={activeSection === s.id ? "settings-subtab active" : "settings-subtab"}
                onClick={() => selectSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeSection ? (
        <div className="financial-reports-content">{children}</div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Choose an accounting report, or open Supply, Employee, or Bank for reference and
          forecasting.
        </p>
      )}
    </div>
  );
}

export function FinancialSectionBackLink() {
  return (
    <Link href="/financial-reports" className="muted" style={{ fontSize: "0.85rem" }}>
      ← All financial reports
    </Link>
  );
}
