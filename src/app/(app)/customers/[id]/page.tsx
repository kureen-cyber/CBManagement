import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      quotations: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const outstanding = customer.invoices
    .filter((i) => !["PAID", "VOID"].includes(i.status))
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  return (
    <div className="stack">
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ")}
        actions={<Link className="btn btn-secondary" href="/customers">Back</Link>}
      />
      <div className="kpi-grid">
        <Panel className="kpi"><div className="label">Outstanding</div><div className="value money">{formatTTD(outstanding)}</div></Panel>
        <Panel className="kpi"><div className="label">Quotes</div><div className="value">{customer.quotations.length}</div></Panel>
        <Panel className="kpi"><div className="label">Jobs</div><div className="value">{customer.jobs.length}</div></Panel>
        <Panel className="kpi"><div className="label">Invoices</div><div className="value">{customer.invoices.length}</div></Panel>
      </div>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {customer.invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.number}</td>
                <td><StatusBadge status={inv.status} /></td>
                <td className="money">{formatTTD(inv.total)}</td>
                <td className="money">{formatTTD(inv.amountPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
