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
};

/**
 * Customer loyalty by repeat POS visits in the period.
 * A visit = one completed, non-refund sale linked to a customer.
 */
export async function fetchCustomerLoyalty(
  companyId: string,
  start: Date,
  end: Date,
): Promise<CustomerLoyaltyData> {
  const sales = await prisma.sale.findMany({
    where: {
      companyId,
      status: "COMPLETED",
      isRefund: false,
      customerId: { not: null },
      soldAt: { gte: start, lte: end },
    },
    select: { customerId: true },
  });

  const visitCounts = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.customerId) continue;
    visitCounts.set(sale.customerId, (visitCounts.get(sale.customerId) || 0) + 1);
  }

  let firstTime = 0;
  let returning = 0;
  let loyal = 0;
  for (const visits of visitCounts.values()) {
    if (visits <= 1) firstTime += 1;
    else if (visits <= 3) returning += 1;
    else loyal += 1;
  }

  const customersWithVisits = visitCounts.size;
  const totalVisits = sales.length;
  const repeatCustomers = returning + loyal;
  const repeatRatePct =
    customersWithVisits > 0 ? Math.round((repeatCustomers / customersWithVisits) * 100) : 0;

  return {
    customersWithVisits,
    totalVisits,
    repeatRatePct,
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
