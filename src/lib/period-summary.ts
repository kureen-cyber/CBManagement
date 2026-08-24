import { prisma } from "@/lib/prisma";

export async function fetchPeriodSummary(companyId: string, start: Date, end: Date) {
  const [
    paymentSum,
    expenseSum,
    salesAgg,
    refundAgg,
    invoiceCount,
    jobCount,
    quotationCount,
    expenseCount,
    paymentCount,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId, paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.sale.aggregate({
      where: {
        companyId,
        status: "COMPLETED",
        isRefund: false,
        soldAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: {
        companyId,
        status: "COMPLETED",
        isRefund: true,
        soldAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    }),
    prisma.invoice.count({
      where: { companyId, issueDate: { gte: start, lte: end } },
    }),
    prisma.job.count({
      where: { companyId, createdAt: { gte: start, lte: end } },
    }),
    prisma.quotation.count({
      where: { companyId, createdAt: { gte: start, lte: end } },
    }),
    prisma.expense.count({
      where: { companyId, date: { gte: start, lte: end } },
    }),
    prisma.payment.count({
      where: { companyId, paidAt: { gte: start, lte: end } },
    }),
  ]);

  const income = paymentSum._sum.amount ?? 0;
  const expenses = expenseSum._sum.amount ?? 0;
  const grossSales = salesAgg._sum.total ?? 0;
  const refunds = Math.abs(refundAgg._sum.total ?? 0);

  return {
    income,
    expenses,
    profit: income - expenses,
    grossSales,
    refunds,
    netSales: Math.max(0, grossSales - refunds),
    invoiceCount,
    jobCount,
    quotationCount,
    expenseCount,
    paymentCount,
  };
}
