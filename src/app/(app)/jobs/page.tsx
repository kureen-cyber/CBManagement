import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getJobProfitability } from "@/lib/business";
import { formatTTD } from "@/lib/money";
import { addTimeEntry, createJob } from "@/app/actions";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const [customers, employees, jobs] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { firstName: "asc" } }),
    prisma.job.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } }),
  ]);
  const profits = await Promise.all(jobs.map(async (j) => ({ id: j.id, ...(await getJobProfitability(j.id)) })));
  const profitMap = Object.fromEntries(profits.map((p) => [p.id, p]));

  return (
    <div className="stack">
      <PageHeader title="Jobs / Projects" description="Am I actually making money on this job?" />
      <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel style={{ padding: "1.25rem" }}>
          <form action={createJob} className="form-grid">
            <label className="field">Customer
              <select name="customerId" required defaultValue="">
                <option value="" disabled>Select</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">Title<input name="title" required /></label>
            <label className="field">Contract (TT$)<input name="contractValue" type="number" step="0.01" defaultValue="18500" /></label>
            <div className="full"><button className="btn btn-primary" type="submit">Create job</button></div>
          </form>
        </Panel>
        <Panel style={{ padding: "1.25rem" }}>
          <form action={addTimeEntry} className="form-grid">
            <label className="field">Employee
              <select name="employeeId" required defaultValue="">
                <option value="" disabled>Select</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </label>
            <label className="field">Job
              <select name="jobId" defaultValue="">
                <option value="">No job</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}
              </select>
            </label>
            <label className="field">Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="field">Hours<input name="hours" type="number" step="0.25" defaultValue="8" /></label>
            <div className="full"><button className="btn btn-secondary" type="submit">Save hours</button></div>
          </form>
        </Panel>
      </div>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Job</th><th>Customer</th><th>Contract</th><th>Costs</th><th>Profit</th><th>Margin</th><th>Status</th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const p = profitMap[j.id];
              return (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`}><strong>{j.number}</strong></Link><div className="muted" style={{ fontSize: "0.8rem" }}>{j.title}</div></td>
                  <td>{j.customer.name}</td>
                  <td className="money">{formatTTD(j.contractValue)}</td>
                  <td className="money">{formatTTD(p?.totalCost ?? 0)}</td>
                  <td className="money">{formatTTD(p?.profit ?? 0)}</td>
                  <td>{(p?.marginPct ?? 0).toFixed(1)}%</td>
                  <td><StatusBadge status={j.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
