import type { ReactNode } from "react";
import { formatTTD } from "@/lib/money";
import { Panel } from "@/components/ui";

export function PeriodSummaryCards({
  summary,
  variant = "analytics",
}: {
  summary: {
    income: number;
    expenses: number;
    profit: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    invoiceCount: number;
    jobCount: number;
    quotationCount: number;
    expenseCount: number;
    paymentCount: number;
  };
  variant?: "analytics" | "financial";
}) {
  if (variant === "financial") {
    return (
      <div className="kpi-grid">
        <div className="report-stat sea">
          <div className="label">Gross sales</div>
          <div className="value money">{formatTTD(summary.grossSales)}</div>
        </div>
        <div className="report-stat accent">
          <div className="label">Refunds</div>
          <div className="value money">{formatTTD(summary.refunds)}</div>
        </div>
        <div className="report-stat sea">
          <div className="label">Net sales</div>
          <div className="value money">{formatTTD(summary.netSales)}</div>
        </div>
        <div className="report-stat accent">
          <div className="label">Expenses</div>
          <div className="value money">{formatTTD(summary.expenses)}</div>
        </div>
        <div className="report-stat sea">
          <div className="label">Cash received</div>
          <div className="value money">{formatTTD(summary.income)}</div>
        </div>
        <div className="report-stat accent">
          <div className="label">Net (cash − expenses)</div>
          <div className="value money">{formatTTD(summary.profit)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-grid">
      <div className="report-stat sea">
        <div className="label">Cash received</div>
        <div className="value money">{formatTTD(summary.income)}</div>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          {summary.paymentCount} payments
        </div>
      </div>
      <div className="report-stat accent">
        <div className="label">Expenses</div>
        <div className="value money">{formatTTD(summary.expenses)}</div>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          {summary.expenseCount} entries
        </div>
      </div>
      <div className="report-stat sea">
        <div className="label">Net cash flow</div>
        <div className="value money">{formatTTD(summary.profit)}</div>
      </div>
      <div className="report-stat accent">
        <div className="label">POS net sales</div>
        <div className="value money">{formatTTD(summary.netSales)}</div>
      </div>
      <div className="report-stat sea">
        <div className="label">Jobs created</div>
        <div className="value">{summary.jobCount}</div>
      </div>
      <div className="report-stat accent">
        <div className="label">Quotations</div>
        <div className="value">{summary.quotationCount}</div>
      </div>
      <div className="report-stat sea">
        <div className="label">Invoices issued</div>
        <div className="value">{summary.invoiceCount}</div>
      </div>
    </div>
  );
}

export function PeriodFilterPanel({ children }: { children: ReactNode }) {
  return (
    <Panel style={{ padding: "1.25rem" }}>{children}</Panel>
  );
}
