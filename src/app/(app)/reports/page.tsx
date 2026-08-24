import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  isFreeTier,
  parsePlanTier,
} from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
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

function itemDisplayName(description: string, productName?: string | null) {
  const raw = (productName || description || "").replace(/^Refund:\s*/i, "").trim();
  return raw || description;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);
  const { start: rangeStart, end: rangeEnd, label: periodLabel, clamped } = range;

  const [payments, expenses, invoices, expenseRows, paymentRows, saleLines, salesInRange] =
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
          sale: {
            select: {
              number: true,
              soldAt: true,
              method: true,
              isRefund: true,
              discountAmount: true,
              discountPercent: true,
              subtotal: true,
            },
          },
        },
        orderBy: { sale: { soldAt: "desc" } },
      }),
      prisma.sale.findMany({
        where: { companyId, status: "COMPLETED", soldAt: { gte: rangeStart, lte: rangeEnd } },
        select: {
          soldAt: true,
          total: true,
          subtotal: true,
          discountAmount: true,
          isRefund: true,
        },
        orderBy: { soldAt: "asc" },
      }),
    ]);

  const expenseTotal = expenses._sum.amount ?? 0;
  const ar = invoices
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (i.total - i.amountPaid), 0);

  let grossSales = 0;
  let refundsTotal = 0;
  let discountsTotal = 0;
  for (const sale of salesInRange) {
    if (sale.isRefund) {
      refundsTotal += Math.abs(sale.total);
    } else {
      grossSales += Math.max(0, sale.subtotal);
      discountsTotal += Math.max(0, sale.discountAmount);
    }
  }
  const netSales = Math.max(0, grossSales - discountsTotal - refundsTotal);

  let posRetail = 0;
  let posService = 0;
  let cogsTotal = 0;
  const itemMap = new Map<
    string,
    {
      name: string;
      category: string;
      qty: number;
      netSales: number;
      cogs: number;
      isService: boolean;
    }
  >();
  const categoryMap = new Map<string, { category: string; qty: number; amount: number }>();

  for (const line of saleLines) {
    const service = Boolean(line.product?.isService);
    const sign = line.lineTotal < 0 || line.sale.isRefund ? -1 : 1;
    const signedTotal = line.lineTotal;
    const unitCost = line.product?.unitCost ?? 0;
    const lineCogs = service ? 0 : Math.round(unitCost * line.quantity) * sign;
    cogsTotal += lineCogs;

    if (service) posService += signedTotal;
    else posRetail += signedTotal;

    const category =
      line.product?.category || (service ? "Service — fixed price" : "General");
    const name = itemDisplayName(line.description, line.product?.name);
    const key = `${name}::${category}`;
    const existing = itemMap.get(key) || {
      name,
      category,
      qty: 0,
      netSales: 0,
      cogs: 0,
      isService: service,
    };
    existing.qty += line.quantity * sign;
    existing.netSales += signedTotal;
    existing.cogs += lineCogs;
    itemMap.set(key, existing);

    const cat = categoryMap.get(category) || { category, qty: 0, amount: 0 };
    cat.qty += line.quantity * sign;
    cat.amount += signedTotal;
    categoryMap.set(category, cat);
  }

  const pos = posRetail + posService;
  const grossProfit = netSales - Math.max(0, cogsTotal);

  const posPaymentTotal = paymentRows
    .filter(
      (p) =>
        (p.reference || "").startsWith("POS") ||
        (p.notes || "").toLowerCase().includes("pos"),
    )
    .reduce((s, p) => s + p.amount, 0);
  const otherIncome = Math.max(0, (payments._sum.amount ?? 0) - posPaymentTotal);
  const income = Math.max(0, netSales) + otherIncome;
  const serviceIncome = Math.max(0, posService) + otherIncome;

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
    if (row.netSales <= 0) continue;
    const kind = row.isService ? "Service" : "POS retail";
    const key = `${kind}::${row.category}`;
    const cur = incomeByCategoryMap.get(key) || { category: row.category, amount: 0, kind };
    cur.amount += row.netSales;
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
        description={`${periodLabel} · sales summary, by item, and income mix.`}
      />
      <ReportsDashboard
        planTier={planTier}
        periodLabel={periodLabel}
        periodClamped={clamped}
        periodRange={range}
        freeMaxDays={FREE_TIER_MAX_TRANSACTION_DAYS}
        isFree={isFreeTier(planTier)}
        branding={{
          name: company.name,
          receiptHeader: company.receiptHeader,
          businessLogoData: company.businessLogoData,
          receiptLogoData: company.receiptLogoData,
          letterheadData: company.letterheadData,
        }}
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
          grossSales,
          refunds: refundsTotal,
          discounts: discountsTotal,
          netSales,
          cogs: Math.max(0, cogsTotal),
          grossProfit,
          expenseByCategory,
          paymentMethods,
          incomeByCategory,
          salesByItem: [...itemMap.values()]
            .map((r) => ({
              ...r,
              grossProfit: r.netSales - r.cogs,
            }))
            .sort((a, b) => b.netSales - a.netSales),
          salesByCategory: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
          saleLines: saleLines.map((l) => ({
            id: l.id,
            description: l.description,
            category:
              l.product?.category ||
              (l.product?.isService ? "Service — fixed price" : "General"),
            isService: Boolean(l.product?.isService),
            quantity: l.quantity,
            lineTotal: l.lineTotal,
            soldAt: l.sale.soldAt.toISOString(),
            saleNumber: l.sale.number,
            method: l.sale.method,
            isRefund: l.sale.isRefund,
          })),
          weekly,
          dailyEarnings,
        }}
      />
    </div>
  );
}
