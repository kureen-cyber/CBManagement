import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { PageHeader, Panel } from "@/components/ui";
import { AddEntityTab } from "@/components/AddEntityTab";
import { PaymentForm } from "@/components/PaymentForm";
import { PeriodSelector } from "@/components/PeriodSelector";
import { formatAppDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);

  const [customers, invoices, payments] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId, paidAt: { gte: range.start, lte: range.end } },
      orderBy: { paidAt: "desc" },
      include: { customer: true, invoice: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Payments"
        description={`${range.label} · record money received against invoices.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector
          basePath="/payments"
          range={range}
          isFree={isFreeTier(planTier)}
        />
      </Panel>
      <AddEntityTab label="Add payment" title="Record payment">
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
      </AddEntityTab>
      <Panel className="table-wrap list-dense">
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
                <td>{formatAppDate(p.paidAt)}</td>
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
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No payments in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
