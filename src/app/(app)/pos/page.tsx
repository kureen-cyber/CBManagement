import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { getBusinessType } from "@/lib/session-business";
import { isRetailOnly } from "@/lib/business-type";
import { PosTerminal } from "@/components/PosTerminal";
import { PageHeader, Panel } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const { companyId } = await requireCompany();
  const businessType = await getBusinessType();
  const retailMode = isRetailOnly(businessType) || businessType === "BOTH";

  const [products, customers, sales] = await Promise.all([
    prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: { companyId },
      orderBy: { soldAt: "desc" },
      take: 12,
      include: { customer: true, lines: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title={isRetailOnly(businessType) ? "POS Terminal" : "Point of Sale"}
        description={
          isRetailOnly(businessType)
            ? "Ring up sales, register customers & stock, and print receipts."
            : "Ring up products and services. Stock updates automatically."
        }
        actions={
          <a className="btn btn-secondary" href="/api/inventory/export">
            Export stock CSV
          </a>
        }
      />

      <PosTerminal
        retailMode={retailMode}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
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
              <th>Recent receipts</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Items</th>
              <th>Total</th>
              <th></th>
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
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/pos/receipt/${s.id}`}>
                    Receipt
                  </Link>
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
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
