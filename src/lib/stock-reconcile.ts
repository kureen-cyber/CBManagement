import { prisma } from "@/lib/prisma";
import {
  applyOptionQtyDelta,
  findOptionForVariantLabel,
  hasOptionStock,
  parseVariableOptions,
  parseVariantFromDescription,
  serializeVariableOptions,
  sumOptionStock,
  type ProductVariableDef,
} from "@/lib/product-variables";

/**
 * Deduct (or restore) stock for completed POS receipts that never wrote a matching
 * stock movement. Idempotent — safe to run on every inventory/POS page load.
 */
export async function reconcileMissingSaleStock(companyId: string): Promise<{
  fixedLines: number;
}> {
  const [sales, movements] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED" },
      select: {
        id: true,
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
      select: { productId: true, reference: true, quantity: true },
    }),
  ]);

  const movedByKey = new Map<string, number>();
  for (const m of movements) {
    const key = `${m.reference}|${m.productId}`;
    movedByKey.set(key, (movedByKey.get(key) || 0) + m.quantity);
  }

  // Aggregate expected deltas per sale number + product + variant
  type Agg = {
    saleNumber: string;
    productId: string;
    variantLabel: string | null;
    expectedQty: number;
    isRefund: boolean;
    productName: string;
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
      if (prev) {
        prev.expectedQty += signedQty;
      } else {
        expected.set(key, {
          saleNumber: sale.number,
          productId: line.productId,
          variantLabel,
          expectedQty: signedQty,
          isRefund: sale.isRefund,
          productName: product.name,
        });
      }
    }
  }

  let fixedLines = 0;

  // Aggregate expected at sale+product (movements have no variant key)
  const expectedBySaleProduct = new Map<
    string,
    { expectedQty: number; variants: Agg[] }
  >();
  for (const agg of expected.values()) {
    const key = `${agg.saleNumber}|${agg.productId}`;
    const prev = expectedBySaleProduct.get(key);
    if (prev) {
      prev.expectedQty += agg.expectedQty;
      prev.variants.push(agg);
    } else {
      expectedBySaleProduct.set(key, {
        expectedQty: agg.expectedQty,
        variants: [agg],
      });
    }
  }

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

      await applyMissingStockDelta({
        productId: v.productId,
        quantityDelta: share,
        variantLabel: v.variantLabel,
        saleNumber: v.saleNumber,
      });
      fixedLines += 1;
    }

    movedByKey.set(key, (movedByKey.get(key) || 0) + missing);
  }

  return { fixedLines };
}

async function applyMissingStockDelta(input: {
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
        unitCost: product.unitCost,
        reference: input.saleNumber,
        notes: variantLabel
          ? `Auto-reconcile stock for ${input.saleNumber} (${variantLabel})`
          : `Auto-reconcile stock for ${input.saleNumber}`,
      },
    });

    if (tracksOptions) {
      const fallbackLabel =
        variables[0]?.options.length === 1
          ? `${variables[0]!.name}: ${variables[0]!.options[0]!.label}`
          : "";
      const labelToUse = variantLabel || fallbackLabel;
      let applied = labelToUse
        ? applyOptionQtyDelta(variables, labelToUse, input.quantityDelta)
        : null;

      if (applied) {
        const optionsHadStock = variables[0]!.options.some((o) => o.qty > 0);
        let nextVariables = applied;
        let nextQty = sumOptionStock(applied);

        if (!optionsHadStock && product.stockQty > 0) {
          nextQty = Math.max(0, product.stockQty + input.quantityDelta);
          const hit = findOptionForVariantLabel(applied, labelToUse);
          nextVariables = applied.map((v, vi) => ({
            ...v,
            options: v.options.map((o, oi) =>
              hit && vi === hit.variableIndex && oi === hit.optionIndex
                ? { ...o, qty: nextQty }
                : { ...o, qty: vi === 0 ? 0 : o.qty },
            ),
          }));
        }

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
      data: { stockQty: { increment: input.quantityDelta } },
    });
  });
}
