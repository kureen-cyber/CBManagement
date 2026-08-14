"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/business";
import { requireCompany } from "@/lib/company";
import { sellingPriceFromMarkup, toCents } from "@/lib/money";

function dollarsToCents(value: FormDataEntryValue | null): number {
  const n = Number(value ?? 0);
  return toCents(Number.isFinite(n) ? n : 0);
}

export async function createCustomer(formData: FormData) {
  const { companyId } = await requireCompany();
  await prisma.customer.create({
    data: {
      companyId,
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      address: String(formData.get("address") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    },
  });
  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/");
}

export async function createSupplier(formData: FormData) {
  const { companyId } = await requireCompany();
  await prisma.supplier.create({
    data: {
      companyId,
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      address: String(formData.get("address") || "") || null,
    },
  });
  revalidatePath("/suppliers");
}

export async function createProduct(formData: FormData) {
  const { companyId } = await requireCompany();
  const trackStock = formData.get("trackStock") === "on";
  const isService = formData.get("isService") === "on";
  const opening = Number(formData.get("stockQty") || 0);
  const category = String(formData.get("category") || "General").trim() || "General";
  const supplierId = String(formData.get("supplierId") || "") || null;

  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
    });
    if (!supplier) throw new Error("Supplier not found");
  }

  const product = await prisma.product.create({
    data: {
      companyId,
      name: String(formData.get("name") || "").trim(),
      sku: String(formData.get("sku") || "") || null,
      category,
      unit: String(formData.get("unit") || "each"),
      unitCost: dollarsToCents(formData.get("unitCost")),
      unitPrice: dollarsToCents(formData.get("unitPrice")),
      minStock: Number(formData.get("minStock") || 0),
      stockQty: isService ? 0 : opening,
      trackStock: isService ? false : trackStock,
      isService,
      supplierId,
    },
  });

  if (!isService && opening !== 0) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "OPENING",
        quantity: opening,
        unitCost: product.unitCost,
        notes: "Opening stock",
      },
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/reports");
  revalidatePath("/");

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    unitCost: product.unitCost,
    unitPrice: product.unitPrice,
    stockQty: product.stockQty,
    minStock: product.minStock,
    trackStock: product.trackStock,
    isService: product.isService,
  };
}

