import { prisma } from "./prisma";

export async function nextNumber(
  prefix: string,
  model: "quotation" | "invoice" | "job" | "sale",
  companyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const where = { companyId };
  const count =
    model === "quotation"
      ? await prisma.quotation.count({ where })
      : model === "invoice"
        ? await prisma.invoice.count({ where })
        : model === "sale"
          ? await prisma.sale.count({ where })
          : await prisma.job.count({ where });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

/** Next inventory SKU for a company, e.g. SKU-0001. */
export async function nextSku(companyId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { companyId },
    select: { sku: true },
  });
  let maxSeq = 0;
  for (const p of products) {
    const match = /^SKU-(\d+)$/i.exec(String(p.sku || "").trim());
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
  }
  if (maxSeq === 0) maxSeq = products.length;
  return `SKU-${String(maxSeq + 1).padStart(4, "0")}`;
}

export type JobProfitability = {
  contractValue: number;
  labourCost: number;
  materialsCost: number;
  expensesCost: number;
  totalCost: number;
  profit: number;
  marginPct: number;
};

export async function getJobProfitability(
  jobId: string,
  companyId?: string,
): Promise<JobProfitability> {
  const job = await prisma.job.findFirstOrThrow({
    where: companyId ? { id: jobId, companyId } : { id: jobId },
    include: {
      materials: true,
      timeEntries: true,
      expenses: true,
      employeeAssignments: true,
    },
  });

  const assignmentLabour = job.employeeAssignments.reduce(
    (sum, a) => sum + Math.round(a.hourlyRate * a.hoursRequired),
    0,
  );
  const timeEntryLabour = job.timeEntries.reduce(
    (sum, t) => sum + Math.round((t.hours + t.overtimeHours * 1.5) * t.hourlyRate),
    0,
  );
  const labourCost = assignmentLabour > 0 ? assignmentLabour : timeEntryLabour;
  const materialsCost = job.materials.reduce((sum, m) => sum + m.totalCost, 0);
  const expensesCost = job.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCost = labourCost + materialsCost + expensesCost;
  const profit = job.contractValue - totalCost;
  const marginPct = job.contractValue === 0 ? 0 : (profit / job.contractValue) * 100;

  return {
    contractValue: job.contractValue,
    labourCost,
    materialsCost,
    expensesCost,
    totalCost,
    profit,
    marginPct,
  };
}
