/**
 * One-time tenancy backfill after schema push.
 * Assigns any rows missing companyId to the oldest company,
 * then leaves membership claiming to ensureCompanyForUser on login.
 *
 * Run: npx tsx prisma/backfill-tenancy.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Legacy Business",
        currency: "TTD",
        vatRate: 0.125,
        businessType: "BOTH",
      },
    });
    console.log("Created legacy company", company.id);
  }

  const companyId = company.id;
  const tables = [
    "Customer",
    "Supplier",
    "Product",
    "Employee",
    "Quotation",
    "Job",
    "Invoice",
    "Payment",
    "Expense",
    "Sale",
  ] as const;

  for (const table of tables) {
    // Raw SQL because Prisma client rejects null companyId after schema requires it
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "companyId" = $1 WHERE "companyId" IS NULL OR "companyId" = ''`,
      companyId,
    );
    console.log(`Backfilled ${table}:`, result);
  }

  console.log("Done. Oldest company id:", companyId);
  console.log(
    "On next login, users claim orphan companies by matching business name, or get a new empty company.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
