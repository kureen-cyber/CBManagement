import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { fetchOutstandingReceivables, receivableSourceLabel } from "@/lib/receivables";
import { excludeSystemCustomers } from "@/lib/owner-drawings";
import { PageHeader, Panel } from "@/components/ui";
import { AddEntityTab } from "@/components/AddEntityTab";
import { PaymentForm } from "@/components/PaymentForm";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ collect?: string; type?: string }>;
}) {
  const { companyId } = await requireCompany();
  const params = await searchParams;
  const receivables = await fetchOutstandingReceivables(companyId);

  const [customers, invoices, sales, suppliers] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", isRefund: false },
      include: { customer: true },
      orderBy: { soldAt: "desc" },
    }),
    prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);

  const crmCustomers = excludeSystemCustomers(customers);
  const openSales = sales
    .map((sale) => ({
      id: sale.id,
      number: sale.number,
      customerId: sale.customerId || crmCustomers.find((c) => c.name === "Walk-in Customer")?.id || "",
      customerName: sale.customer?.name || "Walk-in Customer",
      amountDue: Math.max(0, sale.total - sale.amountPaid),
    }))
    .filter((sale) => sale.amountDue > 0 && sale.customerId);

  const initialInvoiceId = params.type === "service" ? params.collect || "" : "";
  const initialSaleId = params.type === "pos" ? params.collect || "" : "";

  const totalOutstanding = receivables.reduce((sum, row) => sum + row.balance, 0);

  return (
    <div className="stack">
      <PageHeader
        title="Receivables"
        description="Outstanding POS and service balances awaiting collection."
      />

      <Panel style={{ padding: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              Total outstanding
            </div>
            <div className="value money" style={{ fontSize: "1.75rem" }}>
              {formatTTD(totalOutstanding)}
            </div>
          </div>
          <Link className="btn btn-secondary" href="/payments">
            View all payments
          </Link>
        </div>
      </Panel>

      <AddEntityTab label="Collect payment" title="Record payment against receivable">
        <PaymentForm
          customers={crmCustomers.map((c) => ({ id: c.id, name: c.name }))}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          invoices={invoices
            .filter((inv) => crmCustomers.some((c) => c.id === inv.customerId))
            .map((inv) => ({
              id: inv.id,
              number: inv.number,
              customerId: inv.customerId,
              customerName: inv.customer.name,
              amountDue: Math.max(0, inv.total - inv.amountPaid),
            }))
            .filter((inv) => inv.amountDue > 0)}
          sales={openSales}
          initialInvoiceId={initialInvoiceId}
          initialSaleId={initialSaleId}
        />
      </AddEntityTab>

      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Due</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((row) => (
              <tr key={`${row.source}-${row.id}`}>
                <td>{receivableSourceLabel(row.source)}</td>
                <td>{row.number}</td>
                <td>{row.customerName}</td>
                <td>{row.dueDate ? formatAppDate(row.dueDate) : "—"}</td>
                <td className="money">{formatTTD(row.balance)}</td>
                <td>
                  <Link
                    className="btn btn-secondary btn-sm"
                    href={`/receivables?collect=${row.id}&type=${row.source === "POS" ? "pos" : "service"}`}
                  >
                    Collect
                  </Link>
                </td>
              </tr>
            ))}
            {receivables.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No outstanding receivables.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
