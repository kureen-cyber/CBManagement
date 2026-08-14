import Link from "next/link";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { parsePlanTier, receiptVisibleSince } from "@/lib/tier";
import { PageHeader, Panel } from "@/components/ui";

export async function RetailDashboard() {
  const { companyId, company } = await requireCompany();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const since = receiptVisibleSince(parsePlanTier(company.planTier));

  const [salesToday, saleCount, customerCount, products, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { total: true },
      where: { companyId, soldAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.sale.count({ where: { companyId, soldAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.product.findMany({ where: { companyId, trackStock: true, isService: false } }),
    prisma.sale.findMany({
      where: {
        companyId,
        ...(since ? { soldAt: { gte: since } } : {}),
      },
      orderBy: { soldAt: "desc" },
      take: 6,
      include: { customer: true, lines: true },
    }),
  ]);

  const lowStock = products.filter((p) => p.stockQty <= p.minStock).length;
  const salesAmt = salesToday._sum.total ?? 0;

  return (
    <div className="stack">
      <PageHeader
        title="Retail POS"
        description="Sell fast — register customers, manage stock, and print receipts."
        actions={
          <>
            <Link className="btn btn-primary" href="/pos">
              Open POS
            </Link>
            <a className="btn btn-secondary" href="/api/inventory/export">
              Export stock CSV
            </a>
          </>
        }
      />

      <div className="info-banner">
        Retail mode focuses on <strong>POS</strong>: ring up sales, keep inventory accurate, and export stock lists anytime.
      </div>

      <div className="kpi-grid">
        <Panel className="kpi">
          <div className="label">Sales today</div>
          <div className="value money">{formatTTD(salesAmt)}</div>
          <div className="hint">{saleCount} receipt{saleCount === 1 ? "" : "s"}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Customers</div>
          <div className="value">{customerCount}</div>
          <div className="hint">
            <Link href="/customers">Register customer →</Link>
          </div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Products in stock</div>
          <div className="value">{products.length}</div>
          <div className="hint">
            <Link href="/inventory">Register inventory →</Link>
          </div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Low stock alerts</div>
          <div className="value">{lowStock}</div>
          <div className="hint">
            <a href="/api/inventory/export">Download stock list →</a>
          </div>
        </Panel>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <Panel style={{ padding: "1.2rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Quick actions</h2>
          <div className="stack">
            <Link className="btn btn-primary" href="/pos">
              New sale / generate receipt
            </Link>
            <Link className="btn btn-secondary" href="/customers">
              Register customer
            </Link>
            <Link className="btn btn-secondary" href="/inventory">
              Register inventory item
            </Link>
            <a className="btn btn-secondary" href="/api/inventory/export">
              Export stock inventory list (CSV)
            </a>
          </div>
        </Panel>

        <Panel className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Recent receipts</th>
                <th>Customer</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.number}</strong>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      {s.soldAt.toLocaleString("en-TT")}
                    </div>
                  </td>
                  <td>{s.customer?.name ?? "Walk-in"}</td>
                  <td className="money">{formatTTD(s.total)}</td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" href={`/pos/receipt/${s.id}`}>
                      Receipt
                    </Link>
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No receipts yet — open POS to make your first sale.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
