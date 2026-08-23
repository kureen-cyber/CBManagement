import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: string;
  date: Date;
  type: "POS" | "Quotation" | "Invoice" | "Payment";
  label: string;
  href: string | null;
  status: string;
  total: number;
  paid: number | null;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const customer = await prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      quotations: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { paidAt: "desc" } },
      sales: {
        where: { status: { not: "OPEN" } },
        orderBy: { soldAt: "desc" },
      },
    },
  });
  if (!customer) notFound();

  const outstanding = customer.invoices
    .filter((i) => !["PAID", "VOID"].includes(i.status))
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  const completedSales = customer.sales.filter((s) => s.status === "COMPLETED");
  const visitCount = completedSales.filter((s) => !s.isRefund).length;
  const posSpent = completedSales.reduce((sum, s) => {
    return sum + (s.isRefund ? -Math.abs(s.total) : s.total);
  }, 0);
  const invoicePaid = customer.invoices.reduce((s, i) => s + i.amountPaid, 0);
  // POS sales already record spend; invoice amountPaid covers service/job billing.
  // Avoid double-counting POS-linked payment rows by using invoice paid + POS totals only.
  const totalSpent = Math.max(0, posSpent) + invoicePaid;

  const activity: ActivityRow[] = [
    ...customer.sales.map((s) => ({
      id: `sale-${s.id}`,
      date: s.soldAt,
      type: "POS" as const,
      label: s.number,
      href: `/pos/receipt/${s.id}`,
      status: s.isRefund ? "REFUND" : s.status,
      total: s.total,
      paid: s.amountPaid,
    })),
    ...customer.quotations.map((q) => ({
      id: `quote-${q.id}`,
      date: q.createdAt,
      type: "Quotation" as const,
      label: q.number,
      href: `/quotations/${q.id}`,
      status: q.status,
      total: q.total,
      paid: null as number | null,
    })),
    ...customer.invoices.map((inv) => ({
      id: `inv-${inv.id}`,
      date: inv.issueDate,
      type: "Invoice" as const,
      label: inv.number,
      href: `/invoices/${inv.id}`,
      status: inv.status,
      total: inv.total,
      paid: inv.amountPaid,
    })),
    // Skip payment rows that mirror a POS sale (those already appear as POS).
    ...customer.payments
      .filter((p) => {
        const notes = (p.notes || "").toLowerCase();
        if (notes.includes("pos")) return false;
        if (p.reference && customer.sales.some((s) => s.number === p.reference)) return false;
        return true;
      })
      .map((p) => ({
        id: `pay-${p.id}`,
        date: p.paidAt,
        type: "Payment" as const,
        label: p.reference || p.method,
        href: `/payments/${p.id}`,
        status: "PAID",
        total: p.amount,
        paid: p.amount,
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="stack">
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ")}
        actions={
          <Link className="btn btn-secondary" href="/customers">
            Back
          </Link>
        }
      />
      <div className="kpi-grid kpi-grid-6">
        <Panel className="kpi">
          <div className="label">Outstanding</div>
          <div className="value money">{formatTTD(outstanding)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Visits / purchases</div>
          <div className="value">{visitCount}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Total spent</div>
          <div className="value money">{formatTTD(totalSpent)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Quotes</div>
          <div className="value">{customer.quotations.length}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Jobs</div>
          <div className="value">{customer.jobs.length}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Invoices</div>
          <div className="value">{customer.invoices.length}</div>
        </Panel>
      </div>
      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction Type</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.date)}</td>
                <td>
                  <div>
                    <strong>{row.type}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {row.href ? <Link href={row.href}>{row.label}</Link> : row.label}
                    </div>
                  </div>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="money">{formatTTD(row.total)}</td>
                <td className="money">{row.paid == null ? "—" : formatTTD(row.paid)}</td>
              </tr>
            ))}
            {activity.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
