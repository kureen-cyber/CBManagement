import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getJobProfitability } from "@/lib/business";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { syncJobStatus } from "@/app/actions";
import { needsEngagementPeriod } from "@/lib/job-status";
import { JobDetailTabs } from "@/components/JobDetailTabs";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await enforceTierPath("/jobs");
  const { id } = await params;
  const { companyId } = await requireCompany();

  await syncJobStatus(id, companyId);

  const [job, employees] = await Promise.all([
    prisma.job.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        quotation: true,
        receipts: { orderBy: { createdAt: "desc" } },
        employeeAssignments: {
          include: { employee: true },
          orderBy: { createdAt: "asc" },
        },
        invoices: {
          select: { id: true, number: true, total: true, amountPaid: true, status: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.employee.findMany({
      where: { companyId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  if (!job) notFound();
  const profit = await getJobProfitability(job.id, companyId);
  const needsDates = needsEngagementPeriod(job);
  const outstanding = job.invoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total - inv.amountPaid),
    0,
  );

  const overview = (
    <>
      <div className="row" style={{ gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge status={job.status} />
        {needsDates ? (
          <div className="info-banner" style={{ margin: 0, flex: "1 1 240px" }}>
            Set the start and end dates so this job can move to Pending / Active.{" "}
            <Link href={`/jobs/${job.id}/engagement`}>
              <strong>Edit</strong>
            </Link>
          </div>
        ) : (
          <span className="muted" style={{ fontSize: "0.9rem" }}>
            {formatAppDate(job.startDate)} → {formatAppDate(job.endDate)}
            {outstanding > 0 ? ` · ${formatTTD(outstanding)} outstanding` : " · Paid in full"}
          </span>
        )}
      </div>

      <div className="kpi-grid">
        <Panel className="kpi">
          <div className="label">Contract</div>
          <div className="value money">{formatTTD(profit.contractValue)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Labour</div>
          <div className="value money">{formatTTD(profit.labourCost)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Materials + expenses</div>
          <div className="value money">{formatTTD(profit.materialsCost + profit.expensesCost)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Profit</div>
          <div className="value money">{formatTTD(profit.profit)}</div>
          <div className="hint">{profit.marginPct.toFixed(1)}% margin</div>
        </Panel>
      </div>

      <Panel style={{ padding: "1.15rem 1.25rem" }}>
        <h2 style={{ margin: "0 0 0.55rem", fontSize: "1.05rem" }}>How this profit is calculated</h2>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.92rem", lineHeight: 1.45 }}>
          <strong className="money">Profit = Contract − Labour − Materials − Expenses</strong>
          {" "}
          ({formatTTD(profit.contractValue)} − {formatTTD(profit.labourCost)} −{" "}
          {formatTTD(profit.materialsCost)} − {formatTTD(profit.expensesCost)} ={" "}
          <strong className="money">{formatTTD(profit.profit)}</strong>).
          Margin is profit ÷ contract
          {profit.contractValue > 0 ? ` (${profit.marginPct.toFixed(1)}%)` : ""}.
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
          <li>
            <strong>Contract</strong> — selling price for the job (from the quotation total when the quote was
            accepted).
          </li>
          <li>
            <strong>Labour</strong> — from assigned employees (hourly rate × hours required on this job). If nobody
            is assigned, logged time entries are used instead (including overtime at 1.5×).
          </li>
          <li>
            <strong>Materials</strong> — materials logged on the job (often seeded from quoted materials).
          </li>
          <li>
            <strong>Expenses</strong> — expenses linked to this job (for example equipment bought when converting
            the quote).
          </li>
        </ul>
      </Panel>

      {job.invoices.length ? (
        <Panel className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {job.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.number}</strong>
                  </td>
                  <td className="money">{formatTTD(inv.total)}</td>
                  <td className="money">{formatTTD(inv.amountPaid)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" href={`/invoices/${inv.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Rate / hr</th>
              <th>Hours</th>
              <th>Labour cost</th>
            </tr>
          </thead>
          <tbody>
            {job.employeeAssignments.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.employee.firstName} {a.employee.lastName}
                </td>
                <td className="muted">{a.employee.role ?? "—"}</td>
                <td className="money">{formatTTD(a.hourlyRate)}/hr</td>
                <td>{a.hoursRequired}h</td>
                <td className="money">
                  {formatTTD(Math.round(a.hourlyRate * a.hoursRequired))}
                </td>
              </tr>
            ))}
            {job.employeeAssignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No employees assigned — use the Assign employee/s tab.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </>
  );

  return (
    <div className="stack">
      <PageHeader
        title={`${job.number} — ${job.title}`}
        description={`Customer ${job.customer.name}`}
        actions={
          <div className="row" style={{ gap: "0.5rem" }}>
            <Link className="btn btn-primary" href={`/jobs/${job.id}/engagement`}>
              {needsDates ? "Edit period of engagement" : "Edit dates"}
            </Link>
            <Link className="btn btn-secondary" href="/jobs">
              Back
            </Link>
          </div>
        }
      />

      <JobDetailTabs
        overview={overview}
        jobId={job.id}
        jobNumber={job.number}
        receipts={job.receipts.map((r) => ({
          id: r.id,
          label: r.label,
          receiptData: r.receiptData,
          createdAt: r.createdAt.toISOString(),
        }))}
        employees={employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          role: e.role,
          hourlyRate: e.hourlyRate,
        }))}
        assignments={job.employeeAssignments.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          firstName: a.employee.firstName,
          lastName: a.employee.lastName,
          role: a.employee.role,
          hourlyRate: a.hourlyRate,
          hoursRequired: a.hoursRequired,
        }))}
      />
    </div>
  );
}
