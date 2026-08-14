import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getJobProfitability } from "@/lib/business";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const job = await prisma.job.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      timeEntries: { include: { employee: true }, orderBy: { date: "desc" } },
      quotation: true,
    },
  });
  if (!job) notFound();
  const profit = await getJobProfitability(job.id, companyId);

  return (
    <div className="stack">
      <PageHeader
        title={`${job.number} — ${job.title}`}
        description={`Customer ${job.customer.name}`}
        actions={<Link className="btn btn-secondary" href="/jobs">Back</Link>}
      />
      <StatusBadge status={job.status} />
      <div className="kpi-grid">
        <Panel className="kpi"><div className="label">Contract</div><div className="value money">{formatTTD(profit.contractValue)}</div></Panel>
        <Panel className="kpi"><div className="label">Labour</div><div className="value money">{formatTTD(profit.labourCost)}</div></Panel>
        <Panel className="kpi"><div className="label">Materials + expenses</div><div className="value money">{formatTTD(profit.materialsCost + profit.expensesCost)}</div></Panel>
        <Panel className="kpi"><div className="label">Profit</div><div className="value money">{formatTTD(profit.profit)}</div><div className="hint">{profit.marginPct.toFixed(1)}%</div></Panel>
      </div>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Employee</th><th>Hours</th><th>OT</th><th>Cost</th></tr></thead>
          <tbody>
            {job.timeEntries.map((t) => (
              <tr key={t.id}>
                <td>{t.date.toLocaleDateString("en-TT")}</td>
                <td>{t.employee.firstName} {t.employee.lastName}</td>
                <td>{t.hours}h</td>
                <td>{t.overtimeHours}h</td>
                <td className="money">{formatTTD(Math.round((t.hours + t.overtimeHours * 1.5) * t.hourlyRate))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
