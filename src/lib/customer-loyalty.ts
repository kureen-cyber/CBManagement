import { prisma } from "@/lib/prisma";

export type LoyaltySlice = {
  id: "first-time" | "returning" | "loyal";
  label: string;
  description: string;
  count: number;
  color: string;
};

export type CustomerLoyaltyData = {
  slices: LoyaltySlice[];
  customersWithVisits: number;
  totalVisits: number;
  repeatRatePct: number;
  breakdown: {
    posVisits: number;
    quotations: number;
    jobs: number;
  };
};

/**
 * Customer loyalty by repeat engagement in the period.
 * A visit = POS sale (completed, non-refund), quotation, or job linked to a customer.
 */
export async function fetchCustomerLoyalty(
  companyId: string,
  start: Date,
  end: Date,
): Promise<CustomerLoyaltyData> {
  const [sales, quotations, jobs] = await Promise.all([
    prisma.sale.findMany({
      where: {
        companyId,
        status: "COMPLETED",
        isRefund: false,
        customerId: { not: null },
        soldAt: { gte: start, lte: end },
      },
      select: { customerId: true },
    }),
    prisma.quotation.findMany({
      where: {
        companyId,
        createdAt: { gte: start, lte: end },
      },
      select: { customerId: true },
    }),
    prisma.job.findMany({
      where: {
        companyId,
        createdAt: { gte: start, lte: end },
      },
      select: { customerId: true },
    }),
  ]);

  const visitCounts = new Map<string, number>();
  function bump(customerId: string | null | undefined) {
    if (!customerId) return;
    visitCounts.set(customerId, (visitCounts.get(customerId) || 0) + 1);
  }

  for (const sale of sales) bump(sale.customerId);
  for (const quote of quotations) bump(quote.customerId);
  for (const job of jobs) bump(job.customerId);

  let firstTime = 0;
  let returning = 0;
  let loyal = 0;
  for (const visits of visitCounts.values()) {
    if (visits <= 1) firstTime += 1;
    else if (visits <= 3) returning += 1;
    else loyal += 1;
  }

  const customersWithVisits = visitCounts.size;
  const totalVisits = sales.length + quotations.length + jobs.length;
  const repeatCustomers = returning + loyal;
  const repeatRatePct =
    customersWithVisits > 0 ? Math.round((repeatCustomers / customersWithVisits) * 100) : 0;

  return {
    customersWithVisits,
    totalVisits,
    repeatRatePct,
    breakdown: {
      posVisits: sales.length,
      quotations: quotations.length,
      jobs: jobs.length,
    },
    slices: [
      {
        id: "first-time",
        label: "First-time",
        description: "1 visit",
        count: firstTime,
        color: "#5C6B6E",
      },
      {
        id: "returning",
        label: "Returning",
        description: "2–3 visits",
        count: returning,
        color: "#0e7cc0",
      },
      {
        id: "loyal",
        label: "Loyal",
        description: "4+ visits",
        count: loyal,
        color: "#1f7a4d",
      },
    ],
  };
}
