import { prisma } from "./prisma";

export function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002",
  );
}

/** Retry a write when a unique number was claimed by a concurrent request. */
export async function retryOnUniqueConstraint<T>(
  fn: () => Promise<T>,
  attempts = 6,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isUniqueConstraintError(err) || i === attempts - 1) throw err;
    }
  }
  throw last;
}

function nextSeqFromNumbers(numbers: string[], prefix: string, year: number): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}-${year}-(\\d+)$`);
  let maxSeq = 0;
  for (const number of numbers) {
    const match = re.exec(String(number || "").trim());
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
  }
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(4, "0")}`;
}

export async function nextNumber(
  prefix: string,
  model: "quotation" | "invoice" | "job" | "sale",
  companyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const startsWith = `${prefix}-${year}-`;
  const rows =
    model === "quotation"
      ? await prisma.quotation.findMany({
          where: { companyId, number: { startsWith } },
          select: { number: true },
        })
      : model === "invoice"
        ? await prisma.invoice.findMany({
            where: { companyId, number: { startsWith } },
            select: { number: true },
          })
        : model === "sale"
          ? await prisma.sale.findMany({
              where: { companyId, number: { startsWith } },
              select: { number: true },
            })
          : await prisma.job.findMany({
              where: { companyId, number: { startsWith } },
              select: { number: true },
            });
  return nextSeqFromNumbers(
    rows.map((r) => r.number),
    prefix,
    year,
  );
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

/** All product and variant SKUs already in use for a company. */
export async function usedInventorySkus(
  companyId: string,
  exceptProductId?: string,
): Promise<Set<string>> {
  const { parseVariableOptions } = await import("@/lib/product-variables");
  const products = await prisma.product.findMany({
    where: {
      companyId,
      ...(exceptProductId ? { id: { not: exceptProductId } } : {}),
    },
    select: { sku: true, variables: { select: { options: true } } },
  });
  const used = new Set<string>();
  for (const p of products) {
    const sku = String(p.sku || "").trim();
    if (sku) used.add(sku.toUpperCase());
    for (const v of p.variables) {
      for (const o of parseVariableOptions(v.options)) {
        const optionSku = String(o.sku || "").trim();
        if (optionSku) used.add(optionSku.toUpperCase());
      }
    }
  }
  return used;
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
