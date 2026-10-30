import { PrismaClient } from "@prisma/client";
import { resetDatabaseWithDemoCompany } from "../src/lib/seed-demo-company";

const prisma = new PrismaClient();

async function main() {
  const company = await resetDatabaseWithDemoCompany(prisma);
  console.log(`Seeded interactive demo company: ${company.name} (${company.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
