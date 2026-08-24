import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { parsePlanTier, receiptVisibleSince } from "@/lib/tier";
import { PageHeader, Panel } from "@/components/ui";
import { PaymentForm } from "@/components/PaymentForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { companyId, company } = await requireCompany();
  const since = receiptVisibleSince(parsePlanTier(company.planTier));
  const [customers, invoices, payments] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: {
        companyId,
        ...(since ? { paidAt: { gte: since } } : {}),
      },
      orderBy: { paidAt: "desc" },
      include: { customer: true, invoice: true },
      take: 50,
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Payments" description="Record money received against invoices." />
      <Panel style={{ padding: "1.25rem" }}>
        <PaymentForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          invoices={invoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            customerId: inv.customerId,
            customerName: inv.customer.name,
            amountDue: Math.max(0, inv.total - inv.amountPaid),
          }))}
        />
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Method</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.paidAt.toLocaleDateString("en-TT")}</td>
                <td>{p.customer.name}</td>
                <td className="muted">{p.invoice?.number ?? p.reference ?? "—"}</td>
                <td>{p.method}</td>
                <td className="money">{formatTTD(p.amount)}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/payments/${p.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
