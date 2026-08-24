import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { requireCompany } from "@/lib/company";
import { enforceTierPath } from "@/lib/tier-guard";
import { ExpensesClient } from "@/components/ExpensesClient";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await enforceTierPath("/expenses");
  const { companyId } = await requireCompany();
  const [jobs, expenses] = await Promise.all([
    prisma.job.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    prisma.expense.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      include: { job: { select: { number: true } } },
      take: 100,
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
        description="Track costs by job — edit purchase dates and attach sales receipts."
      />
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