export async function deleteProduct(productId: string) {
  const { companyId } = await requireCompany();
  const id = String(productId || "").trim();
  if (!id) return { error: "Missing product" };

  const product = await prisma.product.findFirst({ where: { id, companyId } });
  if (!product) return { error: "Item not found" };

  await prisma.$transaction([
    prisma.stockMovement.deleteMany({ where: { productId: id } }),
    prisma.saleLine.updateMany({ where: { productId: id }, data: { productId: null } }),
    prisma.invoiceLine.updateMany({ where: { productId: id }, data: { productId: null } }),
    prisma.quotationLine.updateMany({ where: { productId: id }, data: { productId: null } }),
    prisma.jobMaterial.updateMany({ where: { productId: id }, data: { productId: null } }),
    prisma.product.delete({ where: { id } }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/");

  return { ok: true as const, id };
}

export async function createEmployee(formData: FormData) {
  const { companyId } = await requireCompany();
  await prisma.employee.create({
    data: {
      companyId,
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      role: String(formData.get("role") || "") || null,
      hourlyRate: dollarsToCents(formData.get("hourlyRate")),
    },
  });
  revalidatePath("/employees");
}

export async function createExpense(formData: FormData) {
  const { companyId } = await requireCompany();
  const jobId = String(formData.get("jobId") || "") || null;
  const supplierId = String(formData.get("supplierId") || "") || null;

  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error("Job not found");
  }
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
    if (!supplier) throw new Error("Supplier not found");
  }

  await prisma.expense.create({
    data: {
      companyId,
      category: String(formData.get("category") || "Other"),
      description: String(formData.get("description") || "") || null,
      amount: dollarsToCents(formData.get("amount")),
      date: new Date(String(formData.get("date") || new Date().toISOString())),
      paymentMethod: String(formData.get("paymentMethod") || "CASH"),
      jobId,
      supplierId,
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function createQuotation(formData: FormData) {
  const { companyId } = await requireCompany();
  const customerId = String(formData.get("customerId"));
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  const labour = dollarsToCents(formData.get("labourCost"));
  const materials = dollarsToCents(formData.get("materialsCost"));
  const equipment = dollarsToCents(formData.get("equipmentCost"));
  const transport = dollarsToCents(formData.get("transportCost"));
  const markupPct = Number(formData.get("markupPct") || 25);
  const cost = labour + materials + equipment + transport;
  const total = sellingPriceFromMarkup(cost, markupPct);

  await prisma.quotation.create({
    data: {
      companyId,
      number: await nextNumber("Q", "quotation", companyId),
      customerId,
      title: String(formData.get("title") || "") || null,
      notes: String(formData.get("notes") || "") || null,
      labourCost: labour,
      materialsCost: materials,
      equipmentCost: equipment,
      transportCost: transport,
      markupPct,
      subtotal: total,
      total,
      status: "DRAFT",
    },
  });

  revalidatePath("/quotations");
}

export async function acceptAndConvertQuotation(quotationId: string) {
  const { companyId } = await requireCompany();
  const quote = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId },
  });
  if (!quote) return { error: "Quotation not found" };

  if (quote.status === "CONVERTED") {
    return { error: "Already converted" };
  }

  const jobNumber = await nextNumber("JOB", "job", companyId);
  const invoiceNumber = await nextNumber("INV", "invoice", companyId);

  const job = await prisma.job.create({
    data: {
      companyId,
      number: jobNumber,
      customerId: quote.customerId,
      quotationId: quote.id,
      title: quote.title || `Job from ${quote.number}`,
      status: "ACTIVE",
      contractValue: quote.total,
      materials: quote.materialsCost
        ? {
            create: {
              name: "Quoted materials",
              quantity: 1,
              unitCost: quote.materialsCost,
              totalCost: quote.materialsCost,
            },
          }
        : undefined,
    },
  });

  const due = new Date();
  due.setDate(due.getDate() + 14);

  await prisma.invoice.create({
    data: {
      companyId,
      number: invoiceNumber,
      customerId: quote.customerId,
      jobId: job.id,
      quotationId: quote.id,
      status: "SENT",
      dueDate: due,
      subtotal: quote.total,
      taxAmount: 0,
      total: quote.total,
      lines: {
        create: [
          {
            description: quote.title || `Work per ${quote.number}`,
            quantity: 1,
            unitPrice: quote.total,
            lineTotal: quote.total,
          },
        ],
      },
    },
  });

  if (quote.materialsCost > 0) {
    const tracked = await prisma.product.findFirst({
      where: { companyId, trackStock: true, isService: false },
    });
    if (tracked) {
      await prisma.stockMovement.create({
        data: {
          productId: tracked.id,
          type: "USAGE",
          quantity: -1,
          unitCost: tracked.unitCost,
          reference: job.number,
          notes: `Materials for ${job.number}`,
        },
      });
      await prisma.product.update({
        where: { id: tracked.id },
        data: { stockQty: { decrement: 1 } },
      });
    }
  }

  await prisma.quotation.update({
    where: { id: quote.id },
    data: { status: "CONVERTED" },
  });

  revalidatePath("/quotations");
  revalidatePath("/jobs");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/");

  return { jobId: job.id };
}

export async function createInvoice(formData: FormData) {
  const { companyId } = await requireCompany();
  const customerId = String(formData.get("customerId"));
  const jobId = String(formData.get("jobId") || "") || null;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");
  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error("Job not found");
  }

  const total = dollarsToCents(formData.get("total"));
  const due = formData.get("dueDate")
    ? new Date(String(formData.get("dueDate")))
    : null;

  await prisma.invoice.create({
    data: {
      companyId,
      number: await nextNumber("INV", "invoice", companyId),
      customerId,
      jobId,
      status: "SENT",
      dueDate: due,
      subtotal: total,
      total,
      lines: {
        create: [
          {
            description: String(formData.get("description") || "Services"),
            quantity: 1,
            unitPrice: total,
            lineTotal: total,
          },
        ],
      },
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function recordPayment(formData: FormData) {
  const { companyId } = await requireCompany();
  const invoiceId = String(formData.get("invoiceId") || "") || null;
  const amount = dollarsToCents(formData.get("amount"));
  const customerId = String(formData.get("customerId"));

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new Error("Invoice not found");
  }

  await prisma.payment.create({
    data: {
      companyId,
      customerId,
      invoiceId,
      amount,
      method: String(formData.get("method") || "BANK"),
      reference: String(formData.get("reference") || "") || null,
      paidAt: new Date(String(formData.get("paidAt") || new Date().toISOString())),
      notes: String(formData.get("notes") || "") || null,
    },
  });

  if (invoiceId) {
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId },
    });
    const amountPaid = invoice.amountPaid + amount;
    const status =
      amountPaid >= invoice.total ? "PAID" : amountPaid > 0 ? "PARTIAL" : invoice.status;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid, status },
    });
  }

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function createJob(formData: FormData) {
  const { companyId } = await requireCompany();
  const customerId = String(formData.get("customerId"));
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  await prisma.job.create({
    data: {
      companyId,
      number: await nextNumber("JOB", "job", companyId),
      customerId,
      title: String(formData.get("title") || "").trim(),
      contractValue: dollarsToCents(formData.get("contractValue")),
      status: "ACTIVE",
      notes: String(formData.get("notes") || "") || null,
    },
  });
  revalidatePath("/jobs");
}

