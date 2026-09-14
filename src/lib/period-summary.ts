import { prisma } from "@/lib/prisma";
import { isIncomingPayment } from "@/lib/payment-direction";

export async function fetchPeriodSummary(companyId: string, start: Date, end: Date) {
  const [
    payments,
    expenseSum,
    salesAgg,
    refundAgg,
    invoiceCount,
    jobCount,
    quotationCount,
    expenseCount,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId, paidAt: { gte: start, lte: end } },
      select: {
        amount: true,
        kind: true,
        notes: true,
        reference: true,
        employeeId: true,
        supplierId: true,
        customerId: true,
        invoiceId: true,
        saleId: true,
        employee: { select: { systemRole: true } },
        customer: { select: { name: true } },
        sale: { select: { number: true } },
        invoice: { select: { number: true } },
      },
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
  ]);

  const incoming = payments.filter((p) => isIncomingPayment(p));
  const income = incoming.reduce((sum, p) => sum + p.amount, 0);
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
    paymentCount: incoming.length,
  };
}
