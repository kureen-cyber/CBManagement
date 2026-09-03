import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { PageHeader, Panel } from "@/components/ui";
import { PaymentsWorkspace } from "@/components/PaymentsWorkspace";
import { PeriodSelector } from "@/components/PeriodSelector";
import {
  ensureDefaultLeadershipEmployees,
  employeeDisplayName,
  excludeSystemCustomers,
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

  await ensureDefaultLeadershipEmployees(companyId);

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
      customerId:
        sale.customerId || crmCustomers.find((c) => c.name === "Walk-in Customer")?.id || "",
      customerName: sale.customer?.name || "Walk-in Customer",
      amountDue: Math.max(0, sale.total - sale.amountPaid),
    }))
    .filter((sale) => sale.amountDue > 0 && sale.customerId);

  return (
    <div className="stack">
      <PageHeader
        title="Payments"
        description={`${range.label} · incoming POS/invoice receipts and outgoing salary & operational payments.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector basePath="/payments" range={range} isFree={isFreeTier(planTier)} />
      </Panel>
      <PaymentsWorkspace
        employees={employees.map((e) => ({
          id: e.id,
          name: employeeDisplayName(e),
          systemRole: e.systemRole,
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
        payments={payments.map((p) => ({
          id: p.id,
          paidAt: p.paidAt.toISOString(),
          amount: p.amount,
          method: p.method,
          kind: p.kind,
          notes: p.notes,
          reference: p.reference,
          employeeId: p.employeeId,
          supplierId: p.supplierId,
          customerId: p.customerId,
          invoiceId: p.invoiceId,
          saleId: p.saleId,
          payee: p.employee
            ? `${p.employee.firstName} ${p.employee.lastName}`.trim()
            : p.supplier?.name || p.customer?.name || "—",
          employeeSystemRole: p.employee?.systemRole ?? null,
          customerName: p.customer?.name ?? null,
          invoiceNumber: p.invoice?.number ?? null,
          saleNumber: p.sale?.number ?? null,
        }))}
      />
    </div>
  );
}
