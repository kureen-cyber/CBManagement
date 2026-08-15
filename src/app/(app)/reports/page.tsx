import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  isFreeTier,
  parsePlanTier,
  parseReportPeriod,
  resolveReportRange,
  type ReportPeriodId,
} from "@/lib/tier";
import { PageHeader } from "@/components/ui";
import { ReportsDashboard } from "@/components/ReportsDashboard";

export const dynamic = "force-dynamic";

function weekMeta(dt: Date) {
  const d = new Date(dt);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return { key: d.toISOString(), label: format(d, "dd MMM"), sort: d.getTime() };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const params = await searchParams;
  const periodId = parseReportPeriod(params.period);
  const range = resolveReportRange(planTier, periodId);
  const { start: rangeStart, end: rangeEnd, label: periodLabel, clamped } = range;

  const [payments, expenses, invoices, posSales, expenseRows, paymentRows, saleLines, salesInRange] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { companyId, paidAt: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { companyId, date: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.invoice.findMany({
        where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE", "PAID"] } },
        select: { total: true, amountPaid: true, status: true },
      }),
      prisma.sale.aggregate({
        _sum: { total: true },
        where: { companyId, status: "COMPLETED", soldAt: { gte: rangeStart, lte: rangeEnd } },
      }),
      prisma.expense.findMany({
        where: { companyId, date: { gte: rangeStart, lte: rangeEnd } },
        select: { category: true, amount: true, date: true },
      }),
      prisma.payment.findMany({
        where: { companyId, paidAt: { gte: rangeStart, lte: rangeEnd } },
        select: { method: true, amount: true, reference: true, notes: true },
      }),
      prisma.saleLine.findMany({
        where: {
          sale: { companyId, status: "COMPLETED", soldAt: { gte: rangeStart, lte: rangeEnd } },
        },
        include: {
          product: true,
          sale: { select: { number: true, soldAt: true, method: true } },
        },
        orderBy: { sale: { soldAt: "desc" } },
      }),
      prisma.sale.findMany({
        where: { companyId, status: "COMPLETED", soldAt: { gte: rangeStart, lte: rangeEnd } },
        select: { soldAt: true, total: true },
        orderBy: { soldAt: "asc" },
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

  const posPaymentTotal = paymentRows
    .filter((p) => (p.reference || "").startsWith("POS") || (p.notes || "").toLowerCase().includes("pos"))
    .reduce((s, p) => s + p.amount, 0);
  const otherIncome = Math.max(0, (payments._sum.amount ?? 0) - posPaymentTotal);
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

  const dayKeys = eachDayOfInterval({
    start: startOfDay(rangeStart),
    end: startOfDay(rangeEnd),
  });
  const dailyMap = new Map<string, number>();
  for (const d of dayKeys) dailyMap.set(format(d, "yyyy-MM-dd"), 0);
  for (const sale of salesInRange) {
    const key = format(sale.soldAt, "yyyy-MM-dd");
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + sale.total);
  }
  const dailyEarnings = [...dailyMap.entries()].map(([key, amount]) => ({
    label: format(new Date(`${key}T12:00:00`), "dd MMM"),
    amount,
    date: key,
  }));

  const weeklyMap = new Map<string, { label: string; sort: number; income: number; expenses: number }>();
  for (const sale of salesInRange) {
    const w = weekMeta(sale.soldAt);
    const cur = weeklyMap.get(w.key) || { label: w.label, sort: w.sort, income: 0, expenses: 0 };
    cur.income += sale.total;
    weeklyMap.set(w.key, cur);
  }
  for (const row of expenseRows) {
    const w = weekMeta(row.date);
    const cur = weeklyMap.get(w.key) || { label: w.label, sort: w.sort, income: 0, expenses: 0 };
    cur.expenses += row.amount;
    weeklyMap.set(w.key, cur);
  }
  const weekly = [...weeklyMap.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, income: inc, expenses: exp }) => ({ label, income: inc, expenses: exp }));

  return (
    <div className="stack">
      <PageHeader
        title="Reports"
        description={`${periodLabel} · search by item or category, sales summary, and income mix.`}
      />
      <ReportsDashboard
        planTier={planTier}
        periodId={periodId as ReportPeriodId}
        periodLabel={periodLabel}
        periodClamped={clamped}
        freeMaxDays={FREE_TIER_MAX_TRANSACTION_DAYS}
        isFree={isFreeTier(planTier)}
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
          dailyEarnings,
        }}
      />
    </div>
  );
}
