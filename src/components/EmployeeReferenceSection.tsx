import Link from "next/link";
import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";

export type EmployeeReferenceData = {
  employees: {
    id: string;
    name: string;
    role: string;
    hourlyRate: number;
    active: boolean;
    hoursThisMonth: number;
    forecastPayCents: number;
    payslipCount: number;
  }[];
  forecastPayCents: number;
  hoursThisMonth: number;
  recentPayslips: {
    id: string;
    employeeName: string;
    periodStart: Date;
    periodEnd: Date;
    grossPay: number;
  }[];
};

/** Reference / forecasting view — payslips are documents; salary posts only via Payments. */
export function EmployeeReferenceSection({ data }: { data: EmployeeReferenceData }) {
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.45 }}>
        Employees are <strong>reference and forecasting</strong> only. Time clock and payslips do not
        post wages to the income statement or bank. Generate payslips manually on each employee’s
        page; record actual salary under <Link href="/payments">Payments</Link>.
      </p>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="report-stat sea">
          <div className="label">Hours this month (clock)</div>
          <div className="value">{data.hoursThisMonth.toFixed(1)}</div>
        </div>
        <div className="report-stat blue">
          <div className="label">Forecast pay (hours × rate)</div>
          <div className="value money">{formatTTD(data.forecastPayCents)}</div>
        </div>
      </div>

      <div className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Rate</th>
              <th>Hours (month)</th>
              <th>Forecast</th>
              <th>Payslips</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.name}</strong>
                  {!e.active ? (
                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                      {" "}
                      · inactive
                    </span>
                  ) : null}
                </td>
                <td>{e.role || "—"}</td>
                <td className="money">{formatTTD(e.hourlyRate)}/h</td>
                <td>{e.hoursThisMonth.toFixed(1)}</td>
                <td className="money">{formatTTD(e.forecastPayCents)}</td>
                <td>{e.payslipCount}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/employees/${e.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {data.employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No employees yet — add them under Employees.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <strong style={{ fontSize: "0.9rem" }}>Recent payslip documents</strong>
        <p className="muted" style={{ margin: "0.25rem 0 0.65rem", fontSize: "0.82rem" }}>
          Saved documents only — generating a payslip does not record a salary payment.
        </p>
        <div className="table-wrap list-dense">
          <table className="data">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Gross</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayslips.map((p) => (
                <tr key={p.id}>
                  <td>{p.employeeName}</td>
                  <td className="muted">
                    {formatAppDate(p.periodStart)} – {formatAppDate(p.periodEnd)}
                  </td>
                  <td className="money">{formatTTD(p.grossPay)}</td>
                </tr>
              ))}
              {data.recentPayslips.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No payslips generated yet — create them manually from an employee profile.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
