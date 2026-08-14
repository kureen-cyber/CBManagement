import { prisma } from "@/lib/prisma";
import { formatTTD, sellingPriceFromMarkup } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { acceptAndConvertQuotation, createQuotation } from "@/app/actions";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  await enforceTierPath("/quotations");
  const { companyId } = await requireCompany();
  const [customers, quotations] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.quotation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Quotations" description="Labour + materials + equipment + transport, with markup." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createQuotation} className="form-grid">
          <label className="field">Customer
            <select name="customerId" required defaultValue="">
              <option value="" disabled>Select</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">Title<input name="title" placeholder="Electrical installation" /></label>
          <label className="field">Labour (TT$)<input name="labourCost" type="number" step="0.01" defaultValue="2500" /></label>
          <label className="field">Materials (TT$)<input name="materialsCost" type="number" step="0.01" defaultValue="1800" /></label>
          <label className="field">Equipment (TT$)<input name="equipmentCost" type="number" step="0.01" defaultValue="500" /></label>
          <label className="field">Transport (TT$)<input name="transportCost" type="number" step="0.01" defaultValue="300" /></label>
          <label className="field">Markup %<input name="markupPct" type="number" step="0.1" defaultValue="25" /></label>
          <div className="full muted" style={{ fontSize: "0.85rem" }}>
            Example cost TT$5,100 @ 25% → {formatTTD(sellingPriceFromMarkup(510000, 25))}
          </div>
          <div className="full"><button className="btn btn-primary" type="submit">Save quotation</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Quote</th><th>Customer</th><th>Cost</th><th>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const cost = q.labourCost + q.materialsCost + q.equipmentCost + q.transportCost;
              return (
                <tr key={q.id}>
                  <td><strong>{q.number}</strong><div className="muted" style={{ fontSize: "0.8rem" }}>{q.title}</div></td>
                  <td>{q.customer.name}</td>
                  <td className="money">{formatTTD(cost)}</td>
                  <td className="money">{formatTTD(q.total)}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td>
                    {q.status !== "CONVERTED" ? (
                      <form action={async () => { "use server"; await acceptAndConvertQuotation(q.id); }}>
                        <button className="btn btn-accent btn-sm" type="submit">Accept → Job + Invoice</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
