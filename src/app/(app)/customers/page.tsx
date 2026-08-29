import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { createCustomer } from "@/app/actions";
import { AddEntityTab } from "@/components/AddEntityTab";
import { DeleteCustomerButton } from "@/components/DeleteCustomerButton";
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
  const { excludeSystemCustomers } = await import("@/lib/owner-drawings");
  const visibleCustomers = excludeSystemCustomers(customers);

  return (
    <div className="stack">
      <PageHeader
        title="Customers"
        description="Contact info, balances, quotes, invoices, jobs — one place."
      />
      <AddEntityTab label="Add customer">
        <form action={createCustomer} className="form-grid" autoComplete="off">
          <label className="field">
            Name
            <input
              name="name"
              required
              placeholder="ABC Construction Ltd."
              autoComplete="organization"
            />
          </label>
          <label className="field">
            Phone
            <input name="phone" placeholder="868-555-0100" autoComplete="off" />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="off" />
          </label>
          <label className="field">
            Address
            <input name="address" autoComplete="off" />
          </label>
          <label className="field full">
            Notes
            <textarea name="notes" rows={2} autoComplete="off" />
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit">
              Save customer
            </button>
          </div>
        </form>
      </AddEntityTab>
      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Quotes</th>
              <th>Jobs</th>
              <th>Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleCustomers.map((c) => {
              const outstanding = c.invoices
                .filter((i) => !["PAID", "VOID"].includes(i.status))
                .reduce((s, i) => s + (i.total - i.amountPaid), 0);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`}>
                      <strong>{c.name}</strong>
                    </Link>
                  </td>
                  <td className="muted">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td>{c.quotations.length}</td>
                  <td>{c.jobs.length}</td>
                  <td className="money">{formatTTD(outstanding)}</td>
                  <td>
                    <DeleteCustomerButton customerId={c.id} customerName={c.name} />
                  </td>
                </tr>
              );
            })}
            {visibleCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No customers yet — use Add customer.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
