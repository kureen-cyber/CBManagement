import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { acceptAndConvertQuotation } from "@/app/actions";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { QuotationForm } from "@/components/QuotationForm";

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
      <PageHeader
        title="Quotations"
        description="Enter your costs, then set markup % at the end. Customers see one marked-up figure per item — markup is not listed separately."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <QuotationForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const cost = q.labourCost + q.materialsCost + q.equipmentCost + q.transportCost;
              return (
                <tr key={q.id}>
                  <td>
                    <strong>{q.number}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {q.title}
                      {q.fixedPrice ? " · Fixed price" : ""}
                    </div>
                  </td>
                  <td>{q.customer.name}</td>
                  <td className="money">{formatTTD(cost)}</td>
                  <td className="money">{formatTTD(q.total)}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: "0.4rem" }}>
                      <Link className="btn btn-secondary btn-sm" href={`/quotations/${q.id}`}>
                        View
                      </Link>
                      {q.status !== "CONVERTED" ? (
                        <form
                          action={async () => {
                            "use server";
                            await acceptAndConvertQuotation(q.id);
                          }}
                        >
                          <button className="btn btn-accent btn-sm" type="submit">
                            Accept → Job + Invoice
                          </button>
                        </form>
                      ) : null}
                    </div>
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
