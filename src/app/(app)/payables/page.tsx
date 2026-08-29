import Link from "next/link";
import { requireCompany } from "@/lib/company";
import { fetchOutstandingPayables, payablesTotal } from "@/lib/payables";
import { formatTTD } from "@/lib/money";
import { PageHeader, Panel } from "@/components/ui";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function PayablesPage() {
  const { companyId } = await requireCompany();
  const payables = await fetchOutstandingPayables(companyId);
  const total = payablesTotal(payables);

  return (
    <div className="stack">
      <PageHeader
        title="Payables"
        description="Amounts owed to suppliers from purchase records."
        actions={
          <Link className="btn btn-secondary" href="/suppliers">
            Suppliers
          </Link>
        }
      />

      <Panel className="kpi" style={{ padding: "1.25rem" }}>
        <div className="label">Total payables</div>
        <div className="value money">{formatTTD(total)}</div>
        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
          Based on supplier purchases logged in the system.
        </p>
      </Panel>

      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Description</th>
              <th>Date</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payables.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/suppliers/${row.supplierId}`}>{row.supplierName}</Link>
                </td>
                <td>{row.description}</td>
                <td>{formatAppDate(row.purchasedAt)}</td>
                <td className="money">{formatTTD(row.amount)}</td>
              </tr>
            ))}
            {payables.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No payables recorded yet — log supplier purchases to track amounts owed.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
