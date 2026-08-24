import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getJobProfitability } from "@/lib/business";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { syncCompanyJobStatuses } from "@/app/actions";
import { needsEngagementPeriod } from "@/lib/job-status";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { PeriodSelector } from "@/components/PeriodSelector";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  await enforceTierPath("/jobs");
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);
  await syncCompanyJobStatuses(companyId);

  const jobs = await prisma.job.findMany({
    where: { companyId, createdAt: { gte: range.start, lte: range.end } },
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
        description={`${range.label} · jobs created when you accept a quotation.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector basePath="/jobs" range={range} isFree={isFreeTier(planTier)} />
      </Panel>
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.45 }}>
        Profit on each job = <strong>contract − labour − materials − expenses</strong>. Open a job to
        see the breakdown.
      </p>
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
                      <div className="stack" style={{ gap: "0.25rem" }}>
                        <span>{j.quotation.number}</span>
                        <Link
                          href={`/quotations/${j.quotation.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ alignSelf: "flex-start" }}
                        >
                          View
                        </Link>
                      </div>
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
                  No jobs in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
