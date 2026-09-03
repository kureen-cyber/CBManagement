import { prisma } from "@/lib/prisma";
import { categorizeOutflow } from "@/lib/bank-ledger";
import { isOwnerDrawingPayment } from "@/lib/owner-drawings";

export type MoneyMixBucket = "expenses" | "materials" | "growth" | "reserve" | "drawings";

export type MoneyMixPlan = Record<MoneyMixBucket, number>;

export type MoneyMixSlice = {
  bucket: MoneyMixBucket;
  label: string;
  amount: number;
  pct: number;
  color: string;
};

export const MONEY_MIX_LABELS: Record<MoneyMixBucket, string> = {
  expenses: "Expenses",
  materials: "Materials",
  growth: "Future growth",
  reserve: "Reserve",
  drawings: "Owner's drawings",
};

export const MONEY_MIX_COLORS: Record<MoneyMixBucket, string> = {
  expenses: "#dc2626",
  materials: "#ea580c",
  growth: "#2563eb",
  reserve: "#16a34a",
  drawings: "#7c3aed",
};

export function planFromCompany(company: {
  moneyMixExpensesPct: number;
  moneyMixMaterialsPct: number;
  moneyMixGrowthPct: number;
  moneyMixReservePct: number;
  moneyMixDrawingsPct: number;
}): MoneyMixPlan {
  return {
    expenses: company.moneyMixExpensesPct,
    materials: company.moneyMixMaterialsPct,
    growth: company.moneyMixGrowthPct,
    reserve: company.moneyMixReservePct,
    drawings: company.moneyMixDrawingsPct,
  };
}

export function plannedAllocation(bankBalance: number, plan: MoneyMixPlan): MoneyMixSlice[] {
  const totalPct = Object.values(plan).reduce((s, v) => s + v, 0) || 100;
  return (Object.keys(plan) as MoneyMixBucket[]).map((bucket) => {
    const pct = plan[bucket];
    const normalized = totalPct === 0 ? 0 : (pct / totalPct) * 100;
    const amount = Math.round(bankBalance * (pct / (totalPct || 100)));
    return {
      bucket,
      label: MONEY_MIX_LABELS[bucket],
      amount,
      pct: normalized,
      color: MONEY_MIX_COLORS[bucket],
    };
  });
}

export async function actualSpendingMix(companyId: string): Promise<MoneyMixSlice[]> {
  const [expenses, purchases, salaryPayments] = await Promise.all([
    prisma.expense.findMany({ where: { companyId }, select: { category: true, amount: true } }),
    prisma.supplierPurchase.findMany({ where: { companyId }, select: { totalCost: true } }),
    prisma.payment.findMany({
      where: { companyId },
      select: {
        amount: true,
        kind: true,
        notes: true,
        employeeId: true,
        supplierId: true,
        customer: { select: { name: true } },
        employee: { select: { systemRole: true } },
      },
    }),
  ]);

  const totals: Record<MoneyMixBucket, number> = {
    expenses: 0,
    materials: 0,
    growth: 0,
    reserve: 0,
    drawings: 0,
  };

  for (const e of expenses) {
    const bucket = categorizeOutflow(e.category, "expense") as MoneyMixBucket;
    if (bucket in totals) totals[bucket] += e.amount;
    else totals.expenses += e.amount;
  }
  for (const p of purchases) {
    totals.materials += p.totalCost;
  }
  for (const pay of salaryPayments) {
    if (isOwnerDrawingPayment(pay)) {
      totals.drawings += pay.amount;
    } else if (pay.employeeId || String(pay.notes || "").toLowerCase().startsWith("salary")) {
      totals.expenses += pay.amount;
    } else if (pay.supplierId) {
      totals.expenses += pay.amount;
    }
  }

  const grand = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
  return (Object.keys(totals) as MoneyMixBucket[]).map((bucket) => ({
    bucket,
    label: MONEY_MIX_LABELS[bucket],
    amount: totals[bucket],
    pct: (totals[bucket] / grand) * 100,
    color: MONEY_MIX_COLORS[bucket],
  }));
}
