"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export type FinancialSection = "income" | "balance" | "bank";

const SECTIONS: { id: FinancialSection; label: string }[] = [
  { id: "income", label: "Income Statement" },
  { id: "balance", label: "Balance Sheet" },
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
    router.replace(`/financial-reports?${next.toString()}`);
  }

  return (
    <div className="stack">
      <div className="financial-reports-nav" role="tablist" aria-label="Financial reports">
        {SECTIONS.map((s) => (
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

      {activeSection ? (
        <div className="financial-reports-content">{children}</div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Choose Income Statement, Balance Sheet, or Bank to view financial details.
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
