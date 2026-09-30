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
  startLabel,
  startYear,
  startMonth,
}: {
  yearlyStatement: MonthlyIncomeStatement;
  monthlyStatement: SingleMonthIncomeStatement;
  statementYear: number;
  years: number[];
  statementMonth: number;
  startLabel: string;
  startYear: number;
  startMonth: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") === "yearly" ? "yearly" : "monthly") as View;

  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "income");
    params.set("view", next);
    if (next === "monthly" && !params.get("month")) {
      params.set("month", String(statementMonth));
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
    <div className="stack income-statement-panel">
      <p className="muted income-statement-start-note">
        Auto-calculating from 1 {startLabel}. Opening inventory, cash on hand, and reserve
        were set by the owner; earlier auto-generated figures are not used.
      </p>
      <div className="row income-statement-toolbar no-print" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
        <div className="financial-reports-nav" role="tablist" aria-label="Income statement view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "yearly"}
            className={view === "yearly" ? "settings-subtab active" : "settings-subtab"}
            onClick={() => setView("yearly")}
          >
            Yearly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "monthly"}
            className={view === "monthly" ? "settings-subtab active" : "settings-subtab"}
            onClick={() => setView("monthly")}
          >
            Monthly
          </button>
        </div>

        <div className="row" style={{ gap: "0.4rem", alignItems: "center" }}>
          {view === "monthly" ? (
            <label className="muted" style={{ fontSize: "0.78rem" }}>
              Month
              <select
                className="input"
                style={{ marginLeft: "0.35rem", padding: "0.3rem 0.45rem" }}
                value={statementMonth}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {INCOME_STATEMENT_MONTHS.map((label, i) => {
                  const month = i + 1;
                  if (statementYear === startYear && month < startMonth) return null;
                  return (
                    <option key={label} value={month}>
                      {label} {statementYear}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
          <IncomeStatementYearSelector year={statementYear} years={years} />
          {view === "monthly" ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                Print
              </button>
              <EmailIncomeStatementButton year={statementYear} month={statementMonth} />
            </>
          ) : null}
        </div>
      </div>

      {view === "yearly" ? (
        <MonthlyIncomeStatementTable statement={yearlyStatement} />
      ) : (
        <SingleMonthIncomeStatementTable statement={monthlyStatement} />
      )}
    </div>
  );
}
