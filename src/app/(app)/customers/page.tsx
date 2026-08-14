import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { createCustomer } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { companyId } = await requireCompany();
  const customers = await prisma.customer.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: {
      invoices: { select: { total: true, amountPaid: true, status: true } },
      quotations: { select: { id: true } },
      jobs: { select: { id: true } },
    },
  });

  return (
    <div className="stack">
      <PageHeader title="Customers" description="Contact info, balances, quotes, invoices, jobs — one place." />
      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Add customer</h2>
        <form action={createCustomer} className="form-grid">
          <label className="field">Name<input name="name" required placeholder="ABC Construction Ltd." /></label>
          <label className="field">Phone<input name="phone" placeholder="868-555-0100" /></label>
          <label className="field">Email<input name="email" type="email" /></label>
          <label className="field">Address<input name="address" /></label>
          <label className="field full">Notes<textarea name="notes" rows={2} /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Save customer</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Customer</th><th>Contact</th><th>Quotes</th><th>Jobs</th><th>Outstanding</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const outstanding = c.invoices
                .filter((i) => !["PAID", "VOID"].includes(i.status))
                .reduce((s, i) => s + (i.total - i.amountPaid), 0);
              return (
                <tr key={c.id}>
                  <td><Link href={`/customers/${c.id}`}><strong>{c.name}</strong></Link></td>
                  <td className="muted">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{c.quotations.length}</td>
                  <td>{c.jobs.length}</td>
                  <td className="money">{formatTTD(outstanding)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
