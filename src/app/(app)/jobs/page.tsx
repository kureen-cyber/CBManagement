import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getJobProfitability } from "@/lib/business";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { syncCompanyJobStatuses } from "@/app/actions";
import { needsEngagementPeriod } from "@/lib/job-status";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await enforceTierPath("/jobs");
  const { companyId } = await requireCompany();
  await syncCompanyJobStatuses(companyId);

  const jobs = await prisma.job.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { customer: true, quotation: { select: { id: true, number: true } } },
  });
  const profits = await Promise.all(
    jobs.map(async (j) => ({ id: j.id, ...(await getJobProfitability(j.id, companyId)) })),
  );
  const profitMap = Object.fromEntries(profits.map((p) => [p.id, p]));

  return (
    <div className="stack">
      <PageHeader
        title="Jobs / Projects"
        description="Jobs are created when you accept a quotation. Track profitability and assign your team on each job."
      />
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Job</th>
              <th>Quotation number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Engagement</th>
              <th>Contract</th>
              <th>Costs</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const p = profitMap[j.id];
              const needsDates = needsEngagementPeriod(j);
              return (
                <tr key={j.id}>
                  <td>
                    <Link href={`/jobs/${j.id}`}>
                      <strong>{j.number}</strong>
                    </Link>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {j.title}
                    </div>
                  </td>
                  <td>
                    {j.quotation ? (
                      <Link href={`/quotations/${j.quotation.id}`}>{j.quotation.number}</Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{j.createdAt.toLocaleDateString("en-TT")}</td>
                  <td>{j.customer.name}</td>
                  <td>
                    {needsDates ? (
                      <Link href={`/jobs/${j.id}/engagement`} className="muted" style={{ fontSize: "0.85rem" }}>
                        Not set — edit
                      </Link>
                    ) : (
                      <span style={{ fontSize: "0.85rem" }}>
                        {j.startDate?.toLocaleDateString("en-TT")} →{" "}
                        {j.endDate?.toLocaleDateString("en-TT")}
                      </span>
                    )}
                  </td>
                  <td className="money">{formatTTD(j.contractValue)}</td>
                  <td className="money">{formatTTD(p?.totalCost ?? 0)}</td>
                  <td className="money">{formatTTD(p?.profit ?? 0)}</td>
                  <td>{(p?.marginPct ?? 0).toFixed(1)}%</td>
                  <td>
                    {needsDates ? (
                      <div className="stack" style={{ gap: "0.25rem" }}>
                        <StatusBadge status={j.status} />
                        <Link
                          href={`/jobs/${j.id}/engagement`}
                          className="btn btn-secondary btn-sm"
                          style={{ alignSelf: "flex-start" }}
                        >
                          Edit
                        </Link>
                      </div>
                    ) : (
                      <StatusBadge status={j.status} />
                    )}
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
                  No jobs yet — accept a quotation to create one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
