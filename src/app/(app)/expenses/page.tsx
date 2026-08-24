import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { ExpensesClient } from "@/components/ExpensesClient";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  await enforceTierPath("/expenses");
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);

  const [jobs, expenses] = await Promise.all([
    prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: range.start, lte: range.end } },
      orderBy: { date: "desc" },
      include: { job: { select: { number: true } } },
    }),
  ]);

  const categorySuggestions = [
    ...EXPENSE_CATEGORIES,
    "Equipment rental",
    ...expenses.map((e) => e.category),
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Expenses"
        description={`${range.label} · track costs by job and attach sales receipts.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector
          basePath="/expenses"
          range={range}
          isFree={isFreeTier(planTier)}
        />
      </Panel>
      <ExpensesClient
        jobs={jobs.map((j) => ({ id: j.id, number: j.number }))}
        expenses={expenses.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          category: e.category,
          description: e.description,
          amount: e.amount,
          jobNumber: e.job?.number ?? null,
          receiptData: e.receiptData,
        }))}
        categorySuggestions={categorySuggestions}
      />
    </div>
  );
}
