import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [payments, expenses, invoices, posSales] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIAL", "OVERDUE", "PAID"] } },
      select: { total: true, amountPaid: true, status: true },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: { soldAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const income = payments._sum.amount ?? 0;
  const expenseTotal = expenses._sum.amount ?? 0;
  const ar = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  return (
    <div className="stack">
      <PageHeader title="Reports" description="Starter income, expenses, receivables, and POS." />
      <div className="kpi-grid">
        <Panel className="kpi"><div className="label">Income this month</div><div className="value money">{formatTTD(income)}</div></Panel>
        <Panel className="kpi"><div className="label">Expenses this month</div><div className="value money">{formatTTD(expenseTotal)}</div></Panel>
        <Panel className="kpi"><div className="label">Accounts receivable</div><div className="value money">{formatTTD(ar)}</div></Panel>
        <Panel className="kpi"><div className="label">POS this month</div><div className="value money">{formatTTD(posSales._sum.total ?? 0)}</div></Panel>
      </div>
      <Panel style={{ padding: "1.25rem" }}>
        <p className="insight" style={{ margin: 0 }}>
          Estimated profit this month: <strong>{formatTTD(income - expenseTotal)}</strong>
        </p>
      </Panel>
    </div>
  );
}
