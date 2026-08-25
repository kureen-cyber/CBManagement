"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { nextNumber, nextSku } from "@/lib/business";
import { requireCompany } from "@/lib/company";
import { toCents } from "@/lib/money";
import { nextCategoryColor, PRODUCT_IMAGE_MAX_BYTES, RECEIPT_UPLOAD_MAX_BYTES } from "@/lib/settings";
import { parseSupplyLinesJson, quotationEquipmentExpenseAmount } from "@/lib/supply-lines";
import { jobPaymentsComplete, resolveJobStatus } from "@/lib/job-status";
import {
  applyOptionQtyDelta,
  coerceVariableOption,
  findOptionForVariantLabel,
  hasOptionStock,
  parseVariableOptions,
  parseVariantFromDescription,
  resolveOptionUnitPrice,
  serializeVariableOptions,
  sumOptionStock,
  type ProductVariableDef,
  type VariableOption,
} from "@/lib/product-variables";

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const RECEIPT_MIME = new Set([...IMAGE_MIME, "application/pdf"]);

async function productImageFromForm(formData: FormData): Promise<string | null | undefined> {
  if (formData.get("removeImage") === "on") return null;
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (!IMAGE_MIME.has(file.type)) {
    throw new Error("Product photo must be a PNG, JPEG, WebP, or GIF image");
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error(`Product photo must be ${Math.round(PRODUCT_IMAGE_MAX_BYTES / 1000)}KB or smaller`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

async function receiptFromForm(formData: FormData): Promise<string | null | undefined> {
  if (formData.get("removeReceipt") === "on") return null;
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (!RECEIPT_MIME.has(file.type)) {
    throw new Error("Receipt must be a PNG, JPEG, WebP, GIF, or PDF file");
  }
  if (file.size > RECEIPT_UPLOAD_MAX_BYTES) {
    throw new Error(
      `Receipt must be ${Math.round(RECEIPT_UPLOAD_MAX_BYTES / 1000)}KB or smaller`,
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

function dollarsToCents(value: FormDataEntryValue | null): number {
  const n = Number(value ?? 0);
  return toCents(Number.isFinite(n) ? n : 0);
}

/** Recompute and persist job status from engagement dates + invoice payments. */
export async function syncJobStatus(jobId: string, companyId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
    include: { invoices: { select: { total: true, amountPaid: true, status: true } } },
  });
  if (!job) return null;
  // Leave manually cancelled / on-hold alone
  if (job.status === "CANCELLED" || job.status === "ON_HOLD") return job.status;

  const next = resolveJobStatus({
    startDate: job.startDate,
    endDate: job.endDate,
    paymentsComplete: jobPaymentsComplete(job.invoices),
  });
  if (next !== job.status) {
    await prisma.job.update({ where: { id: job.id }, data: { status: next } });
  }
  return next;
}

export async function syncCompanyJobStatuses(companyId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      companyId,
      status: { notIn: ["CANCELLED", "ON_HOLD"] },
    },
    select: { id: true },
  });
  for (const j of jobs) {
    await syncJobStatus(j.id, companyId);
  }
}

async function requireInventoryManageAccess(companyId: string) {
  const access = await resolvePosRegisterAccess(companyId);
  if (!access.canManageInventory) {
    return { error: "Only POS register 1 can manage inventory" as const };
  }
  return { ok: true as const, storeId: access.storeId };
}

async function requireStockAdjustAccess(companyId: string) {
  const access = await resolvePosRegisterAccess(companyId);
  if (!access.canAdjustStock && !access.canManageInventory) {
    return { error: "Stock adjustments are not allowed from this register" as const };
  }
  return { ok: true as const, storeId: access.storeId };
}

async function resolvePosRegisterAccess(companyId: string) {
  const { ensureStoresForCompany } = await import("@/lib/store");
  const stores = await ensureStoresForCompany(companyId);
  const { readActiveRegisterIdFromCookies, readActiveStoreIdFromCookies } =
    await import("@/lib/register-access-server");
  const cookieStoreId = await readActiveStoreIdFromCookies();
  const activeStore = stores.find((s) => s.id === cookieStoreId) || stores[0] || null;

  const registers = await prisma.posRegister.findMany({
    where: {
      companyId,
      ...(activeStore ? { storeId: activeStore.id } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const { resolveRegisterAccess } = await import("@/lib/register-access");
  const access = resolveRegisterAccess(registers, await readActiveRegisterIdFromCookies());
  return { ...access, storeId: activeStore?.id ?? null };
}

type StockMovementInput = {
  type: string;
  quantity: number;
  unitCost: number;
  reference?: string | null;
  notes?: string | null;
};

/** Apply stock delta to a product, updating per-option qty when variables exist. */
async function applyProductStockDelta(
  productId: string,
  quantityDelta: number,
  opts?: {
    variantLabel?: string | null;
    movement?: StockMovementInput;
  },
) {
  const product = await prisma.product.findFirst({
    where: { id: productId },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product || !product.trackStock || product.isService) return;

  const variables: ProductVariableDef[] = product.variables.map((v) => ({
    name: v.name,
    options: parseVariableOptions(v.options),
  }));
  const tracksOptions = hasOptionStock(variables);
  const variantLabel = String(opts?.variantLabel || "").trim();

  await prisma.$transaction(async (tx) => {
    if (opts?.movement) {
      await tx.stockMovement.create({
        data: {
          productId,
          type: opts.movement.type,
          quantity: opts.movement.quantity,
          unitCost: opts.movement.unitCost,
          reference: opts.movement.reference ?? null,
          notes: opts.movement.notes ?? null,
        },
      });
    }

    if (tracksOptions && variantLabel) {
      const applied = applyOptionQtyDelta(variables, variantLabel, quantityDelta);
      if (applied) {
        const nextQty = sumOptionStock(applied);
        await tx.product.update({
          where: { id: productId },
          data: { stockQty: nextQty },
        });
        await tx.productVariable.deleteMany({ where: { productId } });
        await tx.productVariable.createMany({
          data: applied.map((v, i) => ({
            productId,
            name: v.name,
            options: serializeVariableOptions(v.options),
            sortOrder: i,
          })),
        });
        return;
      }
    }

    await tx.product.update({
      where: { id: productId },
      data: { stockQty: { increment: quantityDelta } },
    });
  });
}

/** Attach a product category name to the active store's category list. */
async function ensureCategoryOnActiveStore(companyId: string, category: string) {
  const { ensureStoresForCompany } = await import("@/lib/store");
  const stores = await ensureStoresForCompany(companyId);
  const { readActiveStoreIdFromCookies } = await import("@/lib/register-access-server");
  const cookieStoreId = await readActiveStoreIdFromCookies();
  const storeId = stores.find((s) => s.id === cookieStoreId)?.id || stores[0]?.id;
  if (!storeId) return;

  const existingCat = await prisma.inventoryCategory.findFirst({
    where: { storeId, name: { equals: category, mode: "insensitive" } },
  });
  if (existingCat) return;

  const existingColors = await prisma.inventoryCategory.findMany({
    where: { storeId, color: { not: null } },
    select: { color: true },
  });
  await prisma.inventoryCategory
    .create({
      data: {
        companyId,
        storeId,
        name: category,
        color: nextCategoryColor(existingColors.map((c) => c.color!).filter(Boolean)),
      },
    })
    .catch(() => null);
}

function parseProductVariables(raw: string): ProductVariableDef[] {
  const rawVars = raw.trim();
  if (!rawVars) return [];
  try {
    const parsed = JSON.parse(rawVars) as {
      name?: string;
      options?: Array<string | Record<string, unknown>> | string;
    }[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => {
        const name = String(v.name || "").trim();
        let options: VariableOption[] = [];
        if (Array.isArray(v.options)) {
          options = v.options
            .map((o) => coerceVariableOption(o))
            .filter((o): o is VariableOption => Boolean(o));
        } else {
          options = String(v.options || "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
            .map((label) => coerceVariableOption(label))
            .filter((o): o is VariableOption => Boolean(o));
        }
        return { name, options };
      })
      .filter((v) => v.name && v.options.length);
  } catch {
    return [];
  }
}

function mapProductResponse(product: {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
  variablePrice: boolean;
  stockQty: number;
  minStock: number;
  trackStock: boolean;
  isService: boolean;
  imageData?: string | null;
  variables: { name: string; options: string }[];
}) {
  const variables = product.variables.map((v) => ({
    name: v.name,
    options: parseVariableOptions(v.options),
  }));
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    unitCost: product.unitCost,
    unitPrice: product.unitPrice,
    variablePrice: product.variablePrice,
    stockQty: product.stockQty,
    minStock: product.minStock,
    trackStock: product.trackStock,
    isService: product.isService,
    imageData: product.imageData ?? null,
    variables,
  };
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

export async function deleteCustomer(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("customerId") || "").trim();
  if (!id) return { error: "Missing customer" };

  const customer = await prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      _count: {
        select: {
          quotations: true,
          jobs: true,
          invoices: true,
          payments: true,
        },
      },
    },
  });
  if (!customer) return { error: "Customer not found" };

  const blockers: string[] = [];
  if (customer._count.quotations) blockers.push(`${customer._count.quotations} quotation(s)`);
  if (customer._count.jobs) blockers.push(`${customer._count.jobs} job(s)`);
  if (customer._count.invoices) blockers.push(`${customer._count.invoices} invoice(s)`);
  if (customer._count.payments) blockers.push(`${customer._count.payments} payment(s)`);
  if (blockers.length) {
    return {
      error: `Cannot delete “${customer.name}” while linked to ${blockers.join(", ")}. Remove those records first.`,
    };
  }

  await prisma.$transaction([
    prisma.sale.updateMany({ where: { customerId: id, companyId }, data: { customerId: null } }),
    prisma.expense.updateMany({ where: { customerId: id, companyId }, data: { customerId: null } }),
    prisma.customer.delete({ where: { id } }),
  ]);

  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/");
  return { ok: true as const, id };
}

export async function createSupplier(formData: FormData) {
  const { companyId } = await requireCompany();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Enter a supplier name");
  await prisma.supplier.create({
    data: {
      companyId,
      name,
      address: String(formData.get("address") || "").trim() || null,
      phone: String(formData.get("contact") || formData.get("phone") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      salesRep: String(formData.get("salesRep") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("supplierId") || "").trim();
  if (!id) throw new Error("Missing supplier");

  const supplier = await prisma.supplier.findFirst({ where: { id, companyId } });
  if (!supplier) throw new Error("Supplier not found");

  await prisma.$transaction([
    prisma.product.updateMany({ where: { supplierId: id, companyId }, data: { supplierId: null } }),
    prisma.expense.updateMany({ where: { supplierId: id, companyId }, data: { supplierId: null } }),
    prisma.supplier.delete({ where: { id } }),
  ]);

  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/expenses");
  revalidatePath("/quotations");
}

export async function createSupplierItem(formData: FormData) {
  const { companyId } = await requireCompany();
  const supplierId = String(formData.get("supplierId") || "").trim();
  if (!supplierId) throw new Error("Missing supplier");
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new Error("Supplier not found");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Enter an item name");
  const unit = String(formData.get("unit") || "each").trim() || "each";
  const supplyType = String(formData.get("supplyType") || "MATERIAL").trim() || "MATERIAL";

  await prisma.supplierItem.create({
    data: {
      companyId,
      supplierId,
      name,
      supplyType,
      unit,
      unitCost: dollarsToCents(formData.get("unitCost")),
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/quotations");
}

export async function updateSupplierItem(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  const row = await prisma.supplierItem.findFirst({ where: { id, companyId } });
  if (!row) throw new Error("Supply item not found");

  const name = String(formData.get("name") || "").trim() || row.name;
  const unit = String(formData.get("unit") || "").trim() || row.unit;
  const supplyType = String(formData.get("supplyType") || "").trim() || row.supplyType;

  await prisma.supplierItem.update({
    where: { id },
    data: {
      name,
      supplyType,
      unit,
      unitCost: dollarsToCents(formData.get("unitCost")),
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${row.supplierId}`);
  revalidatePath("/quotations");
}

export async function deleteSupplierItem(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  const supplierId = String(formData.get("supplierId") || "").trim();
  const row = await prisma.supplierItem.findFirst({ where: { id, companyId } });
  if (!row) throw new Error("Item not found");
  await prisma.supplierItem.delete({ where: { id } });
  revalidatePath("/suppliers");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath(`/suppliers/${row.supplierId}`);
  revalidatePath("/quotations");
}

export async function createSupplierPurchase(formData: FormData) {
  const { companyId } = await requireCompany();
  const supplierId = String(formData.get("supplierId") || "").trim();
  if (!supplierId) throw new Error("Missing supplier");
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new Error("Supplier not found");

  const supplierItemId = String(formData.get("supplierItemId") || "").trim() || null;
  let name = String(formData.get("name") || "").trim();
  let unit = String(formData.get("unit") || "each").trim() || "each";
  let unitCost = dollarsToCents(formData.get("unitCost"));

  if (supplierItemId) {
    const catalog = await prisma.supplierItem.findFirst({
      where: { id: supplierItemId, companyId, supplierId },
    });
    if (!catalog) throw new Error("Supply item not found");
    if (!name) name = catalog.name;
    if (!String(formData.get("unit") || "").trim()) unit = catalog.unit;
    if (!String(formData.get("unitCost") || "").trim()) unitCost = catalog.unitCost;
  }
  if (!name) throw new Error("Enter what you bought");

  const quantity = Math.max(0.001, Number(formData.get("quantity") || 1) || 1);
  const totalOverride = String(formData.get("totalCost") || "").trim();
  const totalCost = totalOverride
    ? dollarsToCents(formData.get("totalCost"))
    : Math.round(unitCost * quantity);

  const purchasedAtRaw = String(formData.get("purchasedAt") || "").trim();
  const purchasedAt = purchasedAtRaw ? new Date(purchasedAtRaw) : new Date();

  await prisma.supplierPurchase.create({
    data: {
      companyId,
      supplierId,
      supplierItemId,
      name,
      unit,
      quantity,
      unitCost,
      totalCost,
      purchasedAt: Number.isNaN(purchasedAt.getTime()) ? new Date() : purchasedAt,
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
}

export async function deleteSupplierPurchase(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  const row = await prisma.supplierPurchase.findFirst({ where: { id, companyId } });
  if (!row) throw new Error("Purchase not found");
  await prisma.supplierPurchase.delete({ where: { id } });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${row.supplierId}`);
}

export async function createProduct(formData: FormData) {
  const { companyId } = await requireCompany();
  const access = await requireInventoryManageAccess(companyId);
  if ("error" in access) throw new Error(access.error);
  const trackStock = formData.get("trackStock") === "on";
  const isService = formData.get("isService") === "on";
  const opening = Number(formData.get("stockQty") || 0);
  const category = String(formData.get("category") || "General").trim() || "General";
  const unitPriceCents = dollarsToCents(formData.get("unitPrice"));
  const variablePrice =
    formData.get("variablePrice") === "on" || (!isService && unitPriceCents <= 0);

  // Keep active store category list in sync with free-text / dropdown choices
  await ensureCategoryOnActiveStore(companyId, category);

  let imageData: string | null | undefined;
  try {
    imageData = await productImageFromForm(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload photo" };
  }

  const variables = parseProductVariables(String(formData.get("variablesJson") || ""));
  const manualSku = String(formData.get("sku") || "").trim();
  const sku = manualSku || (await nextSku(companyId));
  const optionStockTotal = hasOptionStock(variables) ? sumOptionStock(variables) : null;
  const resolvedOpening =
    isService ? 0 : optionStockTotal != null ? optionStockTotal : opening;

  const product = await prisma.product.create({
    data: {
      companyId,
      name: String(formData.get("name") || "").trim(),
      sku,
      category,
      unit: String(formData.get("unit") || "each"),
      unitCost: dollarsToCents(formData.get("unitCost")),
      unitPrice: variablePrice ? 0 : unitPriceCents,
      variablePrice,
      minStock: Number(formData.get("minStock") || 0),
      stockQty: resolvedOpening,
      trackStock: isService ? false : trackStock,
      isService,
      ...(imageData !== undefined ? { imageData } : {}),
      variables: {
        create: variables.map((v, i) => ({
          name: v.name,
          options: serializeVariableOptions(v.options),
          sortOrder: i,
        })),
      },
    },
    include: { variables: true },
  });

  for (const v of variables) {
    await prisma.variableNameCatalog
      .upsert({
        where: { companyId_name: { companyId, name: v.name } },
        create: { companyId, name: v.name },
        update: {},
      })
      .catch(() => null);
  }

  if (!isService && resolvedOpening !== 0) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "OPENING",
        quantity: resolvedOpening,
        unitCost: product.unitCost,
        notes:
          optionStockTotal != null
            ? "Opening stock (sum of variable options)"
            : "Opening stock",
      },
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/reports");
  revalidatePath("/");

  return mapProductResponse(product);
}

export async function updateProduct(formData: FormData) {
  const { companyId } = await requireCompany();
  const access = await requireInventoryManageAccess(companyId);
  if ("error" in access) return { error: access.error };

  const id = String(formData.get("productId") || "").trim();
  if (!id) return { error: "Missing product" };

  const existing = await prisma.product.findFirst({
    where: { id, companyId },
    include: { variables: true },
  });
  if (!existing) return { error: "Item not found" };

  const trackStock = formData.get("trackStock") === "on";
  const isService = formData.get("isService") === "on";
  const category = String(formData.get("category") || "General").trim() || "General";
  const unitPriceCents = dollarsToCents(formData.get("unitPrice"));
  const variablePrice =
    formData.get("variablePrice") === "on" || (!isService && unitPriceCents <= 0);

  await ensureCategoryOnActiveStore(companyId, category);

  let imageData: string | null | undefined;
  try {
    imageData = await productImageFromForm(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload photo" };
  }

  const variables = parseProductVariables(String(formData.get("variablesJson") || ""));
  const optionStockTotal = hasOptionStock(variables) ? sumOptionStock(variables) : null;
  const nextStockQty = isService
    ? 0
    : optionStockTotal != null
      ? optionStockTotal
      : existing.stockQty;

  const product = await prisma.$transaction(async (tx) => {
    await tx.productVariable.deleteMany({ where: { productId: id } });

    const updated = await tx.product.update({
      where: { id },
      data: {
        name: String(formData.get("name") || "").trim(),
        sku: String(formData.get("sku") || "") || null,
        category,
        unit: String(formData.get("unit") || "each"),
        unitCost: dollarsToCents(formData.get("unitCost")),
        unitPrice: variablePrice ? 0 : unitPriceCents,
        variablePrice,
        minStock: Number(formData.get("minStock") || 0),
        trackStock: isService ? false : trackStock,
        isService,
        stockQty: nextStockQty,
        ...(imageData !== undefined ? { imageData } : {}),
        variables: {
          create: variables.map((v, i) => ({
            name: v.name,
            options: serializeVariableOptions(v.options),
            sortOrder: i,
          })),
        },
      },
      include: { variables: true },
    });

    return updated;
  });

  if (
    !isService &&
    optionStockTotal != null &&
    optionStockTotal !== existing.stockQty
  ) {
    const delta = optionStockTotal - existing.stockQty;
    if (delta !== 0) {
      await prisma.stockMovement.create({
        data: {
          productId: id,
          type: "ADJUSTMENT",
          quantity: delta,
          unitCost: existing.unitCost,
          notes: "Stock synced from variable option quantities",
        },
      });
    }
  }

  for (const v of variables) {
    await prisma.variableNameCatalog
      .upsert({
        where: { companyId_name: { companyId, name: v.name } },
        create: { companyId, name: v.name },
        update: {},
      })
      .catch(() => null);
  }

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/reports");
  revalidatePath("/");

  return mapProductResponse(product);
}

export async function adjustProductStock(formData: FormData) {
  const { companyId } = await requireCompany();
  const access = await requireStockAdjustAccess(companyId);
  if ("error" in access) return { error: access.error };

  const id = String(formData.get("productId") || "").trim();
  const quantity = Number(formData.get("quantity") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;
  const optionLabel = String(formData.get("optionLabel") || "").trim();

  if (!id) return { error: "Missing product" };
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { error: "Enter a quantity to add or remove" };
  }

  const product = await prisma.product.findFirst({
    where: { id, companyId },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product) return { error: "Item not found" };
  if (product.isService) return { error: "Services do not track stock" };
  if (!product.trackStock) return { error: "This item does not track stock" };

  const variables: ProductVariableDef[] = product.variables.map((v) => ({
    name: v.name,
    options: parseVariableOptions(v.options),
  }));
  const tracksOptions = hasOptionStock(variables);

  if (tracksOptions && !optionLabel) {
    return { error: "Choose which option (e.g. colour) to adjust" };
  }

  let nextVariables = variables;
  let nextQty = product.stockQty + quantity;

  if (tracksOptions) {
    const variantLabel =
      variables.length === 1
        ? `${variables[0]!.name}: ${optionLabel}`
        : optionLabel.includes(":")
          ? optionLabel
          : `${variables[0]!.name}: ${optionLabel}`;
    const hit = findOptionForVariantLabel(variables, variantLabel);
    if (!hit) return { error: "Selected option was not found on this item" };
    if (hit.option.qty + quantity < 0) {
      return {
        error: `Cannot reduce ${hit.option.label} below zero (current: ${hit.option.qty})`,
      };
    }
    const applied = applyOptionQtyDelta(variables, variantLabel, quantity);
    if (!applied) return { error: "Could not update option stock" };
    nextVariables = applied;
    nextQty = sumOptionStock(applied);
  } else if (nextQty < 0) {
    return { error: `Cannot reduce below zero (current: ${product.stockQty})` };
  }

  const unitCost =
    formData.get("unitCost") != null && String(formData.get("unitCost")).trim() !== ""
      ? dollarsToCents(formData.get("unitCost"))
      : product.unitCost;

  const movementType = quantity > 0 ? "PURCHASE" : "ADJUSTMENT";
  const defaultNotes = quantity > 0 ? "Stock received" : "Stock adjustment";
  const optionNote = optionLabel ? ` (${optionLabel})` : "";

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        productId: id,
        type: movementType,
        quantity,
        unitCost,
        notes: (notes || defaultNotes) + optionNote,
      },
    });
    await tx.product.update({
      where: { id },
      data: {
        stockQty: nextQty,
        unitCost: quantity > 0 ? unitCost : product.unitCost,
      },
    });
    if (tracksOptions) {
      await tx.productVariable.deleteMany({ where: { productId: id } });
      await tx.productVariable.createMany({
        data: nextVariables.map((v, i) => ({
          productId: id,
          name: v.name,
          options: serializeVariableOptions(v.options),
          sortOrder: i,
        })),
      });
    }
  });

  revalidatePath("/inventory");
  revalidatePath("/pos");
  revalidatePath("/reports");
  revalidatePath("/");

  return {
    ok: true as const,
    id,
    stockQty: nextQty,
    variables: nextVariables,
  };
}

export async function deleteProduct(productId: string) {
  const { companyId } = await requireCompany();
  const access = await requireInventoryManageAccess(companyId);
  if ("error" in access) return { error: access.error };
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

  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error("Job not found");
  }

  let receiptData: string | null | undefined;
  try {
    receiptData = await receiptFromForm(formData);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Could not upload receipt");
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
      ...(receiptData !== undefined ? { receiptData } : {}),
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function updateExpense(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing expense");

  const existing = await prisma.expense.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Expense not found");

  const dateRaw = String(formData.get("date") || "").trim();
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : existing.date;
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

  let receiptData: string | null | undefined;
  try {
    receiptData = await receiptFromForm(formData);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Could not upload receipt");
  }

  await prisma.expense.update({
    where: { id },
    data: {
      date,
      ...(receiptData !== undefined ? { receiptData } : {}),
    },
  });
  revalidatePath("/expenses");
  if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function deleteExpense(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing expense");

  const existing = await prisma.expense.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Expense not found");

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function addJobReceipt(formData: FormData) {
  const { companyId } = await requireCompany();
  const jobId = String(formData.get("jobId") || "").trim();
  if (!jobId) throw new Error("Missing job");

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) throw new Error("Job not found");

  let receiptData: string | null | undefined;
  try {
    receiptData = await receiptFromForm(formData);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Could not upload receipt");
  }
  if (!receiptData) throw new Error("Choose a receipt file to upload");

  await prisma.jobReceipt.create({
    data: {
      jobId,
      receiptData,
      label: String(formData.get("label") || "").trim() || null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteJobReceipt(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  const row = await prisma.jobReceipt.findFirst({
    where: { id, job: { companyId } },
    include: { job: { select: { id: true } } },
  });
  if (!row) throw new Error("Receipt not found");
  await prisma.jobReceipt.delete({ where: { id } });
  revalidatePath(`/jobs/${row.job.id}`);
}

function parseQuotationExtraCosts(formData: FormData) {
  let extraCosts: { label: string; cost: number }[] = [];
  const rawExtras = String(formData.get("extraCostsJson") || "").trim();
  if (rawExtras) {
    try {
      const parsed = JSON.parse(rawExtras) as { name?: string; amount?: string | number }[];
      if (Array.isArray(parsed)) {
        extraCosts = parsed
          .map((e) => ({
            label: String(e.name || "").trim(),
            cost: dollarsToCents(e.amount as FormDataEntryValue),
          }))
          .filter((e) => e.label && e.cost > 0);
      }
    } catch {
      /* ignore bad JSON */
    }
  }
  return extraCosts;
}

function parseSupplyLinesFromForm(formData: FormData): string | null {
  const raw = String(formData.get("supplyLinesJson") || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return raw;
  } catch {
    return null;
  }
}

async function buildQuotationPayload(formData: FormData, companyId: string) {
  const customerId = String(formData.get("customerId"));
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  const labour = dollarsToCents(formData.get("labourCost"));
  const materials = dollarsToCents(formData.get("materialsCost"));
  const equipment = dollarsToCents(formData.get("equipmentCost"));
  const transport = dollarsToCents(formData.get("transportCost"));
  const fixedPrice = formData.get("fixedPrice") === "on";
  let markupPct = Number(formData.get("markupPct") || 25);
  if (!Number.isFinite(markupPct) || markupPct < 0) markupPct = 0;

  const extraCosts = parseQuotationExtraCosts(formData);
  const otherCost = extraCosts.reduce((s, e) => s + e.cost, 0);

  const { quotationSellTotal } = await import("@/lib/quotation-pricing");
  let total: number;
  if (fixedPrice) {
    markupPct = 0;
    const fixed = dollarsToCents(formData.get("fixedPriceAmount"));
    total = quotationSellTotal(labour, materials, equipment, transport, 0, true, fixed, extraCosts);
  } else {
    total = quotationSellTotal(
      labour,
      materials,
      equipment,
      transport,
      markupPct,
      false,
      undefined,
      extraCosts,
    );
  }

  return {
    customerId,
    title: String(formData.get("title") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    labourCost: labour,
    materialsCost: materials,
    equipmentCost: equipment,
    transportCost: transport,
    otherCost,
    markupPct,
    fixedPrice,
    subtotal: total,
    total,
    extraCosts,
    supplyLinesJson: parseSupplyLinesFromForm(formData),
  };
}

export async function createQuotation(formData: FormData) {
  const { companyId } = await requireCompany();
  const payload = await buildQuotationPayload(formData, companyId);

  await prisma.quotation.create({
    data: {
      companyId,
      number: await nextNumber("Q", "quotation", companyId),
      customerId: payload.customerId,
      title: payload.title,
      notes: payload.notes,
      labourCost: payload.labourCost,
      materialsCost: payload.materialsCost,
      equipmentCost: payload.equipmentCost,
      transportCost: payload.transportCost,
      otherCost: payload.otherCost,
      markupPct: payload.markupPct,
      fixedPrice: payload.fixedPrice,
      subtotal: payload.subtotal,
      total: payload.total,
      supplyLinesJson: payload.supplyLinesJson,
      status: "DRAFT",
      lines: {
        create: payload.extraCosts.map((e) => ({
          description: e.label,
          category: "CUSTOM",
          quantity: 1,
          unitCost: e.cost,
          unitPrice: e.cost,
          lineTotal: e.cost,
        })),
      },
    },
  });

  revalidatePath("/quotations");
}

export async function updateQuotation(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("quotationId") || "").trim();
  if (!id) throw new Error("Missing quotation");

  const existing = await prisma.quotation.findFirst({
    where: { id, companyId },
    include: { lines: true },
  });
  if (!existing) throw new Error("Quotation not found");
  if (existing.status === "CONVERTED") {
    throw new Error("Converted quotations cannot be edited");
  }

  const payload = await buildQuotationPayload(formData, companyId);

  await prisma.$transaction([
    prisma.quotationLine.deleteMany({
      where: {
        quotationId: id,
        category: { in: ["CUSTOM", "OTHER"] },
      },
    }),
    prisma.quotation.update({
      where: { id },
      data: {
        customerId: payload.customerId,
        title: payload.title,
        notes: payload.notes,
        labourCost: payload.labourCost,
        materialsCost: payload.materialsCost,
        equipmentCost: payload.equipmentCost,
        transportCost: payload.transportCost,
        otherCost: payload.otherCost,
        markupPct: payload.markupPct,
        fixedPrice: payload.fixedPrice,
        subtotal: payload.subtotal,
        total: payload.total,
        supplyLinesJson: payload.supplyLinesJson,
        lines: {
          create: payload.extraCosts.map((e) => ({
            description: e.label,
            category: "CUSTOM",
            quantity: 1,
            unitCost: e.cost,
            unitPrice: e.cost,
            lineTotal: e.cost,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  redirect(`/quotations/${id}`);
}

export async function deleteQuotation(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("quotationId") || "").trim();
  if (!id) throw new Error("Missing quotation");

  const quote = await prisma.quotation.findFirst({
    where: { id, companyId },
    include: { job: { select: { id: true } }, invoice: { select: { id: true } } },
  });
  if (!quote) throw new Error("Quotation not found");
  if (quote.status === "CONVERTED" || quote.job || quote.invoice) {
    throw new Error("Cannot delete a quotation that was converted to a job and invoice");
  }

  await prisma.quotation.delete({ where: { id } });
  revalidatePath("/quotations");
  redirect("/quotations");
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
  const conversionDate = new Date();

  const job = await prisma.job.create({
    data: {
      companyId,
      number: jobNumber,
      customerId: quote.customerId,
      quotationId: quote.id,
      title: quote.title || `Job from ${quote.number}`,
      status: "UPDATE_ENGAGEMENT_PERIOD",
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

  // Due date is set when the job engagement end date is chosen
  await prisma.invoice.create({
    data: {
      companyId,
      number: invoiceNumber,
      customerId: quote.customerId,
      jobId: job.id,
      quotationId: quote.id,
      status: "SENT",
      dueDate: null,
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

  const supplyLines = parseSupplyLinesJson(quote.supplyLinesJson);
  const equipmentExpenseAmount = quotationEquipmentExpenseAmount(quote.equipmentCost, supplyLines);

  if (equipmentExpenseAmount > 0) {
    await prisma.expense.upsert({
      where: {
        sourceQuotationId_autoExpenseKind: {
          sourceQuotationId: quote.id,
          autoExpenseKind: "EQUIPMENT",
        },
      },
      create: {
        companyId,
        category: "Equipment",
        description: `Equipment for ${job.number} (from ${quote.number})`,
        amount: equipmentExpenseAmount,
        date: conversionDate,
        paymentMethod: "CASH",
        jobId: job.id,
        sourceQuotationId: quote.id,
        autoExpenseKind: "EQUIPMENT",
      },
      update: {
        amount: equipmentExpenseAmount,
        description: `Equipment for ${job.number} (from ${quote.number})`,
        jobId: job.id,
        date: conversionDate,
      },
    });
  }

  await prisma.quotation.update({
    where: { id: quote.id },
    data: { status: "CONVERTED" },
  });

  revalidatePath("/quotations");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/expenses");
  revalidatePath("/");

  redirect(`/jobs/${job.id}`);
}

export async function updateJobEngagement(formData: FormData) {
  const { companyId } = await requireCompany();
  const jobId = String(formData.get("jobId") || "").trim();
  if (!jobId) return { error: "Missing job" };

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) return { error: "Job not found" };

  const startRaw = String(formData.get("startDate") || "").trim();
  const endRaw = String(formData.get("endDate") || "").trim();
  if (!startRaw || !endRaw) return { error: "Select both a start and end date" };

  const startDate = new Date(`${startRaw}T00:00:00`);
  const endDate = new Date(`${endRaw}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Invalid dates" };
  }
  if (endDate < startDate) {
    return { error: "End date must be on or after the start date" };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { startDate, endDate },
  });

  // Keep linked invoice due dates aligned with the job engagement end date
  await prisma.invoice.updateMany({
    where: {
      jobId,
      companyId,
      status: { notIn: ["VOID", "CANCELLED"] },
    },
    data: { dueDate: endDate },
  });

  await syncJobStatus(jobId, companyId);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/engagement`);
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true as const };
}

export async function createInvoice(formData: FormData) {
  const { companyId } = await requireCompany();
  const customerId = String(formData.get("customerId"));
  const jobId = String(formData.get("jobId") || "") || null;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  let due: Date | null = formData.get("dueDate")
    ? new Date(String(formData.get("dueDate")))
    : null;

  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
    if (!job) throw new Error("Job not found");
    // Job invoices use the engagement end date as the due date when set
    if (job.endDate) due = job.endDate;
  }

  const total = dollarsToCents(formData.get("total"));

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

  if (jobId) {
    await syncJobStatus(jobId, companyId);
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
  }

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

    if (invoice.jobId) {
      await syncJobStatus(invoice.jobId, companyId);
      revalidatePath(`/jobs/${invoice.jobId}`);
      revalidatePath("/jobs");
    }
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
      status: "UPDATE_ENGAGEMENT_PERIOD",
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

export async function assignEmployeeToJob(formData: FormData) {
  const { companyId } = await requireCompany();
  const jobId = String(formData.get("jobId") || "").trim();
  const employeeId = String(formData.get("employeeId") || "").trim();
  if (!jobId || !employeeId) throw new Error("Missing job or employee");

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) throw new Error("Job not found");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, active: true },
  });
  if (!employee) throw new Error("Employee not found");

  const existing = await prisma.jobEmployee.findUnique({
    where: { jobId_employeeId: { jobId, employeeId } },
  });
  if (existing) throw new Error("Employee is already assigned to this job");

  const hourlyRateRaw = String(formData.get("hourlyRate") || "").trim();
  const hourlyRate = hourlyRateRaw
    ? dollarsToCents(formData.get("hourlyRate"))
    : employee.hourlyRate;
  const hoursRequired = Math.max(0, Number(formData.get("hoursRequired") || 0) || 0);

  await prisma.jobEmployee.create({
    data: { jobId, employeeId, hourlyRate, hoursRequired },
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function updateJobEmployee(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing assignment");

  const row = await prisma.jobEmployee.findFirst({
    where: { id, job: { companyId } },
    include: { job: { select: { id: true } } },
  });
  if (!row) throw new Error("Assignment not found");

  const hourlyRate = dollarsToCents(formData.get("hourlyRate"));
  const hoursRequired = Math.max(0, Number(formData.get("hoursRequired") || 0) || 0);

  await prisma.jobEmployee.update({
    where: { id },
    data: { hourlyRate, hoursRequired },
  });
  revalidatePath(`/jobs/${row.job.id}`);
  revalidatePath("/jobs");
}

export async function removeJobEmployee(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing assignment");

  const row = await prisma.jobEmployee.findFirst({
    where: { id, job: { companyId } },
    include: { job: { select: { id: true } } },
  });
  if (!row) throw new Error("Assignment not found");

  await prisma.jobEmployee.delete({ where: { id } });
  revalidatePath(`/jobs/${row.job.id}`);
  revalidatePath("/jobs");
}

export async function assignEmployeeToInvoice(formData: FormData) {
  const { companyId } = await requireCompany();
  const invoiceId = String(formData.get("invoiceId") || "").trim();
  const employeeId = String(formData.get("employeeId") || "").trim();
  if (!invoiceId || !employeeId) throw new Error("Missing invoice or employee");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) throw new Error("Invoice not found");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, active: true },
  });
  if (!employee) throw new Error("Employee not found");

  const existing = await prisma.invoiceEmployee.findUnique({
    where: { invoiceId_employeeId: { invoiceId, employeeId } },
  });
  if (existing) throw new Error("Employee is already assigned to this invoice");

  await prisma.invoiceEmployee.create({
    data: { invoiceId, employeeId },
  });
  revalidatePath(`/invoices/${invoiceId}`);
  if (invoice.jobId) revalidatePath(`/jobs/${invoice.jobId}`);
}

export async function removeInvoiceEmployee(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing assignment");

  const row = await prisma.invoiceEmployee.findFirst({
    where: { id, invoice: { companyId } },
    include: { invoice: { select: { id: true, jobId: true } } },
  });
  if (!row) throw new Error("Assignment not found");

  await prisma.invoiceEmployee.delete({ where: { id } });
  revalidatePath(`/invoices/${row.invoice.id}`);
  if (row.invoice.jobId) revalidatePath(`/jobs/${row.invoice.jobId}`);
}

export type PosLineInput = {
  productId: string;
  quantity: number;
  /** Cents — required when product.variablePrice */
  unitPrice?: number;
  /** e.g. Colour: Red, Size: L */
  variantLabel?: string;
};

async function buildPosLines(
  companyId: string,
  lines: PosLineInput[],
  opts?: { enforceOutOfStock?: boolean },
) {
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: lines.map((l) => l.productId) } },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const outOfStock: { name: string; requested: number; available: number }[] = [];

  const built = lines.map((line) => {
    const product = byId[line.productId];
    if (!product) throw new Error("Product missing");
    const trackStock = product.trackStock && !product.isService;
    const variables: ProductVariableDef[] = product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options),
    }));
    const tracksOptions = hasOptionStock(variables);
    const variant = String(line.variantLabel || "").trim();

    if (trackStock) {
      if (tracksOptions) {
        if (!variant) {
          outOfStock.push({
            name: product.name,
            requested: line.quantity,
            available: 0,
          });
        } else {
          const hit = findOptionForVariantLabel(variables, variant);
          const available = hit?.option.qty ?? 0;
          if (!hit || available < line.quantity) {
            outOfStock.push({
              name: hit ? `${product.name} (${hit.option.label})` : product.name,
              requested: line.quantity,
              available,
            });
          }
        }
      } else if (product.stockQty < line.quantity) {
        outOfStock.push({
          name: product.name,
          requested: line.quantity,
          available: product.stockQty,
        });
      }
    }

    let unitPrice = product.unitPrice;
    const optionHit = variant ? findOptionForVariantLabel(variables, variant) : null;
    const resolvedOptionPrice =
      optionHit != null
        ? resolveOptionUnitPrice(optionHit.option, product.unitPrice, product.variablePrice)
        : null;

    if (resolvedOptionPrice != null) {
      unitPrice = resolvedOptionPrice;
    } else if (product.variablePrice) {
      const override = Number(line.unitPrice);
      if (!Number.isFinite(override) || override < 0) {
        throw new Error(`Enter a price for ${product.name}`);
      }
      unitPrice = Math.round(override);
    } else if (line.unitPrice != null && Number.isFinite(line.unitPrice)) {
      // Ignore client overrides for fixed-price items without per-option pricing
      unitPrice = product.unitPrice;
    }

    const description = variant ? `${product.name} (${variant})` : product.name;
    const lineTotal = Math.round(unitPrice * line.quantity);
    return {
      productId: product.id,
      description,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      trackStock,
      variantLabel: variant || undefined,
      variables,
      tracksOptions,
    };
  });

  if (opts?.enforceOutOfStock && outOfStock.length) {
    return { error: "out_of_stock" as const, outOfStock, built, byId };
  }

  return { built, byId, outOfStock };
}

/** Save or update an OPEN ticket (no payment / no stock movement yet). */
export async function saveOpenTicket(input: {
  ticketId?: string | null;
  lines: PosLineInput[];
  method?: string;
  customerId?: string | null;
  notes?: string;
  posRegisterId?: string | null;
}) {
  const { companyId, company } = await requireCompany();
  if (!company.featureOpenTickets) {
    return { error: "Open tickets are disabled. Enable them in Settings → Features." };
  }
  if (!input.lines.length) return { error: "Cart is empty" };

  const builtResult = await buildPosLines(companyId, input.lines);
  if ("error" in builtResult && builtResult.error) {
    return { error: "Could not save ticket" };
  }
  const { built } = builtResult;
  const subtotal = built.reduce((s, l) => s + l.lineTotal, 0);
  const taxOn = company.taxEnabled !== false;
  const vatRate = taxOn ? (company.vatRate ?? 0.125) : 0;
  const taxAmount = Math.round(subtotal * vatRate);
  const total = subtotal + taxAmount;

  let posRegisterId: string | null = input.posRegisterId || null;
  if (posRegisterId) {
    const reg = await prisma.posRegister.findFirst({
      where: { id: posRegisterId, companyId },
    });
    if (!reg) posRegisterId = null;
  }

  if (input.ticketId) {
    const existing = await prisma.sale.findFirst({
      where: { id: input.ticketId, companyId, status: "OPEN" },
    });
    if (!existing) return { error: "Open ticket not found" };
    await prisma.saleLine.deleteMany({ where: { saleId: existing.id } });
    const sale = await prisma.sale.update({
      where: { id: existing.id },
      data: {
        customerId: input.customerId || null,
        posRegisterId,
        method: input.method || existing.method || "CASH",
        notes: input.notes || null,
        subtotal,
        taxAmount,
        total,
        amountPaid: 0,
        lines: {
          create: built.map(
            ({ productId, description, quantity, unitPrice, lineTotal, variantLabel }) => ({
              productId,
              description,
              quantity,
              unitPrice,
              lineTotal,
              variantLabel: variantLabel ?? null,
            }),
          ),
        },
      },
    });
    revalidatePath("/pos");
    return { ticketId: sale.id, number: sale.number };
  }

  const sale = await prisma.sale.create({
    data: {
      companyId,
      number: await nextNumber("TKT", "sale", companyId),
      customerId: input.customerId || null,
      posRegisterId,
      status: "OPEN",
      subtotal,
      taxAmount,
      total,
      amountPaid: 0,
      method: input.method || "CASH",
      notes: input.notes || null,
      lines: {
        create: built.map(
          ({ productId, description, quantity, unitPrice, lineTotal, variantLabel }) => ({
            productId,
            description,
            quantity,
            unitPrice,
            lineTotal,
            variantLabel: variantLabel ?? null,
          }),
        ),
      },
    },
  });

  revalidatePath("/pos");
  return { ticketId: sale.id, number: sale.number };
}

export async function voidOpenTicket(ticketId: string, posRegisterId?: string | null) {
  const { companyId } = await requireCompany();
  const registers = await prisma.posRegister.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const { resolveRegisterAccess } = await import("@/lib/register-access");
  const { readActiveRegisterIdFromCookies } = await import("@/lib/register-access-server");
  const cookieReg = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(registers, posRegisterId || cookieReg);
  if (!access.canVoidTickets) {
    return { error: "Only POS register 1 can delete/void saved tickets." };
  }

  const sale = await prisma.sale.findFirst({
    where: { id: ticketId, companyId, status: "OPEN" },
  });
  if (!sale) return { error: "Open ticket not found" };
  await prisma.sale.update({
    where: { id: sale.id },
    data: { status: "VOID" },
  });
  revalidatePath("/pos");
  return { ok: true as const };
}

export async function setActivePosRegister(registerId: string) {
  const { companyId } = await requireCompany();
  const { cookies } = await import("next/headers");
  const { POS_REGISTER_COOKIE } = await import("@/lib/register-access");
  const id = String(registerId || "").trim();
  if (id) {
    const reg = await prisma.posRegister.findFirst({ where: { id, companyId } });
    if (!reg) return { error: "Register not found" };
  }
  const store = await cookies();
  if (!id) {
    store.delete(POS_REGISTER_COOKIE);
  } else {
    store.set(POS_REGISTER_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/pos");
  revalidatePath("/inventory");
  revalidatePath("/");
  return { ok: true as const };
}

export async function completePosSale(input: {
  lines: PosLineInput[];
  method: string;
  customerId?: string | null;
  notes?: string;
  honeyPersons?: string | null;
  posRegisterId?: string | null;
  ticketId?: string | null;
  discountPercent?: number;
}) {
  const { companyId, company, user } = await requireCompany();
  const { isFreeRetailTier, parsePlanTier } = await import("@/lib/tier");
  const planTier = parsePlanTier(company.planTier);

  if (!input.lines.length) {
    return { error: "Cart is empty" };
  }

  let posRegisterId: string | null = input.posRegisterId || null;
  if (isFreeRetailTier(planTier)) {
    if (!posRegisterId) {
      return { error: "Select a named POS register (Settings → POS)" };
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

  let builtResult;
  try {
    builtResult = await buildPosLines(companyId, input.lines, {
      enforceOutOfStock: company.featureOutOfStockWarn === true,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not price cart" };
  }

  if ("error" in builtResult && builtResult.error === "out_of_stock") {
    const first = builtResult.outOfStock[0]!;
    const ownerEmail =
      user && "email" in user ? String((user as { email?: string | null }).email || "") : "";
    const { notifyOutOfStockAttempt } = await import("@/lib/stock-alerts");
    await notifyOutOfStockAttempt({
      companyId,
      companyName: company.name,
      toEmail: ownerEmail,
      productName: first.name,
      requestedQty: first.requested,
      availableQty: first.available,
    });
    return {
      error: `Out of stock: ${builtResult.outOfStock
        .map((o) => `${o.name} (have ${o.available}, need ${o.requested})`)
        .join("; ")}. An alert email was sent.`,
    };
  }

  const { built, byId } = builtResult;

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
    });
    if (!customer) return { error: "Customer not found" };
  }

  const subtotal = built.reduce((s, l) => s + l.lineTotal, 0);
  const discountPercent = Math.max(0, Math.min(100, Number(input.discountPercent) || 0));
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxOn = company.taxEnabled !== false;
  const vatRate = taxOn ? (company.vatRate ?? 0.125) : 0;
  const taxAmount = Math.round(taxable * vatRate);
  const total = taxable + taxAmount;
  const method = input.method || "CASH";
  const honeyPersons =
    company.receiptHoneyPersons === true
      ? String(input.honeyPersons || "").trim() || null
      : null;

  let sale;
  if (input.ticketId) {
    const existing = await prisma.sale.findFirst({
      where: { id: input.ticketId, companyId, status: "OPEN" },
    });
    if (!existing) return { error: "Open ticket not found" };
    await prisma.saleLine.deleteMany({ where: { saleId: existing.id } });
    sale = await prisma.sale.update({
      where: { id: existing.id },
      data: {
        customerId: input.customerId || null,
        posRegisterId,
        status: "COMPLETED",
        subtotal,
        taxAmount,
        total,
        amountPaid: total,
        discountPercent,
        discountAmount,
        method,
        notes: input.notes || null,
        honeyPersons,
        soldAt: new Date(),
        number: existing.number.startsWith("TKT")
          ? await nextNumber("POS", "sale", companyId)
          : existing.number,
        lines: {
          create: built.map(
            ({ productId, description, quantity, unitPrice, lineTotal, variantLabel }) => ({
              productId,
              description,
              quantity,
              unitPrice,
              lineTotal,
              variantLabel: variantLabel ?? null,
            }),
          ),
        },
      },
    });
  } else {
    sale = await prisma.sale.create({
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
        discountPercent,
        discountAmount,
        method,
        notes: input.notes || null,
        honeyPersons,
        lines: {
          create: built.map(
            ({ productId, description, quantity, unitPrice, lineTotal, variantLabel }) => ({
              productId,
              description,
              quantity,
              unitPrice,
              lineTotal,
              variantLabel: variantLabel ?? null,
            }),
          ),
        },
      },
    });
  }

  for (const line of built) {
    if (!line.trackStock) continue;
    await applyProductStockDelta(line.productId!, -line.quantity, {
      variantLabel: line.variantLabel,
      movement: {
        type: "USAGE",
        quantity: -line.quantity,
        unitCost: byId[line.productId!]?.unitCost ?? 0,
        reference: sale.number,
        notes: line.variantLabel ? `POS sale (${line.variantLabel})` : "POS sale",
      },
    });

    // Low-stock email when feature enabled and item crosses min threshold
    if (company.featureLowStockEmail) {
      const updated = await prisma.product.findUnique({ where: { id: line.productId! } });
      if (updated && updated.stockQty <= updated.minStock) {
        const ownerEmail =
          user && "email" in user ? String((user as { email?: string | null }).email || "") : "";
        if (ownerEmail) {
          const { sendEmail } = await import("@/lib/email");
          await sendEmail({
            to: ownerEmail,
            subject: `[CBManagement] Low stock — ${updated.name}`,
            text: [
              `Business: ${company.name}`,
              ``,
              `${updated.name} is low or out of stock.`,
              `Quantity on hand: ${updated.stockQty}`,
              `Minimum: ${updated.minStock}`,
              ``,
              `— Complete Business Management (CBManagement)`,
            ].join("\n"),
          });
        }
      }
    }
  }

  if (input.customerId) {
    await prisma.payment.create({
      data: {
        companyId,
        customerId: input.customerId,
        amount: total,
        method,
        reference: sale.number,
        notes: "POS sale",
        paidAt: new Date(),
      },
    });
  } else {
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
        method,
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

  return { saleId: sale.id, number: sale.number, total, method };
}

/** Issue a full refund for a completed sale (both POS registers). Restores stock. */
export async function refundPosSale(saleId: string, posRegisterId?: string | null) {
  const { companyId, company } = await requireCompany();
  const original = await prisma.sale.findFirst({
    where: { id: saleId, companyId, status: "COMPLETED", isRefund: false },
    include: { lines: true },
  });
  if (!original) return { error: "Sale not found" };

  const already = await prisma.sale.findFirst({
    where: { companyId, refundOfSaleId: original.id, isRefund: true },
  });
  if (already) return { error: "This sale was already refunded" };

  let registerId: string | null = posRegisterId || original.posRegisterId || null;
  if (registerId) {
    const reg = await prisma.posRegister.findFirst({ where: { id: registerId, companyId } });
    if (!reg) registerId = null;
  }

  const refund = await prisma.sale.create({
    data: {
      companyId,
      number: await nextNumber("REF", "sale", companyId),
      customerId: original.customerId,
      posRegisterId: registerId,
      status: "COMPLETED",
      subtotal: -Math.abs(original.subtotal),
      taxAmount: -Math.abs(original.taxAmount),
      total: -Math.abs(original.total),
      amountPaid: -Math.abs(original.total),
      discountPercent: original.discountPercent,
      discountAmount: -Math.abs(original.discountAmount),
      method: original.method,
      notes: `Refund of ${original.number}`,
      isRefund: true,
      refundOfSaleId: original.id,
      lines: {
        create: original.lines.map((l) => ({
          productId: l.productId,
          description: `Refund: ${l.description}`,
          quantity: l.quantity,
          unitPrice: -Math.abs(l.unitPrice),
          lineTotal: -Math.abs(l.lineTotal),
          variantLabel: l.variantLabel,
        })),
      },
    },
  });

  for (const line of original.lines) {
    if (!line.productId) continue;
    const product = await prisma.product.findFirst({
      where: { id: line.productId, companyId },
    });
    if (!product || !product.trackStock || product.isService) continue;

    const variantLabel =
      line.variantLabel?.trim() ||
      parseVariantFromDescription(product.name, line.description) ||
      undefined;

    await applyProductStockDelta(product.id, line.quantity, {
      variantLabel,
      movement: {
        type: "RETURN",
        quantity: line.quantity,
        unitCost: product.unitCost,
        reference: refund.number,
        notes: variantLabel
          ? `Refund of ${original.number} (${variantLabel})`
          : `Refund of ${original.number}`,
      },
    });
  }

  revalidatePath("/pos");
  revalidatePath(`/pos/receipt/${original.id}`);
  revalidatePath("/inventory");
  revalidatePath("/reports");
  return { saleId: refund.id, number: refund.number, originalNumber: original.number };
}
