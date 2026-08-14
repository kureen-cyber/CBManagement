import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { createInvoice } from "@/app/actions";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { companyId } = await requireCompany();
  const [customers, jobs, invoices] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { customer: true, job: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Invoices" description="Bill customers and track what is still owed." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createInvoice} className="form-grid">
          <label className="field">Customer
            <select name="customerId" required defaultValue="">
              <option value="" disabled>Select</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">Job
            <select name="jobId" defaultValue="">
              <option value="">None</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}
            </select>
          </label>
          <label className="field">Description<input name="description" defaultValue="Services rendered" /></label>
          <label className="field">Amount (TT$)<input name="total" type="number" step="0.01" required /></label>
          <label className="field">Due date<input name="dueDate" type="date" defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)} /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Create invoice</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Job</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><strong>{inv.number}</strong></td>
                <td>{inv.customer.name}</td>
                <td className="muted">{inv.job?.number ?? "—"}</td>
                <td className="money">{formatTTD(inv.total)}</td>
                <td className="money">{formatTTD(inv.amountPaid)}</td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
