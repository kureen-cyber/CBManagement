import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { recordPayment } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { companyId } = await requireCompany();
  const [customers, invoices, payments] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId },
      orderBy: { paidAt: "desc" },
      include: { customer: true, invoice: true },
      take: 50,
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Payments" description="Record money received against invoices." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={recordPayment} className="form-grid">
          <label className="field">Customer
            <select name="customerId" required defaultValue="">
              <option value="" disabled>Select</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">Invoice
            <select name="invoiceId" defaultValue="">
              <option value="">Unallocated</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} — {formatTTD(inv.total - inv.amountPaid)} due
                </option>
              ))}
            </select>
          </label>
          <label className="field">Amount (TT$)<input name="amount" type="number" step="0.01" required /></label>
          <label className="field">Method
            <select name="method" defaultValue="BANK">
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          <label className="field">Date<input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Save payment</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.paidAt.toLocaleDateString("en-TT")}</td>
                <td>{p.customer.name}</td>
                <td className="muted">{p.invoice?.number ?? p.reference ?? "—"}</td>
                <td>{p.method}</td>
                <td className="money">{formatTTD(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
