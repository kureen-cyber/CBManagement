import { prisma } from "@/lib/prisma";
import {
  findOptionForVariantLabel,
  hasOptionStock,
  parseVariableOptions,
  parseVariantFromDescription,
  serializeVariableOptions,
  sumOptionStock,
  type ProductVariableDef,
} from "@/lib/product-variables";

/**
 * Ensure every completed POS sale has a matching stock movement, then rebuild
 * on-hand quantities from the movement ledger so Inventory (option rows) matches
 * what was actually sold.
 */
export async function reconcileMissingSaleStock(companyId: string): Promise<{
  fixedLines: number;
  rebuiltProducts: number;
}> {
  const fixedLines = await ensureSaleMovements(companyId);
  const rebuiltProducts = await rebuildStockFromMovements(companyId);
  return { fixedLines, rebuiltProducts };
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

async function ensureSaleMovements(companyId: string): Promise<number> {
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
      select: { productId: true, reference: true, quantity: true },
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
    select: { id: true, name: true, trackStock: true, isService: true },
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

      await prisma.stockMovement.create({
        data: {
          productId: v.productId,
          type: share < 0 ? "USAGE" : "RETURN",
          quantity: share,
          unitCost: 0,
          reference: v.saleNumber,
          notes: v.variantLabel
            ? `Auto-reconcile stock for ${v.saleNumber} (${v.variantLabel})`
            : `Auto-reconcile stock for ${v.saleNumber}`,
        },
      });
      fixedLines += 1;
    }
  }

  return fixedLines;
}

/**
 * Replay every stock movement onto product + option quantities.
 * Opening/purchases without a variant stay in an unallocated pool, then merge
 * into option rows that were touched by sales — so POS deductions show on Inventory.
 */
async function rebuildStockFromMovements(companyId: string): Promise<number> {
  const products = await prisma.product.findMany({
    where: { companyId, trackStock: true, isService: false },
    include: {
      variables: { orderBy: { sortOrder: "asc" } },
      stockMoves: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });

  let rebuilt = 0;

  for (const product of products) {
    let variables: ProductVariableDef[] = product.variables.map((v) => ({
      name: v.name,
      options: parseVariableOptions(v.options).map((o) => ({ ...o, qty: 0 })),
    }));
    const tracksOptions = hasOptionStock(variables);
    let unallocated = 0;
    let optionTouched = false;

    for (const m of product.stockMoves) {
      const variant = extractVariantFromMovementNotes(m.notes);
      if (tracksOptions && variant) {
        const hit = findOptionForVariantLabel(variables, variant);
        if (hit) {
          optionTouched = true;
          variables = variables.map((v, vi) => ({
            name: v.name,
            options: v.options.map((o, oi) =>
              vi === hit.variableIndex && oi === hit.optionIndex
                ? { ...o, qty: o.qty + m.quantity }
                : { ...o },
            ),
          }));
          continue;
        }
      }
      unallocated += m.quantity;
    }

    let nextQty: number;
    if (tracksOptions && optionTouched) {
      if (Math.abs(unallocated) > 1e-9 && variables[0]?.options.length) {
        variables = variables.map((v, vi) => {
          if (vi !== 0) return v;
          return {
            ...v,
            options: v.options.map((o, oi) =>
              oi === 0 ? { ...o, qty: o.qty + unallocated } : o,
            ),
          };
        });
      }
      variables = variables.map((v) => ({
        ...v,
        options: v.options.map((o) => ({ ...o, qty: Math.max(0, o.qty) })),
      }));
      nextQty = sumOptionStock(variables);
    } else if (tracksOptions && variables[0]?.options.length) {
      nextQty = Math.max(0, unallocated);
      // Mirror product-level stock onto options proportionally if they had labels only,
      // otherwise put everything on the first option so Inventory shows a number.
      const primaryCount = variables[0]!.options.length;
      if (primaryCount === 1) {
        variables = variables.map((v, vi) =>
          vi === 0
            ? {
                ...v,
                options: v.options.map((o, oi) => (oi === 0 ? { ...o, qty: nextQty } : o)),
              }
            : v,
        );
      } else {
        // Keep options at 0 but stockQty correct — Inventory shows option rows at 0;
        // also set first option to nextQty so the list isn't misleading after sales rebuild
        // when only product-level movements exist.
        variables = variables.map((v, vi) =>
          vi === 0
            ? {
                ...v,
                options: v.options.map((o, oi) => (oi === 0 ? { ...o, qty: nextQty } : { ...o, qty: 0 })),
              }
            : v,
        );
        nextQty = sumOptionStock(variables);
      }
    } else {
      nextQty = Math.max(0, unallocated);
    }

    const currentOptionJson = product.variables.map((v) => v.options).join("|");
    const nextOptionJson = variables.map((v) => serializeVariableOptions(v.options)).join("|");
    const changed =
      Math.abs(product.stockQty - nextQty) > 1e-9 || currentOptionJson !== nextOptionJson;

    if (!changed) continue;

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: nextQty },
      });
      for (const next of variables) {
        const row = product.variables.find((v) => v.name === next.name);
        if (row) {
          await tx.productVariable.update({
            where: { id: row.id },
            data: { options: serializeVariableOptions(next.options) },
          });
        }
      }
    });
    rebuilt += 1;
  }

  return rebuilt;
}
