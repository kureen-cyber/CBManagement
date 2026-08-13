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

  await prisma.company.create({
    data: { name: "Island Works Ltd.", currency: "TTD", vatRate: 0.125, businessType: "BOTH" },
  });

  const abc = await prisma.customer.create({
    data: {
      name: "ABC Construction Ltd.",
      email: "accounts@abcconstruction.tt",
      phone: "868-555-0145",
      address: "San Fernando, Trinidad",
      notes: "Prefers WhatsApp for invoice reminders.",
    },
  });

  const xyz = await prisma.customer.create({
    data: {
      name: "XYZ Ltd.",
      email: "ops@xyz.tt",
      phone: "868-555-0199",
      address: "Port of Spain",
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "Caribbean Electrical Supplies",
      phone: "868-555-0200",
      email: "sales@ces.tt",
    },
  });

  const cable = await prisma.product.create({
    data: {
      name: "Electrical cable 2.5mm",
      sku: "CAB-25",
      unit: "m",
      unitCost: 850,
      unitPrice: 1200,
      stockQty: 750,
      minStock: 200,
      supplierId: supplier.id,
    },
  });

  const outlet = await prisma.product.create({
    data: {
      name: "Wall outlet",
      sku: "OUT-01",
      unit: "each",
      unitCost: 2500,
      unitPrice: 4500,
      stockQty: 40,
      minStock: 10,
      supplierId: supplier.id,
    },
  });

  await prisma.product.create({
    data: {
      name: "Labour — electrician",
      unit: "hour",
      unitCost: 4000,
      unitPrice: 6500,
      trackStock: false,
      isService: true,
    },
  });

  await prisma.stockMovement.createMany({
    data: [
      { productId: cable.id, type: "OPENING", quantity: 500, unitCost: 850, notes: "Opening stock" },
      { productId: cable.id, type: "PURCHASE", quantity: 1000, unitCost: 850, notes: "Restock" },
      { productId: cable.id, type: "USAGE", quantity: -750, unitCost: 850, notes: "Job usage" },
    ],
  });

  const john = await prisma.employee.create({
    data: {
      firstName: "John",
      lastName: "Smith",
      role: "Electrician",
      hourlyRate: 4000,
      phone: "868-555-0301",
    },
  });

  await prisma.employee.create({
    data: {
      firstName: "Maria",
      lastName: "Singh",
      role: "Apprentice",
      hourlyRate: 2500,
    },
  });

  await prisma.quotation.create({
    data: {
      number: "Q-2026-0001",
      customerId: xyz.id,
      title: "Electrical Installation",
      status: "SENT",
      labourCost: 250000,
      materialsCost: 180000,
      equipmentCost: 50000,
      transportCost: 30000,
      markupPct: 25,
      subtotal: 637500,
      total: 637500,
      notes: "Guide example: TT$5,100 cost → TT$6,375 at 25%.",
    },
  });

  const job = await prisma.job.create({
    data: {
      number: "JOB-2026-0145",
      customerId: xyz.id,
      title: "Electrical Installation",
      status: "ACTIVE",
      contractValue: 1850000,
      materials: {
        create: {
          productId: cable.id,
          name: "Electrical cable 2.5mm",
          quantity: 120,
          unitCost: 850,
          totalCost: 102000,
        },
      },
    },
  });

  await prisma.timeEntry.create({
    data: {
      employeeId: john.id,
      jobId: job.id,
      date: new Date(),
      hours: 8,
      overtimeHours: 2,
      hourlyRate: 4000,
      notes: "Site install day 1",
    },
  });

  await prisma.expense.create({
    data: {
      category: "Transport",
      description: "Site fuel",
      amount: 45000,
      paymentMethod: "CASH",
      jobId: job.id,
      supplierId: supplier.id,
      date: new Date(),
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      number: "INV-2026-0001",
      customerId: abc.id,
      status: "SENT",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400000),
      subtotal: 1850000,
      total: 1850000,
      lines: {
        create: [
          {
            description: "Contract progress billing",
            quantity: 1,
            unitPrice: 1850000,
            lineTotal: 1850000,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      customerId: abc.id,
      invoiceId: invoice.id,
      amount: 425000,
      method: "BANK",
      paidAt: new Date(),
      reference: "TTD-TXN-1001",
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: 425000, status: "PARTIAL" },
  });

  await prisma.expense.create({
    data: {
      category: "Materials",
      description: "Shop supplies",
      amount: 118000,
      paymentMethod: "CARD",
      date: new Date(),
    },
  });

  await prisma.sale.create({
    data: {
      number: "POS-2026-0001",
      customerId: abc.id,
      status: "COMPLETED",
      subtotal: 4500,
      total: 4500,
      amountPaid: 4500,
      method: "CASH",
      lines: {
        create: [
          {
            productId: outlet.id,
            description: outlet.name,
            quantity: 1,
            unitPrice: 4500,
            lineTotal: 4500,
          },
        ],
      },
    },
  });

  console.log("Seeded Island Works Ltd. demo data");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
