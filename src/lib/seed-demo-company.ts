import type { PrismaClient } from "@prisma/client";
import { DEMO_COMPANY_NAME } from "@/lib/demo-session";

type Db = PrismaClient;

/**
 * Ensure a dedicated interactive demo company exists with sample retail + service data.
 * Idempotent: returns the existing isDemo company when already seeded.
 */
export async function ensureDemoCompany(db: Db) {
  const existing = await db.company.findFirst({
    where: { isDemo: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    const productCount = await db.product.count({ where: { companyId: existing.id } });
    if (productCount > 0) return existing;
    await wipeDemoCompanyData(db, existing.id);
    return populateDemoCompany(db, existing.id);
  }

  const company = await db.company.create({
    data: {
      name: DEMO_COMPANY_NAME,
      currency: "TTD",
      vatRate: 0.125,
      taxEnabled: true,
      businessType: "BOTH",
      planTier: "STANDARD",
      theme: "red-white-black",
      language: "en",
      homeLayout: "RETAIL_SERVICE",
      receiptPrinting: true,
      featureOpenTickets: true,
      isDemo: true,
      businessAddress: "12 Independence Square, Port of Spain",
      businessContactNumber: "868-555-0100",
      businessEmail: "hello@islandworks.demo",
    },
  });

  return populateDemoCompany(db, company.id);
}

async function wipeDemoCompanyData(db: Db, companyId: string) {
  await db.saleLine.deleteMany({ where: { sale: { companyId } } });
  await db.sale.deleteMany({ where: { companyId } });
  await db.stockMovement.deleteMany({ where: { product: { companyId } } });
  await db.timeEntry.deleteMany({ where: { employee: { companyId } } });
  await db.payment.deleteMany({ where: { companyId } });
  await db.invoiceLine.deleteMany({ where: { invoice: { companyId } } });
  await db.invoice.deleteMany({ where: { companyId } });
  await db.quotationLine.deleteMany({ where: { quotation: { companyId } } });
  await db.jobMaterial.deleteMany({ where: { job: { companyId } } });
  await db.expense.deleteMany({ where: { companyId } });
  await db.job.deleteMany({ where: { companyId } });
  await db.quotation.deleteMany({ where: { companyId } });
  await db.productVariable.deleteMany({ where: { product: { companyId } } });
  await db.product.deleteMany({ where: { companyId } });
  await db.employeePayslip.deleteMany({ where: { companyId } });
  await db.employee.deleteMany({ where: { companyId } });
  await db.supplierPurchase.deleteMany({ where: { companyId } });
  await db.supplierItem.deleteMany({ where: { companyId } });
  await db.supplier.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.discountPreset.deleteMany({ where: { companyId } });
  await db.posRegister.deleteMany({ where: { companyId } });
  await db.inventoryCategory.deleteMany({ where: { companyId } });
  await db.paymentType.deleteMany({ where: { companyId } });
  await db.variableNameCatalog.deleteMany({ where: { companyId } });
  await db.store.deleteMany({ where: { companyId } });
  await db.companyMember.deleteMany({ where: { companyId } });
}

async function populateDemoCompany(db: Db, companyId: string) {
  const { ensureDefaultPaymentTypes, ensureDefaultInventoryCategories } = await import(
    "@/lib/catalog"
  );
  const { ensureStoresForCompany } = await import("@/lib/store");
  const { ensureDefaultLeadershipEmployees } = await import("@/lib/owner-drawings");

  await ensureDefaultPaymentTypes(companyId);
  const stores = await ensureStoresForCompany(companyId);
  const store = stores[0] ?? null;
  if (store) {
    await ensureDefaultInventoryCategories(companyId, store.id);
    const existingReg = await db.posRegister.findFirst({
      where: { companyId, storeId: store.id },
    });
    if (!existingReg) {
      await db.posRegister.create({
        data: { companyId, storeId: store.id, name: "Front counter", sortOrder: 0 },
      });
    }
  } else {
    await ensureDefaultInventoryCategories(companyId);
  }
  await ensureDefaultLeadershipEmployees(companyId);

  const abc = await db.customer.create({
    data: {
      companyId,
      name: "ABC Construction Ltd.",
      email: "accounts@abcconstruction.tt",
      phone: "868-555-0145",
      address: "San Fernando, Trinidad",
      notes: "Prefers WhatsApp for invoice reminders.",
    },
  });

  const xyz = await db.customer.create({
    data: {
      companyId,
      name: "XYZ Ltd.",
      email: "ops@xyz.tt",
      phone: "868-555-0199",
      address: "Port of Spain",
    },
  });

  await db.customer.create({
    data: {
      companyId,
      name: "Walk-in Customer",
      notes: "Auto-created for POS walk-ins",
    },
  });

  const supplier = await db.supplier.create({
    data: {
      companyId,
      name: "Caribbean Electrical Supplies",
      phone: "868-555-0200",
      email: "sales@ces.tt",
    },
  });

  await db.supplierItem.createMany({
    data: [
      {
        companyId,
        supplierId: supplier.id,
        name: "Electrical cable 2.5mm",
        supplyType: "STOCK_ITEM",
        unit: "m",
        unitCost: 850,
      },
      {
        companyId,
        supplierId: supplier.id,
        name: "Wall outlet",
        supplyType: "STOCK_ITEM",
        unit: "each",
        unitCost: 2500,
      },
      {
        companyId,
        supplierId: supplier.id,
        name: "Cordless drill",
        supplyType: "EQUIPMENT",
        unit: "each",
        unitCost: 85000,
      },
    ],
  });

  const cable = await db.product.create({
    data: {
      companyId,
      name: "Electrical cable 2.5mm",
      sku: "CAB-25",
      category: "Hardware",
      unit: "m",
      unitCost: 850,
      unitPrice: 1200,
      stockQty: 750,
      minStock: 200,
      supplierId: supplier.id,
    },
  });

  const outlet = await db.product.create({
    data: {
      companyId,
      name: "Wall outlet",
      sku: "OUT-01",
      category: "Hardware",
      unit: "each",
      unitCost: 2500,
      unitPrice: 4500,
      stockQty: 40,
      minStock: 10,
      supplierId: supplier.id,
    },
  });

  await db.product.create({
    data: {
      companyId,
      name: "Labour — electrician",
      category: "Service — labour",
      unit: "hour",
      unitCost: 4000,
      unitPrice: 6500,
      trackStock: false,
      isService: true,
    },
  });

  await db.product.create({
    data: {
      companyId,
      name: "Bottled water 500ml",
      sku: "WAT-500",
      category: "Grocery",
      unit: "each",
      unitCost: 150,
      unitPrice: 350,
      stockQty: 120,
      minStock: 24,
    },
  });

  await db.stockMovement.createMany({
    data: [
      { productId: cable.id, type: "OPENING", quantity: 500, unitCost: 850, notes: "Opening stock" },
      { productId: cable.id, type: "PURCHASE", quantity: 1000, unitCost: 850, notes: "Restock" },
      { productId: cable.id, type: "USAGE", quantity: -750, unitCost: 850, notes: "Job usage" },
    ],
  });

  const john = await db.employee.create({
    data: {
      companyId,
      firstName: "John",
      lastName: "Smith",
      role: "Electrician",
      hourlyRate: 4000,
      phone: "868-555-0301",
    },
  });

  await db.employee.create({
    data: {
      companyId,
      firstName: "Maria",
      lastName: "Singh",
      role: "Apprentice",
      hourlyRate: 2500,
    },
  });

  await db.quotation.create({
    data: {
      companyId,
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
      notes: "Demo quote: TT$5,100 cost → TT$6,375 at 25%.",
    },
  });

  const job = await db.job.create({
    data: {
      companyId,
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

  await db.timeEntry.create({
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

  await db.expense.create({
    data: {
      companyId,
      category: "Transport",
      description: "Site fuel",
      amount: 45000,
      paymentMethod: "CASH",
      jobId: job.id,
      supplierId: supplier.id,
      date: new Date(),
    },
  });

  const invoice = await db.invoice.create({
    data: {
      companyId,
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

  await db.payment.create({
    data: {
      companyId,
      kind: "OPERATIONAL",
      customerId: abc.id,
      invoiceId: invoice.id,
      amount: 425000,
      method: "BANK",
      paidAt: new Date(),
      reference: "TTD-TXN-1001",
      notes: "Invoice receipt",
    },
  });

  await db.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: 425000, status: "PARTIAL" },
  });

  await db.expense.create({
    data: {
      companyId,
      category: "Materials",
      description: "Shop supplies",
      amount: 118000,
      paymentMethod: "CARD",
      date: new Date(),
    },
  });

  const register = await db.posRegister.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "asc" },
  });

  await db.sale.create({
    data: {
      companyId,
      number: "POS-2026-0001",
      customerId: abc.id,
      posRegisterId: register?.id ?? null,
      status: "COMPLETED",
      subtotal: 4500,
      total: 4500,
      amountPaid: 4500,
      method: "CASH",
      soldAt: new Date(),
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

  await db.discountPreset.create({
    data: {
      companyId,
      name: "Staff 10%",
      percent: 10,
      active: true,
      sortOrder: 0,
    },
  });

  return db.company.findFirstOrThrow({ where: { id: companyId } });
}

/** Wipe all non-demo companies (local seed) then ensure the interactive demo company. */
export async function resetDatabaseWithDemoCompany(db: Db) {
  await db.saleLine.deleteMany();
  await db.sale.deleteMany();
  await db.stockMovement.deleteMany();
  await db.timeEntry.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.invoice.deleteMany();
  await db.quotationLine.deleteMany();
  await db.jobMaterial.deleteMany();
  await db.expense.deleteMany();
  await db.job.deleteMany();
  await db.quotation.deleteMany();
  await db.productVariable.deleteMany();
  await db.product.deleteMany();
  await db.employeePayslip.deleteMany();
  await db.employee.deleteMany();
  await db.supplierPurchase.deleteMany();
  await db.supplierItem.deleteMany();
  await db.supplier.deleteMany();
  await db.customer.deleteMany();
  await db.discountPreset.deleteMany();
  await db.posRegister.deleteMany();
  await db.inventoryCategory.deleteMany();
  await db.paymentType.deleteMany();
  await db.variableNameCatalog.deleteMany();
  await db.store.deleteMany();
  await db.companyMember.deleteMany();
  await db.company.deleteMany();

  return ensureDemoCompany(db);
}
