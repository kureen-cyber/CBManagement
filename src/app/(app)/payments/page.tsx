import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { PageHeader, Panel } from "@/components/ui";
import { PaymentsAddTabs } from "@/components/PaymentsAddTabs";
import { PeriodSelector } from "@/components/PeriodSelector";
import { formatAppDate } from "@/lib/timezone";
import {
  ensureManagerOwnerCustomer,
  excludeSystemCustomers,
  isSalaryPayment,
} from "@/lib/owner-drawings";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);

  const managerOwner = await ensureManagerOwnerCustomer(companyId);

  const [customers, suppliers, employees, invoices, payments, sales] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { companyId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId, paidAt: { gte: range.start, lte: range.end } },
      orderBy: { paidAt: "desc" },
      include: { customer: true, invoice: true, sale: true, employee: true, supplier: true },
    }),
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", isRefund: false },
      include: { customer: true },
      orderBy: { soldAt: "desc" },
    }),
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

  return (
    <div className="stack">
      <PageHeader
        title="Payments"
        description={`${range.label} · salary payments and operational customer/supplier payments.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector
          basePath="/payments"
          range={range}
          isFree={isFreeTier(planTier)}
        />
      </Panel>
      <PaymentsAddTabs
        managerOwnerCustomerId={managerOwner.id}
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
        }))}
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
          }))}
        sales={openSales}
      />
      <Panel className="table-wrap list-dense">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Payee</th>
              <th>Reference</th>
              <th>Method</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const salary = isSalaryPayment(p);
              const payee =
                p.employee
                  ? `${p.employee.firstName} ${p.employee.lastName}`.trim()
                  : p.supplier?.name || p.customer?.name || "—";
              return (
                <tr key={p.id}>
                  <td>{formatAppDate(p.paidAt)}</td>
                  <td>
                    <span className="badge">{salary ? "Salary" : "Operational"}</span>
                  </td>
                  <td>{payee}</td>
                  <td className="muted">
                    {p.invoice?.number ?? p.sale?.number ?? p.reference ?? p.notes ?? "—"}
                  </td>
                  <td>{p.method}</td>
                  <td className="money">{formatTTD(p.amount)}</td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" href={`/payments/${p.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
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
