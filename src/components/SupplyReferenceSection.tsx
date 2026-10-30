import Link from "next/link";
import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import { supplyTypeLabel } from "@/lib/constants";

export type SupplyReferenceData = {
  suppliers: { id: string; name: string; itemCount: number; catalogValueCents: number }[];
  recentPurchases: {
    id: string;
    name: string;
    supplierName: string;
    totalCost: number;
    purchasedAt: Date;
  }[];
  catalogValueCents: number;
  purchaseLogTotalCents: number;
};

/** Reference / forecasting view — does not post to income statement or bank. */
export function SupplyReferenceSection({ data }: { data: SupplyReferenceData }) {
  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.45 }}>
        Supply is <strong>reference and forecasting</strong> only. Catalog costs and purchase logs
        here do not create expenses, bank outflows, or income-statement lines. Record real supplier
        payments under <Link href="/payments">Payments</Link>.
      </p>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="report-stat sea">
          <div className="label">Catalog value (estimate)</div>
          <div className="value money">{formatTTD(data.catalogValueCents)}</div>
        </div>
        <div className="report-stat blue">
          <div className="label">Supply purchase log total</div>
          <div className="value money">{formatTTD(data.purchaseLogTotalCents)}</div>
        </div>
      </div>

      <div className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Catalog items</th>
              <th>Catalog value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.suppliers.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td>{s.itemCount}</td>
                <td className="money">{formatTTD(s.catalogValueCents)}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/suppliers/${s.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {data.suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No suppliers yet — add them under Suppliers.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <strong style={{ fontSize: "0.9rem" }}>Recent supply purchase logs</strong>
        <p className="muted" style={{ margin: "0.25rem 0 0.65rem", fontSize: "0.82rem" }}>
          Forecast / history only — not accounts payable unless recorded as a deferred payment.
        </p>
        <div className="table-wrap list-dense">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Supplier</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPurchases.map((p) => (
                <tr key={p.id}>
                  <td className="muted">{formatAppDate(p.purchasedAt)}</td>
                  <td>{p.name}</td>
                  <td>{p.supplierName}</td>
                  <td className="money">{formatTTD(p.totalCost)}</td>
                </tr>
              ))}
              {data.recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No supply purchase logs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        Item types ({supplyTypeLabel("MATERIAL")}, equipment, rentals, etc.) stay on each supplier’s
        supply database for quoting and planning.
      </p>
    </div>
  );
}
