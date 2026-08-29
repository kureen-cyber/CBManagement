import { prisma } from "@/lib/prisma";
import { isSalaryPayment } from "@/lib/owner-drawings";

export type BankMovement = {
  id: string;
  date: Date;
  description: string;
  reference: string;
  type: "in" | "out";
  amount: number;
  category: string;
  runningBalance: number;
};

export type BankLedger = {
  movements: BankMovement[];
  balance: number;
  totalIn: number;
  totalOut: number;
};

function matchCategory(category: string, patterns: RegExp[]) {
  const c = category.trim().toLowerCase();
  return patterns.some((p) => p.test(c));
}

/** Categorize outflows for money-mix actual comparison. */
export function categorizeOutflow(category: string, source: "expense" | "purchase"): string {
  if (source === "purchase") return "materials";
  const c = category.toLowerCase();
  if (matchCategory(c, [/material/i])) return "materials";
  if (matchCategory(c, [/owner.?s?\s*withdraw|owner.?s?\s*draw|drawings?/i])) return "drawings";
  if (matchCategory(c, [/market|advert/i])) return "growth";
  if (
    matchCategory(c, [
      /salary|wage|payroll|rent|utilit|office|transport|maint|insur|fuel|subcontract|equip|loan|capital|reserve|escrow/i,
    ])
  ) {
    return "expenses";
  }
  return "expenses";
}

export async function fetchBankLedger(companyId: string): Promise<BankLedger> {
  const [payments, expenses, purchases, posSales] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId },
      include: { customer: true, invoice: true, sale: true, employee: true, supplier: true },
      orderBy: { paidAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { companyId },
      orderBy: { date: "asc" },
    }),
    prisma.supplierPurchase.findMany({
      where: { companyId },
      include: { supplier: true },
      orderBy: { purchasedAt: "asc" },
    }),
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", isRefund: false },
      orderBy: { soldAt: "asc" },
    }),
  ]);

  type Raw = {
    id: string;
    date: Date;
    description: string;
    reference: string;
    type: "in" | "out";
    amount: number;
    category: string;
  };
  const raw: Raw[] = [];

  for (const p of payments) {
    const salary = isSalaryPayment(p);
    const supplierOut = Boolean(p.supplierId);
    const isOut = salary || supplierOut;
    const employeeName = p.employee
      ? `${p.employee.firstName} ${p.employee.lastName}`.trim()
      : null;

    raw.push({
      id: `pay-${p.id}`,
      date: p.paidAt,
      description: salary
        ? employeeName
          ? `Salary — ${employeeName}`
          : "Owner/manager drawing"
        : supplierOut
          ? `Supplier payment — ${p.supplier?.name || "Supplier"}`
          : p.invoice
            ? `Payment — invoice ${p.invoice.number}`
            : p.sale
              ? `Payment — receipt ${p.sale.number}`
              : `Payment — ${p.customer?.name || "Customer"}`,
      reference: p.reference || p.id.slice(-8).toUpperCase(),
      type: isOut ? "out" : "in",
      amount: p.amount,
      category: salary
        ? employeeName
          ? "expenses"
          : "drawings"
        : supplierOut
          ? "expenses"
          : "Payment received",
    });
  }

  for (const s of posSales) {
    if (payments.some((p) => p.saleId === s.id)) continue;
    raw.push({
      id: `sale-${s.id}`,
      date: s.soldAt,
      description: `POS sale ${s.number}`,
      reference: s.number,
      type: "in",
      amount: s.total,
      category: "POS sales",
    });
  }

  for (const e of expenses) {
    raw.push({
      id: `exp-${e.id}`,
      date: e.date,
      description: e.description || e.category,
      reference: e.id.slice(-8).toUpperCase(),
      type: "out",
      amount: e.amount,
      category: categorizeOutflow(e.category, "expense"),
    });
  }

  for (const p of purchases) {
    raw.push({
      id: `pur-${p.id}`,
      date: p.purchasedAt,
      description: `${p.name} — ${p.supplier.name}`,
      reference: p.id.slice(-8).toUpperCase(),
      type: "out",
      amount: p.totalCost,
      category: "materials",
    });
  }

  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  let totalIn = 0;
  let totalOut = 0;
  const movements: BankMovement[] = raw.map((row) => {
    if (row.type === "in") {
      balance += row.amount;
      totalIn += row.amount;
    } else {
      balance -= row.amount;
      totalOut += row.amount;
    }
    return { ...row, runningBalance: balance };
  });

  return { movements: movements.reverse(), balance, totalIn, totalOut };
}

/**
 * Ending bank cash balance for each calendar month in `year` (length 12, cents),
 * plus cash balance at the start of the year (before January activity).
 */
export async function fetchMonthEndCashBalances(
  companyId: string,
  year: number,
): Promise<{ yearStartBalance: number; monthEnds: number[] }> {
  const ledger = await fetchBankLedger(companyId);
  const chronological = [...ledger.movements].reverse();
  const monthEnds = Array.from(
    { length: 12 },
    (_, m) => new Date(year, m + 1, 0, 23, 59, 59, 999),
  );
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const balances = Array.from({ length: 12 }, () => 0);

  let balance = 0;
  let idx = 0;
  while (idx < chronological.length && chronological[idx]!.date < yearStart) {
    const row = chronological[idx]!;
    balance += row.type === "in" ? row.amount : -row.amount;
    idx += 1;
  }
  const yearStartBalance = balance;
  for (let m = 0; m < 12; m++) {
    const end = monthEnds[m]!;
    while (idx < chronological.length && chronological[idx]!.date <= end) {
      const row = chronological[idx]!;
      balance += row.type === "in" ? row.amount : -row.amount;
      idx += 1;
    }
    balances[m] = balance;
  }
  return { yearStartBalance, monthEnds: balances };
}
