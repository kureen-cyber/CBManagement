import { formatTTD } from "@/lib/money";
import type { SingleMonthIncomeStatement } from "@/lib/monthly-income-statement";

function cellClass(kind: string) {
  if (kind === "total" || kind === "result") return "money is-total";
  return "money";
}

export function SingleMonthIncomeStatementTable({
  statement,
  printId = "single-month-income-statement",
}: {
  statement: SingleMonthIncomeStatement;
  printId?: string;
}) {
  return (
    <div className="stack income-statement" id={printId}>
      <div className="income-statement-header">
        <div className="income-statement-business">{statement.businessName}</div>
        <h3>
          Income Statement — {statement.monthLabel} {statement.year}
        </h3>
      </div>

      <div className="table-wrap">
        <table className="data income-statement-table">
          <thead>
            <tr>
              <th>Line</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.kind === "result"
                    ? "income-statement-result"
                    : row.kind === "total"
                      ? "income-statement-total"
                      : undefined
                }
                title={row.formula || undefined}
              >
                <td>{row.label}</td>
                <td className={cellClass(row.kind)} style={{ textAlign: "right" }}>
                  {formatTTD(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
