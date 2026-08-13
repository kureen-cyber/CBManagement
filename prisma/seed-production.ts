/**
 * Production seed — empty business, no demo customers/sales/inventory.
 * Local demo data remains available via `npm run db:seed` (prisma/seed.ts).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.jobMaterial.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.job.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.company.deleteMany();

  // No company row — created on first sign-in from the user's business name.
  console.log("Production DB cleared (no demo data)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