export async function addTimeEntry(formData: FormData) {
  const { companyId } = await requireCompany();
  const employeeId = String(formData.get("employeeId"));
  const jobId = String(formData.get("jobId") || "") || null;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
  });
  if (!employee) throw new Error("Employee not found");

  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error("Job not found");
  }

  await prisma.timeEntry.create({
    data: {
      employeeId,
      jobId,
      date: new Date(String(formData.get("date") || new Date().toISOString())),
      hours: Number(formData.get("hours") || 0),
      overtimeHours: Number(formData.get("overtimeHours") || 0),
      hourlyRate: employee.hourlyRate,
      notes: String(formData.get("notes") || "") || null,
    },
  });

  revalidatePath("/jobs");
  revalidatePath("/employees");
}

export type PosLineInput = {
  productId: string;
  quantity: number;
};

export async function completePosSale(input: {
  lines: PosLineInput[];
  method: string;
  customerId?: string | null;
  notes?: string;
  posRegisterId?: string | null;
}) {
  const { companyId, company } = await requireCompany();
  const { isFreeRetailTier, parsePlanTier } = await import("@/lib/tier");
  const planTier = parsePlanTier(company.planTier);

  if (!input.lines.length) {
    return { error: "Cart is empty" };
  }

  let posRegisterId: string | null = input.posRegisterId || null;
  if (isFreeRetailTier(planTier)) {
    if (!posRegisterId) {
      return { error: "Select a named POS register (Settings → POS registers)" };
    }
    const reg = await prisma.posRegister.findFirst({
      where: { id: posRegisterId, companyId },
    });
    if (!reg) return { error: "POS register not found" };
  } else if (posRegisterId) {
    const reg = await prisma.posRegister.findFirst({
      where: { id: posRegisterId, companyId },
    });
    if (!reg) posRegisterId = null;
  }

  const products = await prisma.product.findMany({
    where: { companyId, id: { in: input.lines.map((l) => l.productId) } },
  });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const built = input.lines.map((line) => {
    const product = byId[line.productId];
    if (!product) throw new Error("Product missing");
    const lineTotal = Math.round(product.unitPrice * line.quantity);
    return {
      productId: product.id,
      description: product.name,
      quantity: line.quantity,
      unitPrice: product.unitPrice,
      lineTotal,
      trackStock: product.trackStock && !product.isService,
    };
  });

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
    });
    if (!customer) return { error: "Customer not found" };
  }

  const subtotal = built.reduce((s, l) => s + l.lineTotal, 0);
  const taxOn = company.taxEnabled !== false;
  const vatRate = taxOn ? (company.vatRate ?? 0.125) : 0;
  const taxAmount = Math.round(subtotal * vatRate);
  const total = subtotal + taxAmount;

  const sale = await prisma.sale.create({
    data: {
      companyId,
      number: await nextNumber("POS", "sale", companyId),
      customerId: input.customerId || null,
      posRegisterId,
      status: "COMPLETED",
      subtotal,
      taxAmount,
      total,
      amountPaid: total,
      method: input.method || "CASH",
      notes: input.notes || null,
      lines: {
        create: built.map(({ productId, description, quantity, unitPrice, lineTotal }) => ({
          productId,
          description,
          quantity,
          unitPrice,
          lineTotal,
        })),
      },
    },
  });

  for (const line of built) {
    if (!line.trackStock) continue;
    await prisma.stockMovement.create({
      data: {
        productId: line.productId!,
        type: "USAGE",
        quantity: -line.quantity,
        unitCost: byId[line.productId!]?.unitCost ?? 0,
        reference: sale.number,
        notes: "POS sale",
      },
    });
    await prisma.product.update({
      where: { id: line.productId! },
      data: { stockQty: { decrement: line.quantity } },
    });
  }

  if (input.customerId) {
    await prisma.payment.create({
      data: {
        companyId,
        customerId: input.customerId,
        amount: total,
        method: input.method || "CASH",
        reference: sale.number,
        notes: "POS sale",
        paidAt: new Date(),
      },
    });
  } else {
    // Walk-in: use/create a per-company walk-in customer (never another business's customer)
    let walkIn = await prisma.customer.findFirst({
      where: { companyId, name: "Walk-in Customer" },
      orderBy: { createdAt: "asc" },
    });
    if (!walkIn) {
      walkIn = await prisma.customer.create({
        data: { companyId, name: "Walk-in Customer", notes: "Auto-created for POS walk-ins" },
      });
    }
    await prisma.payment.create({
      data: {
        companyId,
        customerId: walkIn.id,
        amount: total,
        method: input.method || "CASH",
        reference: sale.number,
        notes: "POS walk-in sale",
        paidAt: new Date(),
      },
    });
  }

  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/payments");
  revalidatePath("/");

  return { saleId: sale.id, number: sale.number, total, method: input.method || "CASH" };
}
