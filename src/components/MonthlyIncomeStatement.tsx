import { formatTTD } from "@/lib/money";
import type { MonthlyIncomeStatement } from "@/lib/monthly-income-statement";
import { appYearMonth } from "@/lib/timezone";

function cellClass(kind: string) {
  if (kind === "total" || kind === "result") return "money is-total";
  return "money";
}

export function MonthlyIncomeStatementTable({
  statement,
}: {
  statement: MonthlyIncomeStatement;
}) {
  const start = statement.startedAt ? appYearMonth(statement.startedAt) : null;
  const firstMonth =
    start && start.year === statement.year ? Math.max(0, start.monthIndex) : 0;
  const visibleLabels = statement.monthLabels.slice(firstMonth);
  const colSpan = visibleLabels.length + 2;

  return (
    <div className="stack income-statement">
      <div className="income-statement-header">
        <div className="income-statement-business">{statement.businessName}</div>
        <h3>Monthly Income Statement — {statement.year}</h3>
      </div>

      <div className="table-wrap income-statement-scroll">
        <table className="data income-statement-table">
          <thead>
            <tr>
              <th className="income-statement-label-col">Line</th>
              {visibleLabels.map((label) => (
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
                    <td colSpan={colSpan}>
                      <strong>{row.label}</strong>
                    </td>
                  </tr>
                );
              }
              const months = (row.months || []).slice(firstMonth);
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
                  <td>{row.label}</td>
                  {months.map((cents, i) => (
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
    </div>
  );
}
