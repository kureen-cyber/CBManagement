"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/business";
import { sellingPriceFromMarkup, toCents } from "@/lib/money";

function dollarsToCents(value: FormDataEntryValue | null): number {
  const n = Number(value ?? 0);
  return toCents(Number.isFinite(n) ? n : 0);
}

export async function createCustomer(formData: FormData) {
  await prisma.customer.create({
    data: {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      address: String(formData.get("address") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    },
  });
  revalidatePath("/customers");
  revalidatePath("/demo");
}

export async function createSupplier(formData: FormData) {
  await prisma.supplier.create({
    data: {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      address: String(formData.get("address") || "") || null,
    },
  });
  revalidatePath("/suppliers");
}

export async function createProduct(formData: FormData) {
  const trackStock = formData.get("trackStock") === "on";
  const isService = formData.get("isService") === "on";
  const opening = Number(formData.get("stockQty") || 0);

  const product = await prisma.product.create({
    data: {
      name: String(formData.get("name") || "").trim(),
      sku: String(formData.get("sku") || "") || null,
      unit: String(formData.get("unit") || "each"),
      unitCost: dollarsToCents(formData.get("unitCost")),
      unitPrice: dollarsToCents(formData.get("unitPrice")),
      minStock: Number(formData.get("minStock") || 0),
      stockQty: opening,
      trackStock: isService ? false : trackStock,
      isService,
      supplierId: String(formData.get("supplierId") || "") || null,
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
}

export async function createEmployee(formData: FormData) {
  await prisma.employee.create({
    data: {
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
  await prisma.expense.create({
    data: {
      category: String(formData.get("category") || "Other"),
      description: String(formData.get("description") || "") || null,
      amount: dollarsToCents(formData.get("amount")),
      date: new Date(String(formData.get("date") || new Date().toISOString())),
      paymentMethod: String(formData.get("paymentMethod") || "CASH"),
      jobId: String(formData.get("jobId") || "") || null,
      supplierId: String(formData.get("supplierId") || "") || null,
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function createQuotation(formData: FormData) {
  const labour = dollarsToCents(formData.get("labourCost"));
  const materials = dollarsToCents(formData.get("materialsCost"));
  const equipment = dollarsToCents(formData.get("equipmentCost"));
  const transport = dollarsToCents(formData.get("transportCost"));
  const markupPct = Number(formData.get("markupPct") || 25);
  const cost = labour + materials + equipment + transport;
  const total = sellingPriceFromMarkup(cost, markupPct);

  await prisma.quotation.create({
    data: {
      number: await nextNumber("Q", "quotation"),
      customerId: String(formData.get("customerId")),
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
  const quote = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
  });

  if (quote.status === "CONVERTED") {
    return { error: "Already converted" };
  }

  const jobNumber = await nextNumber("JOB", "job");
  const invoiceNumber = await nextNumber("INV", "invoice");

  const job = await prisma.job.create({
    data: {
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
      where: { trackStock: true, isService: false },
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
  const total = dollarsToCents(formData.get("total"));
  const due = formData.get("dueDate")
    ? new Date(String(formData.get("dueDate")))
    : null;

  await prisma.invoice.create({
    data: {
      number: await nextNumber("INV", "invoice"),
      customerId: String(formData.get("customerId")),
      jobId: String(formData.get("jobId") || "") || null,
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
  const invoiceId = String(formData.get("invoiceId") || "") || null;
  const amount = dollarsToCents(formData.get("amount"));
  const customerId = String(formData.get("customerId"));

  await prisma.payment.create({
    data: {
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
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    const amountPaid = invoice.amountPaid + amount;
    const status =
      amountPaid >= invoice.total ? "PAID" : amountPaid > 0 ? "PARTIAL" : invoice.status;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, status },
    });
  }

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function createJob(formData: FormData) {
  await prisma.job.create({
    data: {
      number: await nextNumber("JOB", "job"),
      customerId: String(formData.get("customerId")),
      title: String(formData.get("title") || "").trim(),
      contractValue: dollarsToCents(formData.get("contractValue")),
      status: "ACTIVE",
      notes: String(formData.get("notes") || "") || null,
    },
  });
  revalidatePath("/jobs");
}

export async function addTimeEntry(formData: FormData) {
  const employeeId = String(formData.get("employeeId"));
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
  });

  await prisma.timeEntry.create({
    data: {
      employeeId,
      jobId: String(formData.get("jobId") || "") || null,
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
}) {
  if (!input.lines.length) {
    return { error: "Cart is empty" };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.lines.map((l) => l.productId) } },
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

  const subtotal = built.reduce((s, l) => s + l.lineTotal, 0);

  const sale = await prisma.sale.create({
    data: {
      number: await nextNumber("POS", "sale"),
      customerId: input.customerId || null,
      status: "COMPLETED",
      subtotal,
      taxAmount: 0,
      total: subtotal,
      amountPaid: subtotal,
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

  // Also log as a payment for dashboard "sales today"
  if (input.customerId) {
    await prisma.payment.create({
      data: {
        customerId: input.customerId,
        amount: subtotal,
        method: input.method || "CASH",
        reference: sale.number,
        notes: "POS sale",
        paidAt: new Date(),
      },
    });
  } else {
    // Walk-in: attach to first customer if exists, else skip payment link
    const walkIn = await prisma.customer.findFirst({ orderBy: { createdAt: "asc" } });
    if (walkIn) {
      await prisma.payment.create({
        data: {
          customerId: walkIn.id,
          amount: subtotal,
          method: input.method || "CASH",
          reference: sale.number,
          notes: "POS walk-in sale",
          paidAt: new Date(),
        },
      });
    }
  }

  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/payments");
  revalidatePath("/");
  revalidatePath("/demo");

  return { saleId: sale.id, number: sale.number, total: subtotal };
}
