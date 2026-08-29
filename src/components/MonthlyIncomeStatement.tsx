import { formatTTD } from "@/lib/money";
import type { MonthlyIncomeStatement } from "@/lib/monthly-income-statement";

function cellClass(kind: string) {
  if (kind === "total" || kind === "result") return "money is-total";
  return "money";
}

export function MonthlyIncomeStatementTable({
  statement,
}: {
  statement: MonthlyIncomeStatement;
}) {
  return (
    <div className="stack income-statement">
      <div className="income-statement-header">
        <div className="income-statement-business">{statement.businessName}</div>
        <h3 style={{ margin: "0.35rem 0 0" }}>Monthly Income Statement</h3>
        <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
          For the Month Ended: {statement.year}
        </p>
      </div>

      <div className="table-wrap income-statement-scroll">
        <table className="data income-statement-table">
          <thead>
            <tr>
              <th className="income-statement-label-col">Line</th>
              {statement.monthLabels.map((label) => (
                <th key={label} className="income-statement-month">
                  {label}
                </th>
              ))}
              <th className="income-statement-month">Total</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => {
              if (row.kind === "section") {
                return (
                  <tr key={row.id} className="income-statement-section">
                    <td colSpan={14}>
                      <strong>{row.label}</strong>
                    </td>
                  </tr>
                );
              }
              return (
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
                  <td>
                    {row.label}
                    {row.formula ? (
                      <span className="muted income-statement-formula"> = {row.formula}</span>
                    ) : null}
                  </td>
                  {(row.months || []).map((cents, i) => (
                    <td key={`${row.id}-${i}`} className={cellClass(row.kind)}>
                      {formatTTD(cents)}
                    </td>
                  ))}
                  <td className={cellClass(row.kind)}>{formatTTD(row.total ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
        Hover formula rows for the calculation used. Inventory uses current stock rolled back with
        stock movements. Purchases come from supplier purchases; direct labour from completed time
        clock entries; salaries include payslips and salary/wage expenses.
      </p>
    </div>
  );
}
