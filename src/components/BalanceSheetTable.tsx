import { formatTTD } from "@/lib/money";
import type { BalanceSheet, BalanceSheetLine } from "@/lib/balance-sheet";

function renderLines(lines: BalanceSheetLine[]) {
  return lines.map((row) => {
    if (row.kind === "section") {
      return (
        <tr key={row.id} className="income-statement-section">
          <td colSpan={2}>
            <strong>{row.label}</strong>
          </td>
        </tr>
      );
    }
    return (
      <tr key={row.id} className={row.kind === "total" ? "income-statement-total" : undefined}>
        <td style={{ paddingLeft: row.indent ? "1.25rem" : 0 }}>{row.label}</td>
        <td className="money" style={{ textAlign: "right" }}>
          {formatTTD(row.amount)}
        </td>
      </tr>
    );
  });
}

export function BalanceSheetTable({ sheet }: { sheet: BalanceSheet }) {
  return (
    <div className="stack income-statement">
      <div className="income-statement-header">
        <div className="income-statement-business">{sheet.businessName}</div>
        <h3 style={{ margin: "0.35rem 0 0" }}>Balance Sheet</h3>
        <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
          As at {sheet.asOfLabel}
        </p>
      </div>

      <div className="table-wrap">
        <table className="data income-statement-table list-dense">
          <thead>
            <tr>
              <th>Line</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {renderLines(sheet.assets)}
            <tr>
              <td colSpan={2} style={{ height: "0.75rem" }} />
            </tr>
            {renderLines(sheet.liabilities)}
            <tr>
              <td colSpan={2} style={{ height: "0.75rem" }} />
            </tr>
            {renderLines(sheet.equity)}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
        Cash from bank ledger; receivables and payables from open balances; inventory total is
        on-hand quantity × unit cost for variants and for items without variants. Owner&apos;s
        equity is the balancing figure (assets − liabilities).
      </p>
    </div>
  );
}
