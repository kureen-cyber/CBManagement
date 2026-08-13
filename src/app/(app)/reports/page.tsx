import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ReportsDashboard } from "@/components/ReportsDashboard";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const [payments, expenses, invoices, posSales, expenseRows, paymentRows] = await Promise.all([
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
    prisma.expense.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { category: true, amount: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lte: monthEnd } },
      select: { method: true, amount: true },
    }),
  ]);

  const income = payments._sum.amount ?? 0;
  const expenseTotal = expenses._sum.amount ?? 0;
  const ar = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const pos = posSales._sum.total ?? 0;

  const expenseByCategoryMap = new Map<string, number>();
  for (const row of expenseRows) {
    expenseByCategoryMap.set(row.category, (expenseByCategoryMap.get(row.category) ?? 0) + row.amount);
  }
  const expenseByCategory = [...expenseByCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const methodMap = new Map<string, number>();
  for (const row of paymentRows) {
    methodMap.set(row.method, (methodMap.get(row.method) ?? 0) + row.amount);
  }
  const paymentMethods = [...methodMap.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  const weekly = await Promise.all(
    [0, 1, 2, 3].map(async (offset) => {
      const start = addDays(weekStart, -21 + offset * 7);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const [wPay, wExp] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: start, lte: end } },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: { date: { gte: start, lte: end } },
        }),
      ]);
      return {
        label: format(start, "dd MMM"),
        income: wPay._sum.amount ?? 0,
        expenses: wExp._sum.amount ?? 0,
      };
    }),
  );

  return (
    <div className="stack">
      <PageHeader
        title="Reports"
        description="Visual income, expenses, receivables, and POS for this month."
      />
      <ReportsDashboard
        data={{
          income,
          expenses: expenseTotal,
          receivables: ar,
          pos,
          profit: income - expenseTotal,
          expenseByCategory,
          paymentMethods,
          weekly,
        }}
      />
    </div>
  );
}
