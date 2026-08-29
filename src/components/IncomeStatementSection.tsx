"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MonthlyIncomeStatementTable } from "@/components/MonthlyIncomeStatement";
import { SingleMonthIncomeStatementTable } from "@/components/SingleMonthIncomeStatement";
import { IncomeStatementYearSelector } from "@/components/IncomeStatementYearSelector";
import { EmailIncomeStatementButton } from "@/components/EmailIncomeStatementButton";
import type { MonthlyIncomeStatement, SingleMonthIncomeStatement } from "@/lib/monthly-income-statement";
import { INCOME_STATEMENT_MONTHS } from "@/lib/monthly-income-statement";

type View = "yearly" | "monthly";

export function IncomeStatementSection({
  yearlyStatement,
  monthlyStatement,
  statementYear,
  years,
  statementMonth,
}: {
  yearlyStatement: MonthlyIncomeStatement;
  monthlyStatement: SingleMonthIncomeStatement;
  statementYear: number;
  years: number[];
  statementMonth: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") === "monthly" ? "monthly" : "yearly") as View;

  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "income");
    params.set("view", next);
    if (next === "monthly" && !params.get("month")) {
      params.set("month", String(new Date().getMonth() + 1));
    }
    router.replace(`/financial-reports?${params.toString()}`);
  }

  function setMonth(month: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "income");
    params.set("view", "monthly");
    params.set("month", String(month));
    params.set("year", String(statementYear));
    router.replace(`/financial-reports?${params.toString()}`);
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div className="financial-reports-nav" role="tablist" aria-label="Income statement view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "yearly"}
            className={view === "yearly" ? "settings-subtab active" : "settings-subtab"}
            onClick={() => setView("yearly")}
          >
            Yearly view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "monthly"}
            className={view === "monthly" ? "settings-subtab active" : "settings-subtab"}
            onClick={() => setView("monthly")}
          >
            Monthly view
          </button>
        </div>

        {view === "yearly" ? (
          <IncomeStatementYearSelector year={statementYear} years={years} />
        ) : (
          <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <label className="muted" style={{ fontSize: "0.85rem" }}>
              Month
              <select
                className="input"
                style={{ marginLeft: "0.5rem" }}
                value={statementMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {INCOME_STATEMENT_MONTHS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label} {statementYear}
                  </option>
                ))}
              </select>
            </label>
            <IncomeStatementYearSelector year={statementYear} years={years} />
          </div>
        )}
      </div>

      {view === "yearly" ? (
        <MonthlyIncomeStatementTable statement={yearlyStatement} />
      ) : (
        <>
          <div className="row no-print" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
            >
              Print
            </button>
            <EmailIncomeStatementButton
              year={statementYear}
              month={statementMonth}
            />
          </div>
          <SingleMonthIncomeStatementTable statement={monthlyStatement} />
        </>
      )}
    </div>
  );
}
