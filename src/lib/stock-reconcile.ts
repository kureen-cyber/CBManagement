import { prisma } from "@/lib/prisma";
import {
  findOptionForVariantLabel,
  hasOptionStock,
  parseVariableOptions,
  parseVariantFromDescription,
  resolveSaleUnitCost,
  serializeVariableOptions,
  sumOptionStock,
  type ProductVariableDef,
} from "@/lib/product-variables";

/**
 * Ensure completed POS sales have stock movements, apply any missing deductions to
 * the correct variant row only, and keep product.stockQty = sum of variant qtys.
 * Never consolidates total inventory onto the first option, and never rewrites
 * option qtys from the product-level ledger (opening is a total only — per-row
 * quantities live in ProductVariable.options).
 */
export async function reconcileMissingSaleStock(companyId: string): Promise<{
  fixedLines: number;
  repairedProducts: number;
}> {
  const fixedLines = await ensureAndApplyMissingSaleStock(companyId);
  await syncProductStockQtyFromOptions(companyId);
  return { fixedLines, repairedProducts: 0 };
}

/** Extract "Colour: Red" from movement notes like "POS sale (Colour: Red)". */
export function extractVariantFromMovementNotes(notes: string | null | undefined): string | null {
  const n = String(notes || "");
  const matches = [...n.matchAll(/\(([^)]+)\)/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const inner = String(matches[i]![1] || "").trim();
    if (inner.includes(":") && !/sum of variable/i.test(inner)) return inner;
  }
  return null;
}

async function syncProductStockQtyFromOptions(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, trackStock: true, isService: false },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });

  for (const product of products) {
    const variables: ProductVariableDef[] = product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options),
    }));
    if (!hasOptionStock(variables)) continue;
    const nextQty = sumOptionStock(variables);
    if (Math.abs(product.stockQty - nextQty) < 1e-9) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQty: nextQty },
    });
  }
}

async function ensureAndApplyMissingSaleStock(companyId: string): Promise<number> {
  const [sales, movements] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED" },
      select: {
        number: true,
        isRefund: true,
        lines: {
          select: {
            productId: true,
            quantity: true,
            description: true,
            variantLabel: true,
          },
        },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        product: { companyId },
        type: { in: ["USAGE", "RETURN"] },
        reference: { not: null },
      },
      select: { productId: true, reference: true, quantity: true, notes: true },
    }),
  ]);

  const movedByKey = new Map<string, number>();
  for (const m of movements) {
    const key = `${m.reference}|${m.productId}`;
    movedByKey.set(key, (movedByKey.get(key) || 0) + m.quantity);
  }

  type Agg = {
    saleNumber: string;
    productId: string;
    variantLabel: string | null;
    expectedQty: number;
  };
  const expected = new Map<string, Agg>();

  const productIds = [
    ...new Set(
      sales.flatMap((s) => s.lines.map((l) => l.productId).filter(Boolean) as string[]),
    ),
  ];
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: productIds } },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  for (const sale of sales) {
    for (const line of sale.lines) {
      if (!line.productId) continue;
      const product = productById[line.productId];
      if (!product || !product.trackStock || product.isService) continue;

      const variantLabel =
        line.variantLabel?.trim() ||
        parseVariantFromDescription(product.name, line.description) ||
        null;
      const key = `${sale.number}|${line.productId}|${variantLabel || ""}`;
      const signedQty = sale.isRefund ? line.quantity : -line.quantity;
      const prev = expected.get(key);
      if (prev) prev.expectedQty += signedQty;
      else {
        expected.set(key, {
          saleNumber: sale.number,
          productId: line.productId,
          variantLabel,
          expectedQty: signedQty,
        });
      }
    }
  }

  const expectedBySaleProduct = new Map<string, { expectedQty: number; variants: Agg[] }>();
  for (const agg of expected.values()) {
    const key = `${agg.saleNumber}|${agg.productId}`;
    const prev = expectedBySaleProduct.get(key);
    if (prev) {
      prev.expectedQty += agg.expectedQty;
      prev.variants.push(agg);
    } else {
      expectedBySaleProduct.set(key, { expectedQty: agg.expectedQty, variants: [agg] });
    }
  }

  let fixedLines = 0;
  for (const [key, group] of expectedBySaleProduct) {
    const movedQty = movedByKey.get(key) || 0;
    const missing = group.expectedQty - movedQty;
    if (Math.abs(missing) < 1e-9) continue;

    const variants = group.variants.filter((v) => Math.abs(v.expectedQty) > 1e-9);
    if (!variants.length) continue;

    const absTotal = variants.reduce((s, v) => s + Math.abs(v.expectedQty), 0) || 1;
    let remaining = missing;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!;
      const share =
        i === variants.length - 1
          ? remaining
          : Math.round((missing * Math.abs(v.expectedQty)) / absTotal);
      remaining -= share;
      if (Math.abs(share) < 1e-9) continue;

      await applyVariantOnlyStockDelta({
        productId: v.productId,
        quantityDelta: share,
        variantLabel: v.variantLabel,
        saleNumber: v.saleNumber,
      });
      fixedLines += 1;
    }
  }

  return fixedLines;
}

/** Deduct/restore only the matched variant row — never other options. */
async function applyVariantOnlyStockDelta(input: {
  productId: string;
  quantityDelta: number;
  variantLabel: string | null;
  saleNumber: string;
}) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId },
    include: { variables: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product || !product.trackStock || product.isService) return;

  const variables: ProductVariableDef[] = product.variables.map((v) => ({
    name: v.name,
    options: parseVariableOptions(v.options),
  }));
  const tracksOptions = hasOptionStock(variables);
  const variantLabel = String(input.variantLabel || "").trim();

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.quantityDelta < 0 ? "USAGE" : "RETURN",
        quantity: input.quantityDelta,
        unitCost: resolveSaleUnitCost(product, variables, variantLabel),
        reference: input.saleNumber,
        notes: variantLabel
          ? `Auto-reconcile stock for ${input.saleNumber} (${variantLabel})`
          : `Auto-reconcile stock for ${input.saleNumber}`,
      },
    });

    if (tracksOptions && variantLabel) {
      const hit = findOptionForVariantLabel(variables, variantLabel);
      if (hit) {
        const nextVariables = variables.map((v, vi) => ({
          name: v.name,
          options: v.options.map((o, oi) => {
            if (vi !== hit.variableIndex || oi !== hit.optionIndex) return { ...o };
            return { ...o, qty: Math.max(0, o.qty + input.quantityDelta) };
          }),
        }));
        const nextQty = sumOptionStock(nextVariables);
        for (const next of nextVariables) {
          const row = product.variables.find((v) => v.name === next.name);
          if (row) {
            await tx.productVariable.update({
              where: { id: row.id },
              data: { options: serializeVariableOptions(next.options) },
            });
          }
        }
        await tx.product.update({
          where: { id: input.productId },
          data: { stockQty: nextQty },
        });
        return;
      }
    }

    await tx.product.update({
      where: { id: input.productId },
      data: { stockQty: Math.max(0, product.stockQty + input.quantityDelta) },
    });
  });
}
