/**
 * Upsert the interactive demo company without wiping other tenants.
 * Safe for production / shared databases.
 */
import { PrismaClient } from "@prisma/client";
import { ensureDemoCompany } from "../src/lib/seed-demo-company";

const prisma = new PrismaClient();

async function main() {
  const company = await ensureDemoCompany(prisma);
  console.log(`Demo company ready: ${company.name} (${company.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
