"use client";

import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import { Panel } from "@/components/ui";

export type PayslipRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  hoursWorked: number;
  grossPay: number;
  documentHtml: string;
  createdAt: string;
};

function printHtml(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function EmployeePayslipRecords({ payslips }: { payslips: PayslipRecord[] }) {
  return (
    <Panel style={{ padding: "1.25rem" }}>
      <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem" }}>Payslip records</h2>
      <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
        Saved payslips for this employee.
      </p>
      <div className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Generated</th>
              <th>Period</th>
              <th>Hours</th>
              <th>Gross pay</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p.id}>
                <td className="muted">{formatAppDate(p.createdAt)}</td>
                <td>
                  {formatAppDate(p.periodStart)} – {formatAppDate(p.periodEnd)}
                </td>
                <td>{p.hoursWorked.toFixed(2)} h</td>
                <td className="money">{formatTTD(p.grossPay)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => printHtml(p.documentHtml)}
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))}
            {payslips.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No payslips saved yet — use Generate Payslip.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
