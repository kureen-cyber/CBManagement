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

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await enforceTierPath("/jobs");
  const { id } = await params;
  const { companyId } = await requireCompany();

  await syncJobStatus(id, companyId);

  const job = await prisma.job.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      timeEntries: { include: { employee: true }, orderBy: { date: "desc" } },
      quotation: true,
      receipts: { orderBy: { createdAt: "desc" } },
      invoices: {
        select: { id: true, number: true, total: true, amountPaid: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
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
            {job.startDate?.toLocaleDateString("en-TT")} → {job.endDate?.toLocaleDateString("en-TT")}
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
          <div className="hint">{profit.marginPct.toFixed(1)}%</div>
        </Panel>
      </div>

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
              <th>Date</th>
              <th>Employee</th>
              <th>Hours</th>
              <th>OT</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {job.timeEntries.map((t) => (
              <tr key={t.id}>
                <td>{t.date.toLocaleDateString("en-TT")}</td>
                <td>
                  {t.employee.firstName} {t.employee.lastName}
                </td>
                <td>{t.hours}h</td>
                <td>{t.overtimeHours}h</td>
                <td className="money">
                  {formatTTD(Math.round((t.hours + t.overtimeHours * 1.5) * t.hourlyRate))}
                </td>
              </tr>
            ))}
            {job.timeEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No time entries yet.
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
        receipts={job.receipts.map((r) => ({
          id: r.id,
          label: r.label,
          receiptData: r.receiptData,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
