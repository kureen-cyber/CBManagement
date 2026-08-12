import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { PosTerminal } from "@/components/PosTerminal";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [products, customers, sales] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      orderBy: { soldAt: "desc" },
      take: 12,
      include: { customer: true, lines: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Point of Sale"
        description="Ring up products and services. Stock updates automatically."
      />

      <PosTerminal
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          unitPrice: p.unitPrice,
          stockQty: p.stockQty,
          trackStock: p.trackStock,
          isService: p.isService,
        }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Recent sales</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Items</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.number}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {s.soldAt.toLocaleString("en-TT")}
                  </div>
                </td>
                <td>{s.customer?.name ?? "Walk-in"}</td>
                <td>{s.method}</td>
                <td className="muted">{s.lines.length}</td>
                <td className="money">{formatTTD(s.total)}</td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No POS sales yet — complete one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
