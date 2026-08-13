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

  const [payments, expenses, invoices, posSales, expenseRows, paymentRows, saleLines] =
    await Promise.all([
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
        select: { method: true, amount: true, reference: true, notes: true },
      }),
      prisma.saleLine.findMany({
        where: { sale: { soldAt: { gte: monthStart, lte: monthEnd } } },
        include: {
          product: true,
          sale: { select: { number: true, soldAt: true, method: true } },
        },
        orderBy: { sale: { soldAt: "desc" } },
      }),
    ]);

  const expenseTotal = expenses._sum.amount ?? 0;
  const ar = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const pos = posSales._sum.total ?? 0;

  let posRetail = 0;
  let posService = 0;
  const itemMap = new Map<
    string,
    { name: string; category: string; qty: number; amount: number; isService: boolean }
  >();
  const categoryMap = new Map<string, { category: string; qty: number; amount: number }>();

  for (const line of saleLines) {
    const isService = Boolean(line.product?.isService) || !line.product;
    // Treat unknown product lines as retail unless product marked service
    const service = Boolean(line.product?.isService);
    if (service) posService += line.lineTotal;
    else posRetail += line.lineTotal;

    const category = line.product?.category || (service ? "Service — fixed price" : "General");
    const name = line.description;
    const key = `${name}::${category}`;
    const existing = itemMap.get(key) || {
      name,
      category,
      qty: 0,
      amount: 0,
      isService: service,
    };
    existing.qty += line.quantity;
    existing.amount += line.lineTotal;
    itemMap.set(key, existing);

    const cat = categoryMap.get(category) || { category, qty: 0, amount: 0 };
    cat.qty += line.quantity;
    cat.amount += line.lineTotal;
    categoryMap.set(category, cat);
  }

  // Payments that are not POS-linked count as other/service income
  const posPaymentTotal = paymentRows
    .filter((p) => (p.reference || "").startsWith("POS") || (p.notes || "").toLowerCase().includes("pos"))
    .reduce((s, p) => s + p.amount, 0);
  const otherIncome = Math.max(0, (payments._sum.amount ?? 0) - posPaymentTotal);

  // Total income = POS sales + other payments (avoid double-counting POS payments)
  const income = pos + otherIncome;
  const serviceIncome = posService + otherIncome;

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

  const incomeByCategoryMap = new Map<string, { category: string; amount: number; kind: string }>();
  for (const [, row] of itemMap) {
    const kind = row.isService ? "Service" : "POS retail";
    const key = `${kind}::${row.category}`;
    const cur = incomeByCategoryMap.get(key) || { category: row.category, amount: 0, kind };
    cur.amount += row.amount;
    incomeByCategoryMap.set(key, cur);
  }
  if (otherIncome > 0) {
    incomeByCategoryMap.set("Other::Payments", {
      category: "Other payments / invoices",
      amount: otherIncome,
      kind: "Service / other",
    });
  }
  const incomeByCategory = [...incomeByCategoryMap.values()].sort((a, b) => b.amount - a.amount);

  const weekly = await Promise.all(
    [0, 1, 2, 3].map(async (offset) => {
      const start = addDays(weekStart, -21 + offset * 7);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const [wSales, wExp] = await Promise.all([
        prisma.sale.aggregate({
          _sum: { total: true },
          where: { soldAt: { gte: start, lte: end } },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: { date: { gte: start, lte: end } },
        }),
      ]);
      return {
        label: format(start, "dd MMM"),
        income: wSales._sum.total ?? 0,
        expenses: wExp._sum.amount ?? 0,
      };
    }),
  );

  return (
    <div className="stack">
      <PageHeader
        title="Reports"
        description="Search by item or category, sales summary, and combined POS + service income."
      />
      <ReportsDashboard
        data={{
          income,
          expenses: expenseTotal,
          receivables: ar,
          pos,
          posRetail,
          posService,
          serviceIncome,
          otherIncome,
          profit: income - expenseTotal,
          expenseByCategory,
          paymentMethods,
          incomeByCategory,
          salesByItem: [...itemMap.values()].sort((a, b) => b.amount - a.amount),
          salesByCategory: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
          saleLines: saleLines.map((l) => ({
            id: l.id,
            description: l.description,
            category: l.product?.category || (l.product?.isService ? "Service — fixed price" : "General"),
            isService: Boolean(l.product?.isService),
            quantity: l.quantity,
            lineTotal: l.lineTotal,
            soldAt: l.sale.soldAt.toISOString(),
            saleNumber: l.sale.number,
            method: l.sale.method,
          })),
          weekly,
        }}
      />
    </div>
  );
}
