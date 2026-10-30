/**
 * Link companion expenses to supplier payments and settle deferred payables
 * that already have matching payments. Does not delete rows.
 *
 * Run: npx tsx prisma/migrate-dedupe-accounting.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function dayBounds(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function linkSupplierPaymentExpenses() {
  const payments = await prisma.payment.findMany({
    where: { supplierId: { not: null } },
    select: {
      id: true,
      companyId: true,
      supplierId: true,
      amount: true,
      paidAt: true,
      linkedExpense: { select: { id: true } },
    },
  });

  let linked = 0;
  let already = 0;
  let unmatched = 0;

  for (const pay of payments) {
    if (pay.linkedExpense) {
      already += 1;
      continue;
    }
    if (!pay.supplierId) {
      unmatched += 1;
      continue;
    }
    const { start, end } = dayBounds(pay.paidAt);
    const expense = await prisma.expense.findFirst({
      where: {
        companyId: pay.companyId,
        supplierId: pay.supplierId,
        amount: pay.amount,
        paymentId: null,
        date: { gte: start, lte: end },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!expense) {
      unmatched += 1;
      continue;
    }
    await prisma.expense.update({
      where: { id: expense.id },
      data: { paymentId: pay.id },
    });
    linked += 1;
  }

  return { payments: payments.length, linked, already, unmatched };
}

async function linkSalaryPaymentExpenses() {
  const payments = await prisma.payment.findMany({
    where: {
      OR: [{ kind: "SALARY" }, { employeeId: { not: null } }],
    },
    select: {
      id: true,
      companyId: true,
      amount: true,
      paidAt: true,
      linkedExpense: { select: { id: true } },
    },
  });

  let linked = 0;
  let already = 0;
  let unmatched = 0;

  for (const pay of payments) {
    if (pay.linkedExpense) {
      already += 1;
      continue;
    }
    const { start, end } = dayBounds(pay.paidAt);
    const expense = await prisma.expense.findFirst({
      where: {
        companyId: pay.companyId,
        amount: pay.amount,
        paymentId: null,
        date: { gte: start, lte: end },
        OR: [
          { category: { contains: "salar", mode: "insensitive" } },
          { category: { contains: "wage", mode: "insensitive" } },
          { category: { contains: "payroll", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!expense) {
      unmatched += 1;
      continue;
    }
    await prisma.expense.update({
      where: { id: expense.id },
      data: { paymentId: pay.id },
    });
    linked += 1;
  }

  return { payments: payments.length, linked, already, unmatched };
}

async function settleDeferredPayables() {
  const payables = await prisma.supplierPurchase.findMany({
    where: {
      settledPaymentId: null,
      OR: [
        { name: { contains: "Deferred payment", mode: "insensitive" } },
        { notes: { contains: "Deferred payment", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      companyId: true,
      supplierId: true,
      totalCost: true,
      purchasedAt: true,
    },
  });

  let settled = 0;
  let unmatched = 0;

  for (const ap of payables) {
    const payment = await prisma.payment.findFirst({
      where: {
        companyId: ap.companyId,
        supplierId: ap.supplierId,
        amount: ap.totalCost,
        paidAt: { gte: ap.purchasedAt },
      },
      orderBy: { paidAt: "asc" },
      select: { id: true, paidAt: true },
    });
    if (!payment) {
      unmatched += 1;
      continue;
    }
    await prisma.supplierPurchase.update({
      where: { id: ap.id },
      data: {
        settledPaymentId: payment.id,
        settledAt: payment.paidAt,
      },
    });
    settled += 1;
  }

  return { payables: payables.length, settled, unmatched };
}

async function main() {
  console.log("Linking supplier payment companion expenses…");
  const supplier = await linkSupplierPaymentExpenses();
  console.log(supplier);

  console.log("Linking salary payment companion expenses…");
  const salary = await linkSalaryPaymentExpenses();
  console.log(salary);

  console.log("Settling deferred payables that already have payments…");
  const ap = await settleDeferredPayables();
  console.log(ap);

  console.log("Done — no rows deleted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
